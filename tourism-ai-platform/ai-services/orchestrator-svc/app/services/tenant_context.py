"""Tenant context helpers for the orchestrator service."""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, Optional

from ai_services.hub_core.context_manager import ContextManager
from ai_services.hub_core.registry_client import RegistryClient
from ai_services.interfaces.schemas.tenant_schema import TenantSchema

logger = logging.getLogger(__name__)


class TenantContextService:
    """Provide isolation and caching for tenant level configuration."""

    def __init__(
        self,
        *,
        context_manager: ContextManager,
        registry_client: RegistryClient,
        default_ttl: int = 3600,
    ) -> None:
        self._context_manager = context_manager
        self._registry_client = registry_client
        self._default_ttl = default_ttl
        self._tenant_cache: Dict[str, TenantSchema] = {}
        self._lock = asyncio.Lock()

    async def get_tenant(self, tenant_id: str, *, use_cache: bool = True) -> Optional[TenantSchema]:
        if use_cache and tenant_id in self._tenant_cache:
            return self._tenant_cache[tenant_id]

        context = await self._context_manager.get_tenant_context(tenant_id)
        if context and "tenant" in context:
            tenant = TenantSchema.model_validate(context["tenant"])
            if use_cache:
                self._tenant_cache[tenant_id] = tenant
            return tenant

        tenant = await self._registry_client.get_tenant(tenant_id)
        if tenant:
            await self._context_manager.set_tenant_context(
                tenant_id,
                {"tenant": tenant.model_dump(mode="json", by_alias=True)},
                ttl=self._default_ttl,
            )
            if use_cache:
                self._tenant_cache[tenant_id] = tenant
        else:
            logger.warning("Tenant %s not found in registry", tenant_id)
        return tenant

    async def get_environment(self, tenant_id: str) -> Dict[str, str]:
        tenant = await self.get_tenant(tenant_id)
        if not tenant:
            return {}
        return dict(tenant.env_vars)

    async def set_session_state(
        self,
        tenant_id: str,
        session_id: str,
        state: Dict[str, Any],
        *,
        ttl: Optional[int] = None,
    ) -> None:
        await self._context_manager.set_session_context(
            tenant_id,
            session_id,
            state,
            ttl=ttl or self._default_ttl,
        )

    async def get_session_state(
        self,
        tenant_id: str,
        session_id: str,
    ) -> Optional[Dict[str, Any]]:
        return await self._context_manager.get_session_context(tenant_id, session_id)

    async def clear_session_state(self, tenant_id: str, session_id: str) -> None:
        await self._context_manager.delete_session_context(tenant_id, session_id)

    async def warm_tenant(self, tenant_id: str) -> Optional[TenantSchema]:
        async with self._lock:
            tenant = await self.get_tenant(tenant_id, use_cache=False)
            if tenant:
                self._tenant_cache[tenant_id] = tenant
        return tenant

    def discard_cache(self, tenant_id: Optional[str] = None) -> None:
        if tenant_id:
            self._tenant_cache.pop(tenant_id, None)
        else:
            self._tenant_cache.clear()
