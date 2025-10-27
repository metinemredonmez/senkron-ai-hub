"""Event schema definitions shared across hub services."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class EventPayload(BaseModel):
    """Wrapper for arbitrary payload data."""

    data: Dict[str, Any] = Field(default_factory=dict)
    intent: Optional[str] = None
    context: Dict[str, Any] = Field(default_factory=dict)


class HubEvent(BaseModel):
    """Event exchanged through the Synchron AI Hub."""

    id: str
    tenant_id: str = Field(alias="tenantId")
    event_type: str = Field(alias="type")
    source: str
    timestamp: datetime
    payload: Dict[str, Any] = Field(default_factory=dict)
    session_id: Optional[str] = Field(default=None, alias="sessionId")
    target_agent: Optional[str] = Field(default=None, alias="targetAgent")
    agent_name: Optional[str] = Field(default=None, alias="agentName")
    channel: Optional[str] = Field(default=None, description="Communication channel")
    correlation_id: Optional[str] = Field(default=None, alias="correlationId")
    metadata: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        populate_by_name = True

    @property
    def resolved_agent(self) -> Optional[str]:
        return self.target_agent or self.agent_name
