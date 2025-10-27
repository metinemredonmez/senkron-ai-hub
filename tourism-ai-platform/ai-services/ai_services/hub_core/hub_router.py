"""Routing logic for Synchron AI Hub events."""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, Optional, Protocol

from ai_services.interfaces.dto.channel_message_dto import ChannelMessageDTO
from ai_services.interfaces.schemas.agent_schema import AgentSchema
from ai_services.interfaces.schemas.event_schema import HubEvent

from .context_manager import ContextManager
from .metrics_collector import MetricsCollector

logger = logging.getLogger(__name__)


class HubRegistryProtocol(Protocol):
    async def get_agent(self, name: str) -> Optional[AgentSchema]:
        ...

    async def list_agents(self) -> list[AgentSchema]:
        ...


class AgentExecutorProtocol(Protocol):
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
        ...


class EventBusProtocol(Protocol):
    async def publish(self, event: HubEvent) -> None:
        ...


class HubRouter:
    """Coordinate routing of hub events between orchestrator and agents."""

    def __init__(
        self,
        *,
        registry: HubRegistryProtocol,
        context_manager: ContextManager,
        metrics: MetricsCollector,
        agent_executor: AgentExecutorProtocol,
        event_bus: EventBusProtocol,
        persist_stream: str = "hub:events",
    ) -> None:
        self._registry = registry
        self._context_manager = context_manager
        self._metrics = metrics
        self._agent_executor = agent_executor
        self._event_bus = event_bus
        self._persist_stream = persist_stream

    async def route_event(self, event: HubEvent, *, persist: bool = True) -> Dict[str, Any]:
        logger.debug("Routing event %s for tenant %s", event.id, event.tenant_id)
        agent_name = event.resolved_agent
        if agent_name:
            agent = await self._registry.get_agent(agent_name, event.tenant_id)
            if agent is None:
                logger.warning("Agent %s not registered; falling back to event bus", agent_name)
            else:
                return await self._dispatch_agent(agent, event)
        await self._event_bus.publish(event)
        if persist:
            await self._context_manager.append_stream(
                f"{event.tenant_id}:{self._persist_stream}",
                event.model_dump(mode="json", by_alias=True),
            )
        self._metrics.tenant_request_count.labels(
            tenant_id=event.tenant_id,
            agent_name=agent_name or "orchestrator",
            channel=event.channel or "system",
            event_type=event.event_type,
        ).inc()
        return {"status": "queued", "eventId": event.id}

    async def handle_rest_payload(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        event = HubEvent.model_validate(payload)
        return await self.route_event(event)

    async def handle_channel_message(self, message: ChannelMessageDTO) -> Dict[str, Any]:
        event_dict = {
            "id": message.id,
            "tenantId": message.tenant_id,
            "type": "channel.message",
            "source": message.channel,
            "timestamp": message.timestamp.isoformat(),
            "payload": message.payload,
            "sessionId": message.session_id,
            "agentName": message.agent_name,
            "channel": message.channel,
            "metadata": message.metadata,
        }
        return await self.handle_rest_payload(event_dict)

    async def _dispatch_agent(self, agent: AgentSchema, event: HubEvent) -> Dict[str, Any]:
        session_context: Optional[Dict[str, Any]] = None
        if event.session_id:
            session_context = await self._context_manager.get_session_context(
                event.tenant_id, event.session_id
            )
        response = await self._agent_executor.execute(
            agent=agent,
            tenant_id=event.tenant_id,
            payload=event.payload,
            event=event,
            session_context=session_context,
            channel=event.channel,
        )
        logger.debug(
            "Dispatched event %s to %s for tenant %s",
            event.id,
            agent.name,
            event.tenant_id,
        )
        return {
            "status": "completed",
            "agent": agent.name,
            "result": response,
        }

    async def replay_event(self, event_id: str) -> Optional[Dict[str, Any]]:
        entries = await self._context_manager.read_stream(self._persist_stream, last_id=event_id, count=1)
        if not entries:
            return None
        _, fields = entries[0]
        payload = fields.get(b"data") or fields.get("data")
        if not payload:
            return None
        if isinstance(payload, bytes):
            payload = payload.decode("utf-8")
        event_dict = json.loads(payload)
        event = HubEvent.model_validate(event_dict)
        return await self.route_event(event, persist=False)
