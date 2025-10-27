from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from ..config import get_settings
from ..filters.phi_redaction import redact_payload, redact_text
from ..graph.state import JourneyState
from ..utils.redis_store import RedisStore

router = APIRouter(prefix="/orchestrate", tags=["Orchestrator"])


class StartRequest(BaseModel):
    tenant_id: str = Field(alias="tenantId")
    case_id: str = Field(alias="caseId")
    patient: Dict[str, Any] = Field(default_factory=dict)
    intake: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        populate_by_name = True


class ApprovalDecision(BaseModel):
    tenant_id: str = Field(alias="tenantId")
    case_id: str = Field(alias="caseId")
    decision: str = Field(pattern=r"^(APPROVED|REJECTED)$")
    comment: Optional[str] = None

    class Config:
        populate_by_name = True


def get_graph(request: Request):
    graph = getattr(request.app.state, "graph", None)
    if graph is None:
        raise HTTPException(status_code=500, detail="Workflow graph not initialised")
    return graph


def get_redis(request: Request) -> RedisStore:
    store = getattr(request.app.state, "redis_store", None)
    if store is None:
        raise HTTPException(status_code=500, detail="Redis store unavailable")
    return store


def render_state(result: Dict[str, Any]) -> Dict[str, Any]:
    journey = JourneyState(**result)
    patient = redact_payload(journey.patient)
    intake = redact_payload(journey.intake)
    return {
        "caseId": journey.case_id,
        "tenantId": journey.tenant_id,
        "status": journey.status,
        "stage": journey.stage,
        "clinicalSummary": redact_text(journey.clinical_summary),
        "eligibility": journey.eligibility,
        "pricing": journey.pricing,
        "travelPlan": journey.travel,
        "docs": journey.docs,
        "approvals": journey.approvals,
        "itinerary": journey.itinerary,
        "aftercare": journey.aftercare,
        "disclaimers": journey.disclaimers,
        "redFlags": journey.red_flags,
        "patient": patient,
        "intake": intake,
        "updatedAt": journey.updated_at,
    }


@router.post("/start")
async def start_case(
    payload: StartRequest,
    request: Request,
    settings=Depends(get_settings),
):
    graph = get_graph(request)
    case_inputs: Dict[str, Dict[str, Dict[str, Any]]] = request.app.state.case_inputs
    tenant_cases = case_inputs.setdefault(payload.tenant_id, {})
    state = JourneyState(
        tenant_id=payload.tenant_id,
        case_id=payload.case_id,
        patient=payload.patient,
        intake=payload.intake,
    )
    result = await graph.ainvoke(
        state.to_dict(),
        config={"configurable": {"thread_id": payload.case_id}},
    )
    journey = JourneyState(**result)
    journey.add_disclaimer(settings.non_diagnostic_disclaimer)
    journey.touch()
    tenant_cases[payload.case_id] = journey.to_dict()
    return render_state(journey.to_dict())


@router.get("/state/{case_id}")
async def get_state(case_id: str, request: Request):
    store = get_redis(request)
    tenant_id = getattr(request.state, "tenant_id", "system")
    stored = await store.get_checkpoint(tenant_id, case_id)
    if not stored:
        raise HTTPException(status_code=404, detail="Case not found")
    return render_state(stored)


@router.post("/approval")
async def resolve_approval(
    payload: ApprovalDecision,
    request: Request,
    settings=Depends(get_settings),
):
    graph = get_graph(request)
    case_inputs: Dict[str, Dict[str, Dict[str, Any]]] = request.app.state.case_inputs
    tenant_cases = case_inputs.setdefault(payload.tenant_id, {})
    base_state = tenant_cases.get(payload.case_id)
    if not base_state:
        raise HTTPException(status_code=404, detail="Case context not found")
    journey = JourneyState(**base_state)
    if payload.decision.upper() == "REJECTED":
        journey.status = "on-hold"
        journey.stage = "awaiting-decision"
        journey.approvals = [
            {
                "type": "clinical_review",
                "payload": {"decision": payload.decision, "comment": payload.comment},
            }
        ]
        journey.touch()
        return render_state(journey.to_dict())

    journey.red_flags = []
    journey.approvals = []
    journey.stage = "approvals"
    journey.status = "pricing"
    result = await graph.ainvoke(
        journey.to_dict(),
        config={"configurable": {"thread_id": payload.case_id}},
    )
    next_state = JourneyState(**result)
    next_state.add_disclaimer(settings.non_diagnostic_disclaimer)
    next_state.touch()
    tenant_cases[payload.case_id] = next_state.to_dict()
    return render_state(next_state.to_dict())
