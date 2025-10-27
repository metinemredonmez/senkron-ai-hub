"""Context management utilities for the Synchron AI Hub.

This module centralises tenant and session state management so that
services across the platform can share a single source of truth for
short-lived orchestration data. Redis is used as the backing store.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Dict, Optional

from redis.asyncio import Redis

logger = logging.getLogger(__name__)


class ContextManager:
    """Handles tenant and session scoped context using Redis."""

    def __init__(self, redis_url: str, namespace: str = "hub") -> None:
        self._redis_url = redis_url
        self._namespace = namespace.rstrip(":") or "hub"
        self._redis: Optional[Redis] = None
        self._lock = asyncio.Lock()
        self._default_ttl = 60 * 60 * 24

    async def _get_client(self) -> Redis:
        if self._redis is None:
            async with self._lock:
                if self._redis is None:
                    self._redis = Redis.from_url(
                        self._redis_url,
                        encoding="utf-8",
                        decode_responses=True,
                    )
                    logger.debug("ContextManager connected to %s", self._redis_url)
        return self._redis  # type: ignore[return-value]

    async def connect(self) -> Redis:
        """Ensure the Redis client is initialised and return it."""

        return await self._get_client()

    async def close(self) -> None:
        if self._redis:
            await self._redis.close()
            self._redis = None

    async def get_tenant_context(self, tenant_id: str) -> Optional[Dict[str, Any]]:
        redis = await self._get_client()
        payload = await redis.get(self._tenant_key(tenant_id))
        if not payload:
            return None
        try:
            return json.loads(payload)
        except json.JSONDecodeError:
            logger.warning("Invalid tenant context for %s", tenant_id)
            return None

    async def set_tenant_context(
        self,
        tenant_id: str,
        context: Dict[str, Any],
        ttl: Optional[int] = None,
    ) -> None:
        redis = await self._get_client()
        data = json.dumps(context, ensure_ascii=False)
        ttl = ttl or self._default_ttl
        await redis.set(self._tenant_key(tenant_id), data, ex=ttl)

    async def delete_tenant_context(self, tenant_id: str) -> None:
        redis = await self._get_client()
        await redis.delete(self._tenant_key(tenant_id))

    async def get_session_context(
        self,
        tenant_id: str,
        session_id: str,
    ) -> Optional[Dict[str, Any]]:
        redis = await self._get_client()
        payload = await redis.get(self._session_key(tenant_id, session_id))
        if not payload:
            return None
        try:
            return json.loads(payload)
        except json.JSONDecodeError:
            logger.warning(
                "Invalid session context for %s/%s", tenant_id, session_id
            )
            return None

    async def set_session_context(
        self,
        tenant_id: str,
        session_id: str,
        context: Dict[str, Any],
        ttl: Optional[int] = None,
    ) -> None:
        redis = await self._get_client()
        data = json.dumps(context, ensure_ascii=False)
        ttl = ttl or self._default_ttl
        await redis.set(self._session_key(tenant_id, session_id), data, ex=ttl)

    async def delete_session_context(self, tenant_id: str, session_id: str) -> None:
        redis = await self._get_client()
        await redis.delete(self._session_key(tenant_id, session_id))

    async def append_stream(
        self,
        stream_name: str,
        payload: Dict[str, Any],
        max_length: Optional[int] = 1000,
    ) -> str:
        """Append payload to a Redis stream under the given namespace."""

        redis = await self._get_client()
        stream_key = self._stream_key(stream_name)
        entry_id = await redis.xadd(
            stream_key,
            {"data": json.dumps(payload, ensure_ascii=False)},
            maxlen=max_length,
            approximate=True,
        )
        logger.debug("Appended event to %s/%s", stream_key, entry_id)
        return entry_id

    async def read_stream(
        self,
        stream_name: str,
        last_id: str = "$",
        count: int = 100,
    ) -> list[tuple[str, Dict[bytes, bytes]]]:
        redis = await self._get_client()
        return await redis.xrevrange(self._stream_key(stream_name), max=last_id, count=count)

    def _tenant_key(self, tenant_id: str) -> str:
        return f"{tenant_id}:{self._namespace}:context"

    def _session_key(self, tenant_id: str, session_id: str) -> str:
        return f"{tenant_id}:{self._namespace}:session:{session_id}"

    def _stream_key(self, stream_name: str) -> str:
        if ":" in stream_name:
            return stream_name
        return f"{self._namespace}:{stream_name}"
