from __future__ import annotations

from datetime import datetime
from typing import Any, Dict

from fastapi import APIRouter, Request
from pydantic import BaseModel

router = APIRouter(prefix="/rec", tags=["personalization"])


class NextBestRequest(BaseModel):
    case_id: str
    stage: str
    history: Dict[str, Any] | None = None


class JourneyHintsRequest(BaseModel):
    case_id: str
    itinerary: Dict[str, Any] | None = None


@router.post("/next-best")
async def next_best(request: Request, payload: NextBestRequest):
    event = {
        "timestamp": datetime.utcnow().isoformat(),
        "caseId": payload.case_id,
        "stage": payload.stage,
        "type": "next-best",
    }
    request.app.state.logs.append(event)
    action = "schedule-consultation" if payload.stage == "pricing" else "send-education"
    return {
        "caseId": payload.case_id,
        "recommendedAction": action,
        "explanation": "Based on engagement history and current stage",
    }


@router.post("/journey-hints")
async def journey_hints(request: Request, payload: JourneyHintsRequest):
    event = {
        "timestamp": datetime.utcnow().isoformat(),
        "caseId": payload.case_id,
        "type": "journey-hints",
    }
    request.app.state.logs.append(event)
    hints = [
        "Share recovery checklist",
        "Offer virtual nurse chat",
    ]
    return {
        "caseId": payload.case_id,
        "hints": hints,
    }
