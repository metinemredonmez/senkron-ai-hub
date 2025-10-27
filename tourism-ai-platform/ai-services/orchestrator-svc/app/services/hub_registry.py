"""In-memory registry powered by the central AI Hub registry service."""

from __future__ import annotations

import asyncio
import logging
from time import time
from typing import Any, Dict, List, Optional

from ai_services.hub_core.registry_client import RegistryClient
from ai_services.interfaces.schemas.agent_schema import AgentSchema
from ai_services.interfaces.schemas.tenant_schema import TenantSchema

logger = logging.getLogger(__name__)


class HubRegistry:
    """Cache of hub metadata with active client tracking."""

    def __init__(
        self,
        *,
        client: RegistryClient,
        refresh_interval: int = 60,
    ) -> None:
        self._client = client
        self._refresh_interval = refresh_interval
        self._agents: Dict[str, Dict[str, AgentSchema]] = {}
        self._tenants: Dict[str, TenantSchema] = {}
        self._active_clients: Dict[str, Dict[str, float]] = {}
        self._lock = asyncio.Lock()
        self._last_refresh: float = 0.0

    async def refresh(self, *, force: bool = False) -> None:
        now = time()
        if not force and now - self._last_refresh < self._refresh_interval:
            return
        async with self._lock:
            logger.debug("Refreshing hub registry cache")
            agents = await self._client.list_agents("system")
            tenants = await self._client.list_tenants()
            self._agents["system"] = {agent.name: agent for agent in agents}
            self._tenants = {tenant.id: tenant for tenant in tenants}
            self._last_refresh = now

    async def list_agents(self, tenant_id: str | None = None) -> List[AgentSchema]:
        await self.refresh()
        agents = await self._ensure_agents_for_tenant(tenant_id)
        return list(agents.values())

    async def get_agent(self, name: str, tenant_id: str | None = None) -> Optional[AgentSchema]:
        await self.refresh()
        agents = await self._ensure_agents_for_tenant(tenant_id)
        agent = agents.get(name)
        if agent is None and tenant_id and tenant_id != "system":
            fallback = await self._ensure_agents_for_tenant("system")
            return fallback.get(name)
        return agent

    async def list_tenants(self) -> List[TenantSchema]:
        await self.refresh()
        return list(self._tenants.values())

    async def get_tenant(self, tenant_id: str) -> Optional[TenantSchema]:
        await self.refresh()
        return self._tenants.get(tenant_id)

    def register_client(self, tenant_id: str, client_id: str) -> None:
        logger.debug("Registering hub client %s for tenant %s", client_id, tenant_id)
        tenant_clients = self._active_clients.setdefault(tenant_id, {})
        tenant_clients[client_id] = time()

    def heartbeat_client(self, tenant_id: str, client_id: str) -> None:
        if tenant_id in self._active_clients and client_id in self._active_clients[tenant_id]:
            self._active_clients[tenant_id][client_id] = time()
        else:
            self.register_client(tenant_id, client_id)

    def unregister_client(self, tenant_id: str, client_id: str) -> None:
        tenant_clients = self._active_clients.get(tenant_id)
        if tenant_clients and client_id in tenant_clients:
            tenant_clients.pop(client_id)
            if not tenant_clients:
                self._active_clients.pop(tenant_id, None)

    def list_clients(self, tenant_id: Optional[str] = None) -> Dict[str, Dict[str, float]]:
        if tenant_id:
            return {tenant_id: dict(self._active_clients.get(tenant_id, {}))}
        return {tenant: dict(clients) for tenant, clients in self._active_clients.items()}

    async def sync_agent(self, agent: AgentSchema) -> AgentSchema:
        logger.debug("Syncing agent %s with registry", agent.name)
        saved = await self._client.register_agent(agent, tenant_id="system")
        async with self._lock:
            system_agents = self._agents.setdefault("system", {})
            system_agents[saved.name] = saved
        return saved

    async def sync_tenant(self, tenant: TenantSchema) -> TenantSchema:
        logger.debug("Syncing tenant %s", tenant.id)
        saved = await self._client.register_tenant(tenant)
        self._tenants[saved.id] = saved
        return saved

    async def _ensure_agents_for_tenant(self, tenant_id: str | None) -> Dict[str, AgentSchema]:
        tenant = tenant_id or "system"
        async with self._lock:
            cached = self._agents.get(tenant)
        if cached is not None:
            return cached
        fetched = await self._client.list_agents(tenant)
        mapping = {agent.name: agent for agent in fetched}
        async with self._lock:
            self._agents[tenant] = mapping
        return mapping
