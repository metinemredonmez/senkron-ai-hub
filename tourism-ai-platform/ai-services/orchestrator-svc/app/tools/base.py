from __future__ import annotations

import asyncio
import logging
from abc import ABC
from time import perf_counter
from typing import Any, Dict, Optional

import httpx
from opentelemetry import trace

from .metrics import integration_histogram

logger = logging.getLogger(__name__)
tracer = trace.get_tracer("ai-orchestrator.integrations")
INTEGRATION_HISTOGRAM = integration_histogram()


class BaseTool(ABC):
    provider_name: str

    def __init__(self, base_url: str, timeout: float = 8.0):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._client = httpx.AsyncClient(base_url=self.base_url, timeout=timeout)
        self._failure_count = 0
        self._circuit_open_until: Optional[float] = None

    async def close(self) -> None:
        await self._client.aclose()

    def _is_circuit_open(self) -> bool:
        if self._circuit_open_until is None:
            return False
        if self._circuit_open_until < asyncio.get_running_loop().time():
            self._circuit_open_until = None
            self._failure_count = 0
            return False
        return True

    def _trip_circuit(self) -> None:
        cooldown = 30
        self._circuit_open_until = asyncio.get_running_loop().time() + cooldown
        logger.warning("%s circuit opened for %ss", self.provider_name, cooldown)

    async def _request(
        self,
        method: str,
        url: str,
        *,
        json_payload: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        retries: int = 3,
        backoff_base: float = 0.3,
    ) -> Dict[str, Any]:
        if self._is_circuit_open():
            raise RuntimeError(f"{self.provider_name} circuit breaker is open")

        attempt = 0
        span_name = f"{self.provider_name}.{method.lower()}"
        while attempt < retries:
            attempt += 1
            async with tracer.start_as_current_span(span_name) as span:
                span.set_attribute("integration_call", self.provider_name)
                span.set_attribute("http.method", method.upper())
                span.set_attribute("http.url", url)
                start_time = perf_counter()
                try:
                    response = await self._client.request(
                        method=method.upper(),
                        url=url,
                        json=json_payload,
                        headers=headers,
                    )
                    duration = perf_counter() - start_time
                    span.set_attribute("http.status_code", response.status_code)
                    INTEGRATION_HISTOGRAM.labels(
                        provider=self.provider_name,
                        status=str(response.status_code),
                    ).observe(duration)
                    response.raise_for_status()
                    self._failure_count = 0
                    if response.content:
                        return response.json()
                    return {}
                except Exception as exc:
                    duration = perf_counter() - start_time
                    INTEGRATION_HISTOGRAM.labels(
                        provider=self.provider_name,
                        status="error",
                    ).observe(duration)
                    span.record_exception(exc)
                    span.set_attribute("error", True)
                    self._failure_count += 1
                    if self._failure_count >= retries:
                        self._trip_circuit()
                    if attempt >= retries:
                        logger.error(
                            "Request to %s failed after %s attempts: %s",
                            self.provider_name,
                            attempt,
                            exc,
                        )
                        raise
                    sleep_for = backoff_base * (2 ** (attempt - 1))
                    await asyncio.sleep(sleep_for)
        raise RuntimeError(f"Failed to contact {self.provider_name}")
