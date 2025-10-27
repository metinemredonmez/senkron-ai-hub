from __future__ import annotations

import asyncio
import json
from typing import Any, Dict, Optional, Tuple

from redis.asyncio import Redis


class RedisStore:
    def __init__(self, url: str, namespace: str = "orchestrator"):
        self._url = url
        self._namespace = namespace
        self._redis: Optional[Redis] = None
        self._lock = asyncio.Lock()

    async def connect(self) -> Redis:
        if self._redis is None:
            async with self._lock:
                if self._redis is None:
                    self._redis = Redis.from_url(
                        self._url,
                        encoding="utf-8",
                        decode_responses=True,
                    )
        return self._redis  # type: ignore[return-value]

    async def close(self) -> None:
        if self._redis:
            await self._redis.close()
            self._redis = None

    async def set_json(self, key: str, data: Dict[str, Any], ttl: int | None = None) -> None:
        redis = await self.connect()
        payload = json.dumps(data, ensure_ascii=False)
        await redis.set(key, payload, ex=ttl)

    async def get_json(self, key: str) -> Optional[Dict[str, Any]]:
        redis = await self.connect()
        payload = await redis.get(key)
        if payload is None:
            return None
        try:
            return json.loads(payload)
        except json.JSONDecodeError:
            return None

    async def set_checkpoint(self, tenant_id: str, case_id: str, state: Dict[str, Any]) -> None:
        key, _ = self._checkpoint_key(tenant_id, case_id)
        await self.set_json(key, state)
        compact_state = {
            "caseId": case_id,
            "stage": state.get("stage"),
            "status": state.get("status"),
            "updatedAt": state.get("updatedAt"),
        }
        case_key, _ = self._case_key(tenant_id, case_id)
        await self.set_json(case_key, compact_state)

    async def get_checkpoint(self, tenant_id: str, case_id: str) -> Optional[Dict[str, Any]]:
        key, legacy_key = self._checkpoint_key(tenant_id, case_id)
        payload = await self.get_json(key)
        if payload is not None or legacy_key is None:
            return payload
        return await self.get_json(legacy_key)

    def _checkpoint_key(self, tenant_id: str, case_id: str) -> Tuple[str, Optional[str]]:
        tenant = tenant_id or "system"
        namespaced = f"{tenant}:lg:ckpt:{case_id}"
        legacy = f"lg:ckpt:{case_id}"
        return namespaced, legacy

    def _case_key(self, tenant_id: str, case_id: str) -> Tuple[str, Optional[str]]:
        tenant = tenant_id or "system"
        namespaced = f"{tenant}:case:state:{case_id}"
        legacy = f"case:state:{case_id}"
        return namespaced, legacy
