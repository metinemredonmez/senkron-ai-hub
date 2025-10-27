"""DTO for post-operative workflows."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class PostOpFollowUp(BaseModel):
    name: str
    due_date: datetime = Field(alias="dueDate")
    completed: bool = False
    notes: Optional[str] = None

    class Config:
        populate_by_name = True


class PostOpDTO(BaseModel):
    tenant_id: str = Field(alias="tenantId")
    case_id: str = Field(alias="caseId")
    patient_id: str = Field(alias="patientId")
    timestamp: datetime
    follow_up: List[PostOpFollowUp] = Field(default_factory=list, alias="followUp")
    complications: List[str] = Field(default_factory=list)
    recommendations: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        populate_by_name = True
