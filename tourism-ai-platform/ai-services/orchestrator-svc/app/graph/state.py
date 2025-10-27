from __future__ import annotations

from typing import Any, Dict, List, Optional
from datetime import datetime

from pydantic import BaseModel, Field
NON_DIAGNOSTIC_DISCLAIMER = (
    "This platform provides educational, non-diagnostic support only. All medical decisions must be validated by licensed clinicians."
)


class JourneyState(BaseModel):
    tenant_id: str
    case_id: str
    intake: Dict[str, Any] = Field(default_factory=dict)
    patient: Dict[str, Any] = Field(default_factory=dict)
    stage: str = "intake"
    status: str = "intake"
    clinical_summary: str = ""
    eligibility: Dict[str, Any] = Field(default_factory=dict)
    pricing: Dict[str, Any] = Field(default_factory=dict)
    travel: Dict[str, Any] = Field(default_factory=dict)
    docs: Dict[str, Any] = Field(default_factory=dict)
    approvals: List[Dict[str, Any]] = Field(default_factory=list)
    itinerary: Dict[str, Any] = Field(default_factory=dict)
    aftercare: Dict[str, Any] = Field(default_factory=dict)
    disclaimers: List[str] = Field(
        default_factory=lambda: [NON_DIAGNOSTIC_DISCLAIMER]
    )
    red_flags: List[str] = Field(default_factory=list)
    transcript: List[str] = Field(default_factory=list)
    updated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

    class Config:
        arbitrary_types_allowed = True

    def add_disclaimer(self, text: str) -> None:
        if text not in self.disclaimers:
            self.disclaimers.append(text)

    def touch(self) -> None:
        self.updated_at = datetime.utcnow().isoformat()

    def to_dict(self) -> Dict[str, Any]:
        return self.model_dump()
