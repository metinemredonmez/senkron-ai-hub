"""Compatibility proxy for :mod:`ai_services.interfaces`."""

from ai_services.interfaces.dto import channel_message_dto, postop_dto, preop_dto, security_dto
from ai_services.interfaces.schemas import agent_schema, event_schema, tenant_schema

__all__ = [
    "channel_message_dto",
    "postop_dto",
    "preop_dto",
    "security_dto",
    "agent_schema",
    "event_schema",
    "tenant_schema",
]
