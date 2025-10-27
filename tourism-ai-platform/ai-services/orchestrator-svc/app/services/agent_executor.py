"""Agent execution utilities for the orchestrator."""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

import httpx

from ai_services.hub_core.metrics_collector import MetricsCollector
from ai_services.interfaces.schemas.agent_schema import AgentSchema
from ai_services.interfaces.schemas.event_schema import HubEvent
from ai_services.interfaces.schemas.tenant_schema import TenantSchema

from .event_bus import EventBus
from .hub_registry import HubRegistry
from .tenant_context import TenantContextService

logger = logging.getLogger(__name__)


class AgentExecutor:
    """Execute AI agents with tenant context and telemetry hooks."""

    def __init__(
        self,
        *,
        tenant_context: TenantContextService,
        registry: HubRegistry,
        event_bus: EventBus,
        metrics: MetricsCollector,
        http_client: Optional[httpx.AsyncClient] = None,
    ) -> None:
        self._tenant_context = tenant_context
        self._registry = registry
        self._event_bus = event_bus
        self._metrics = metrics
        self._http_client = http_client or httpx.AsyncClient()
        self._owns_client = http_client is None
        self._instrumented_execute = metrics.track_agent(self._metric_labels)(self._execute)

    async def close(self) -> None:
        if self._owns_client:
            await self._http_client.aclose()

    async def execute(
        self,
        *,
        agent: AgentSchema,
        tenant_id: str,
        payload: Dict[str, Any],
        event: HubEvent,
        session_context: Optional[Dict[str, Any]] = None,
        channel: Optional[str] = None,
    ) -> Dict[str, Any]:
        return await self._instrumented_execute(
            agent=agent,
            tenant_id=tenant_id,
            payload=payload,
            event=event,
            session_context=session_context,
            channel=channel,
        )

    async def _execute(
        self,
        *,
        agent: AgentSchema,
        tenant_id: str,
        payload: Dict[str, Any],
        event: HubEvent,
        session_context: Optional[Dict[str, Any]],
        channel: Optional[str],
    ) -> Dict[str, Any]:
        registry_agent = await self._registry.get_agent(agent.name, tenant_id)
        if registry_agent:
            agent = registry_agent
        tenant = await self._tenant_context.get_tenant(tenant_id)
        if tenant is None:
            logger.warning("tenant_id=%s agent=%s not registered", tenant_id, agent.name)
        request_body = self._build_request_body(
            agent=agent,
            tenant_id=tenant_id,
            payload=payload,
            event=event,
            tenant=tenant,
            session_context=session_context,
            channel=channel,
        )
        logger.info(
            "Dispatching agent run tenant_id=%s agent=%s channel=%s",
            tenant_id,
            agent.name,
            channel or event.channel,
        )
        try:
            response = await self._http_client.post(
                f"{agent.endpoint}/run",
                json=request_body,
                headers={
                    "X-Tenant-ID": tenant_id,
                    "X-Agent-Name": agent.name,
                },
                timeout=60.0,
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            logger.error(
                "Agent call failed agent=%s tenant_id=%s status=%s body=%s",
                agent.name,
                tenant_id,
                exc.response.status_code if exc.response else "unknown",
                exc.response.text if exc.response else "n/a",
            )
            raise
        except httpx.RequestError as exc:
            logger.error(
                "Agent call request error agent=%s tenant_id=%s details=%s",
                agent.name,
                tenant_id,
                exc,
            )
            raise
        result = response.json()
        await self._persist_session_state(tenant_id, event, result)
        await self._event_bus.emit_agent_response(
            tenant_id=tenant_id,
            agent_name=agent.name,
            response=result,
            correlation_id=event.correlation_id or event.id,
        )
        return result

    def _build_request_body(
        self,
        *,
        agent: AgentSchema,
        tenant_id: str,
        payload: Dict[str, Any],
        event: HubEvent,
        tenant: Optional[TenantSchema],
        session_context: Optional[Dict[str, Any]],
        channel: Optional[str],
    ) -> Dict[str, Any]:
        tenant_payload: Dict[str, Any]
        if tenant is not None:
            tenant_payload = tenant.model_dump(mode="json", by_alias=True)
        else:
            tenant_payload = {"id": tenant_id}
        request_body = {
            "agent": {
                "id": agent.id,
                "name": agent.name,
                "capabilities": [cap.model_dump(mode="json") for cap in agent.capabilities],
            },
            "tenant": tenant_payload,
            "event": event.model_dump(mode="json", by_alias=True),
            "payload": payload,
            "session": session_context or {},
            "channel": channel or event.channel or "system",
        }
        return request_body

    async def _persist_session_state(
        self,
        tenant_id: str,
        event: HubEvent,
        result: Dict[str, Any],
    ) -> None:
        session_id = event.session_id
        if not session_id:
            return
        session_state = result.get("session") or result.get("context")
        if not isinstance(session_state, dict):
            return
        await self._tenant_context.set_session_state(
            tenant_id,
            session_id,
            session_state,
        )

    @staticmethod
    def _metric_labels(
        *,
        agent: AgentSchema,
        tenant_id: str,
        payload: Dict[str, Any],
        event: HubEvent,
        session_context: Optional[Dict[str, Any]],
        channel: Optional[str],
    ) -> tuple[str, str, Optional[str], Optional[str]]:
        return agent.name, tenant_id, channel or event.channel, event.event_type
