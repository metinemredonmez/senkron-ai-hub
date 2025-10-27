"""Tenant schema shared across hub services."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class TenantSchema(BaseModel):
    id: str
    role: Optional[str] = None
    organization: Optional[str] = None
    name: Optional[str] = None
    environment: Optional[str] = None
    env_vars: Dict[str, str] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[datetime] = Field(default=None, alias="createdAt")
    updated_at: Optional[datetime] = Field(default=None, alias="updatedAt")

    class Config:
        populate_by_name = True
