"""DTO for messages flowing through hub communication channels."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, Field


class ChannelMessageDTO(BaseModel):
    id: str
    tenant_id: str = Field(alias="tenantId")
    session_id: Optional[str] = Field(default=None, alias="sessionId")
    agent_name: Optional[str] = Field(default=None, alias="agentName")
    channel: str
    direction: Literal["inbound", "outbound"]
    payload: Dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime
    metadata: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        populate_by_name = True
