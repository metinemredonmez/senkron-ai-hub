"""Prometheus metrics utilities for the Synchron AI Hub."""

from __future__ import annotations

import asyncio
import logging
from functools import wraps
from time import perf_counter
from typing import Any, Callable, Optional, Protocol

from prometheus_client import Counter, Histogram

logger = logging.getLogger(__name__)


class LabelsResolver(Protocol):
    def __call__(self, *args: Any, **kwargs: Any) -> tuple[str, str, str | None, str | None]:
        """Return ``(agent_name, tenant_id, channel, event_type)``."""


class MetricsCollector:
    """Centralised Prometheus metrics handling with helpful decorators."""

    def __init__(self, registry=None) -> None:
        self.agent_latency_seconds = Histogram(
            "agent_latency_seconds",
            "Latency distribution for agent executions",
            labelnames=("agent_name", "tenant_id", "event_type"),
            registry=registry,
        )
        self.tenant_request_count = Counter(
            "tenant_request_count",
            "Count of orchestration requests per tenant and agent",
            labelnames=("tenant_id", "agent_name", "channel", "event_type"),
            registry=registry,
        )
        self.agent_error_total = Counter(
            "agent_error_total",
            "Total agent execution errors by tenant",
            labelnames=("agent_name", "tenant_id", "event_type", "error_type"),
            registry=registry,
        )

    def track_agent(self, resolver: LabelsResolver) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
        """Decorate a sync/async callable to record hub metrics.

        Parameters
        ----------
        resolver:
            Callable returning ``(agent_name, tenant_id, channel)`` using the wrapped
            function arguments. ``channel`` may be ``None`` and defaults to
            ``"system"`` in that case.
        """

        def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
            if asyncio.iscoroutinefunction(func):

                @wraps(func)
                async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
                    agent_name, tenant_id, channel, event_type = self._resolve_labels(
                        resolver, args, kwargs
                    )
                    channel = channel or "system"
                    event_type = event_type or "unknown"
                    start = perf_counter()
                    try:
                        result = await func(*args, **kwargs)
                    except Exception as exc:
                        self._record_error(agent_name, tenant_id, event_type, exc)
                        duration = perf_counter() - start
                        self._observe_latency(agent_name, tenant_id, event_type, duration)
                        raise
                    duration = perf_counter() - start
                    self._observe_latency(agent_name, tenant_id, event_type, duration)
                    self._increment_request(tenant_id, agent_name, channel, event_type)
                    return result

                return async_wrapper

            @wraps(func)
            def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
                agent_name, tenant_id, channel, event_type = self._resolve_labels(
                    resolver, args, kwargs
                )
                channel = channel or "system"
                event_type = event_type or "unknown"
                start = perf_counter()
                try:
                    result = func(*args, **kwargs)
                except Exception as exc:
                    self._record_error(agent_name, tenant_id, event_type, exc)
                    duration = perf_counter() - start
                    self._observe_latency(agent_name, tenant_id, event_type, duration)
                    raise
                duration = perf_counter() - start
                self._observe_latency(agent_name, tenant_id, event_type, duration)
                self._increment_request(tenant_id, agent_name, channel, event_type)
                return result

            return sync_wrapper

        return decorator

    def _observe_latency(self, agent_name: str, tenant_id: str, event_type: str, duration: float) -> None:
        try:
            self.agent_latency_seconds.labels(
                agent_name=agent_name,
                tenant_id=tenant_id,
                event_type=event_type,
            ).observe(duration)
        except ValueError:
            logger.debug("Latency metric already registered for %s/%s", agent_name, tenant_id)

    def _increment_request(
        self, tenant_id: str, agent_name: str, channel: str, event_type: str
    ) -> None:
        try:
            self.tenant_request_count.labels(
                tenant_id=tenant_id,
                agent_name=agent_name,
                channel=channel,
                event_type=event_type,
            ).inc()
        except ValueError:
            logger.debug("Request counter already registered for %s/%s", tenant_id, agent_name)

    def _record_error(self, agent_name: str, tenant_id: str, event_type: str, exc: BaseException) -> None:
        error_type = exc.__class__.__name__
        try:
            self.agent_error_total.labels(
                agent_name=agent_name,
                tenant_id=tenant_id,
                event_type=event_type,
                error_type=error_type,
            ).inc()
        except ValueError:
            logger.debug("Error counter already registered for %s/%s", agent_name, tenant_id)

    @staticmethod
    def _resolve_labels(
        resolver: LabelsResolver,
        args: tuple[Any, ...],
        kwargs: dict[str, Any],
    ) -> tuple[str, str, Optional[str], Optional[str]]:
        agent_name, tenant_id, channel, event_type = resolver(*args, **kwargs)
        return agent_name, tenant_id, channel, event_type
