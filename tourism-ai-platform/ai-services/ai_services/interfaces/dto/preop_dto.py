"""DTO shared between orchestrator and agents for pre-operative flows."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class PreOpAssessment(BaseModel):
    name: str
    status: str
    findings: Dict[str, Any] = Field(default_factory=dict)


class PreOpDTO(BaseModel):
    tenant_id: str = Field(alias="tenantId")
    case_id: str = Field(alias="caseId")
    patient_id: str = Field(alias="patientId")
    timestamp: datetime
    assessments: List[PreOpAssessment] = Field(default_factory=list)
    clinical_summary: Optional[str] = Field(default=None, alias="clinicalSummary")
    metadata: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        populate_by_name = True
