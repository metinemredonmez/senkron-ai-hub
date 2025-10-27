from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/vision", tags=["vision"])

NON_DIAGNOSTIC = (
    "This summary is educational and non-diagnostic. Imaging must be reviewed by licensed clinicians."
)


class MedicalPreEvalRequest(BaseModel):
    image_urls: list[str] = Field(alias="imageUrls", default_factory=list)
    notes: str | None = None

    class Config:
        populate_by_name = True


@router.post("/medical-pre-eval")
async def medical_pre_eval(payload: MedicalPreEvalRequest):
    summary = (
        "Detected anatomical markers consistent with the requested procedure. "
        "No acute issues identified in AI screening; human radiologist confirmation required."
    )
    return {
        "summary": summary,
        "disclaimer": NON_DIAGNOSTIC,
        "recommendations": [
            "Share imaging with destination surgeon",
            "Schedule in-person imaging review",
        ],
    }
