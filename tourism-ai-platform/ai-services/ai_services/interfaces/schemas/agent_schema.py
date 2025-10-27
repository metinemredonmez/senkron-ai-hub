"""Pydantic schema describing a registered AI agent."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, HttpUrl


class AgentCapability(BaseModel):
    """Capability flag exposed by an AI agent."""

    name: str
    description: Optional[str] = None
    version: Optional[str] = None


class AgentSchema(BaseModel):
    id: str
    name: str
    endpoint: HttpUrl = Field(..., description="Primary execution endpoint")
    display_name: Optional[str] = None
    version: Optional[str] = None
    owner: Optional[str] = None
    capabilities: List[AgentCapability] = Field(default_factory=list)
    supported_channels: List[str] = Field(default_factory=list)
    tenants: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        allow_population_by_field_name = True
