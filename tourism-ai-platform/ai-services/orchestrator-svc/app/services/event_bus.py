"""Event bus abstraction for Kafka and Redis streams."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from ai_services.hub_core.context_manager import ContextManager
from ai_services.interfaces.schemas.event_schema import HubEvent

from ..utils.kafka_producer import KafkaEventProducer

logger = logging.getLogger(__name__)


class EventBus:
    """Publish events to Kafka and Redis in a single abstraction."""

    def __init__(
        self,
        *,
        kafka_producer: KafkaEventProducer,
        context_manager: ContextManager,
        kafka_topic: str = "ai.agent.events",
        redis_stream: str = "hub:events",
        hub_topic_suffix: str = "hub.events",
    ) -> None:
        self._kafka_producer = kafka_producer
        self._context_manager = context_manager
        self._agent_topic_suffix = kafka_topic
        self._hub_topic_suffix = hub_topic_suffix
        self._redis_stream = redis_stream

    async def publish(self, event: HubEvent) -> None:
        payload = event.model_dump(mode="json", by_alias=True)
        tenant_stream = self._tenant_stream(event.tenant_id)
        kafka_task = asyncio.create_task(
            self._kafka_producer.send_event(self._resolve_topic(event), payload)
        )
        redis_task = asyncio.create_task(
            self._context_manager.append_stream(tenant_stream, payload)
        )
        results = await asyncio.gather(kafka_task, redis_task, return_exceptions=True)
        for result in results:
            if isinstance(result, Exception):
                logger.warning("Event publish encountered an error: %s", result)

    async def publish_raw(self, payload: Dict[str, Any]) -> None:
        event = HubEvent.model_validate(payload)
        await self.publish(event)

    async def emit_agent_response(
        self,
        tenant_id: str,
        agent_name: str,
        response: Dict[str, Any],
        *,
        correlation_id: Optional[str] = None,
    ) -> None:
        event = HubEvent(
            id=response.get("id") or correlation_id or agent_name,
            tenant_id=tenant_id,
            event_type="agent.response",
            source=agent_name,
            timestamp=self._resolve_timestamp(response),
            payload=response,
            agent_name=agent_name,
            channel="internal",
            correlation_id=correlation_id,
        )
        await self.publish(event)

    @staticmethod
    def _resolve_timestamp(payload: Dict[str, Any]) -> datetime:
        value = payload.get("timestamp")
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            try:
                return datetime.fromisoformat(value)
            except ValueError:
                logger.debug("Invalid timestamp format %s", value)
        return datetime.now(timezone.utc)

    def _resolve_topic(self, event: HubEvent) -> str:
        tenant_id = event.tenant_id or "system"
        suffix = (
            self._agent_topic_suffix
            if event.event_type.startswith("agent.")
            else self._hub_topic_suffix
        )
        return f"tenant.{tenant_id}.{suffix}"

    def _tenant_stream(self, tenant_id: str | None) -> str:
        tenant = tenant_id or "system"
        return f"{tenant}:{self._redis_stream}"
