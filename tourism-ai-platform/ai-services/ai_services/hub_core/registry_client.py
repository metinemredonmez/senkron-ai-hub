"""Client for interacting with the Synchron AI Hub registry service."""

from __future__ import annotations

import json
import logging
from typing import Iterable, List, Optional

import httpx

from .context_manager import ContextManager
from ai_services.interfaces.schemas.agent_schema import AgentSchema
from ai_services.interfaces.schemas.tenant_schema import TenantSchema

logger = logging.getLogger(__name__)


class RegistryClient:
    def __init__(
        self,
        base_url: str,
        *,
        timeout: float = 10.0,
        api_key: str | None = None,
        headers: Optional[Iterable[tuple[str, str]]] = None,
        context_manager: ContextManager | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        default_headers = {"Content-Type": "application/json"}
        if api_key:
            default_headers["Authorization"] = f"Bearer {api_key}"
        if headers:
            default_headers.update(dict(headers))
        self._client = httpx.AsyncClient(
            base_url=self._base_url, timeout=timeout, headers=default_headers
        )
        self._context_manager = context_manager
        self._tenant_cache_ttl = 600

    def _tenant_headers(self, tenant_id: str | None) -> dict[str, str]:
        resolved = tenant_id or "system"
        return {"X-Tenant": resolved}

    async def close(self) -> None:
        await self._client.aclose()

    async def list_agents(self, tenant_id: str | None = None) -> List[AgentSchema]:
        response = await self._client.get("/agents", headers=self._tenant_headers(tenant_id))
        response.raise_for_status()
        payload = response.json()
        agents = [AgentSchema.model_validate(agent) for agent in payload]
        logger.debug("Fetched %s agents from registry", len(agents))
        return agents

    async def list_tenants(self, use_cache: bool = True) -> List[TenantSchema]:
        if use_cache and self._context_manager:
            tenants = await self._read_cached_tenants()
            if tenants:
                return tenants

        response = await self._client.get("/tenants", headers=self._tenant_headers("system"))
        response.raise_for_status()
        payload = response.json()
        tenants = [TenantSchema.model_validate(item) for item in payload]
        if self._context_manager:
            await self._cache_tenants(tenants)
        return tenants

    async def get_agent(self, name: str, tenant_id: str | None = None) -> Optional[AgentSchema]:
        response = await self._client.get(
            f"/agents/{name}", headers=self._tenant_headers(tenant_id)
        )
        if response.status_code == 404:
            return None
        response.raise_for_status()
        return AgentSchema.model_validate(response.json())

    async def get_tenant(self, tenant_id: str, use_cache: bool = True) -> Optional[TenantSchema]:
        if use_cache and self._context_manager:
            cached = await self._read_cached_tenant(tenant_id)
            if cached:
                return cached

        response = await self._client.get(
            f"/tenants/{tenant_id}", headers=self._tenant_headers("system")
        )
        if response.status_code == 404:
            return None
        response.raise_for_status()
        tenant = TenantSchema.model_validate(response.json())
        if self._context_manager:
            await self._write_cached_tenant(tenant)
        return tenant

    async def register_agent(self, agent: AgentSchema, tenant_id: str | None = None) -> AgentSchema:
        response = await self._client.post(
            "/agents", json=agent.model_dump(mode="json"), headers=self._tenant_headers(tenant_id)
        )
        response.raise_for_status()
        return AgentSchema.model_validate(response.json())

    async def register_tenant(self, tenant: TenantSchema) -> TenantSchema:
        response = await self._client.post(
            "/tenants",
            json=tenant.model_dump(mode="json"),
            headers=self._tenant_headers("system"),
        )
        response.raise_for_status()
        if self._context_manager:
            await self._write_cached_tenant(tenant)
        return TenantSchema.model_validate(response.json())

    async def _cache_tenants(self, tenants: List[TenantSchema]) -> None:
        if not self._context_manager:
            return
        redis = await self._context_manager.connect()
        payload = json.dumps([tenant.model_dump(mode="json", by_alias=True) for tenant in tenants])
        await redis.set("system:hub:registry:tenants", payload, ex=self._tenant_cache_ttl)
        for tenant in tenants:
            await self._write_cached_tenant(tenant)

    async def _read_cached_tenants(self) -> List[TenantSchema]:
        if not self._context_manager:
            return []
        redis = await self._context_manager.connect()
        raw = await redis.get("system:hub:registry:tenants")
        if not raw:
            return []
        try:
            data = json.loads(raw)
            return [TenantSchema.model_validate(item) for item in data]
        except json.JSONDecodeError:
            return []

    async def _read_cached_tenant(self, tenant_id: str) -> Optional[TenantSchema]:
        if not self._context_manager:
            return None
        redis = await self._context_manager.connect()
        raw = await redis.get(self._registry_key(tenant_id))
        if not raw:
            return None
        try:
            data = json.loads(raw)
            return TenantSchema.model_validate(data)
        except json.JSONDecodeError:
            return None

    async def _write_cached_tenant(self, tenant: TenantSchema) -> None:
        if not self._context_manager:
            return
        redis = await self._context_manager.connect()
        await redis.set(
            self._registry_key(tenant.id),
            json.dumps(tenant.model_dump(mode="json", by_alias=True)),
            ex=self._tenant_cache_ttl,
        )

    def _registry_key(self, tenant_id: str) -> str:
        return f"{tenant_id}:hub:registry:tenant"
