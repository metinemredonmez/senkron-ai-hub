"""Security event DTO for the Synchron AI Hub."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class SecurityEventDTO(BaseModel):
    id: str
    tenant_id: str = Field(alias="tenantId")
    actor: str
    action: str
    severity: str = Field(default="info")
    timestamp: datetime
    source_ip: Optional[str] = Field(default=None, alias="sourceIp")
    resource: Optional[str] = None
    payload: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        populate_by_name = True
