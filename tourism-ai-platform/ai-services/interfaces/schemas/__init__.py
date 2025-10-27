"""Compatibility layer forwarding to :mod:`ai_services.interfaces.schemas`."""

from ai_services.interfaces.schemas.agent_schema import AgentSchema
from ai_services.interfaces.schemas.event_schema import HubEvent
from ai_services.interfaces.schemas.tenant_schema import TenantSchema

__all__ = ["AgentSchema", "HubEvent", "TenantSchema"]
