from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, Optional

from aiokafka import AIOKafkaProducer

logger = logging.getLogger(__name__)


class KafkaEventProducer:
    def __init__(self, brokers: Iterable[str]):
        self._brokers = list(brokers)
        self._producer: Optional[AIOKafkaProducer] = None
        self._lock = asyncio.Lock()
        self._started = False

    async def start(self) -> None:
        if self._started:
            return
        async with self._lock:
            if self._started:
                return
            if not self._brokers:
                logger.warning("Kafka brokers not configured; events will be dropped")
                return
            self._producer = AIOKafkaProducer(
                bootstrap_servers=self._brokers,
                value_serializer=lambda v: json.dumps(v, ensure_ascii=False).encode("utf-8"),
            )
            try:
                await self._producer.start()
                self._started = True
                logger.info("KafkaEventProducer connected to %s", self._brokers)
            except Exception as exc:  # pragma: no cover
                logger.error("Failed to start Kafka producer: %s", exc)
                self._producer = None

    async def stop(self) -> None:
        if self._producer and self._started:
            await self._producer.stop()
        self._producer = None
        self._started = False

    async def send_event(self, topic: str, payload: Dict[str, Any]) -> None:
        if not self._brokers:
            logger.debug("Dropping Kafka event %s; no brokers configured", topic)
            return
        await self.start()
        if not self._producer:
            logger.debug("Kafka producer unavailable; dropping event %s", topic)
            return
        try:
            await self._producer.send_and_wait(topic, payload)
        except Exception as exc:  # pragma: no cover
            logger.warning("Failed to publish Kafka event %s: %s", topic, exc)


async def emit_case_event(
    producer: KafkaEventProducer,
    event_type: str,
    tenant_id: str,
    case_id: str,
    payload: Dict[str, Any],
) -> None:
    event = {
        "tenantId": tenant_id,
        "caseId": case_id,
        "eventType": event_type,
        "payload": payload,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    topic = f"tenant.{tenant_id}.hub.events"
    await producer.send_event(topic, event)
