from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from langgraph.checkpoint.memory import MemorySaver
try:
    from langgraph.checkpoint.redis import RedisSaver  # type: ignore
except ImportError:  # pragma: no cover
    RedisSaver = None  # type: ignore
from langgraph.graph import END, StateGraph
from opentelemetry import trace

from ..filters.phi_redaction import redact_payload, redact_text
from ..middleware.langsmith_trace import LangsmithTracer
from ..tools.amadeus import AmadeusTool
from ..tools.d365 import Doctor365Tool
from ..tools.s3 import S3Tool
from ..utils.kafka_producer import KafkaEventProducer, emit_case_event
from ..utils.redis_store import RedisStore
from .state import JourneyState, NON_DIAGNOSTIC_DISCLAIMER

logger = logging.getLogger(__name__)
tracer = trace.get_tracer("ai-orchestrator.workflow")

redis_store: Optional[RedisStore] = None
kafka_producer: Optional[KafkaEventProducer] = None
langsmith_tracer: LangsmithTracer = LangsmithTracer(None)
doctor365_tool: Optional[Doctor365Tool] = None
amadeus_tool: Optional[AmadeusTool] = None
s3_tool: Optional[S3Tool] = None

CASE_CREATED_TOPIC = "case.created"
APPROVAL_REQUIRED_TOPIC = "approval.required"
TRAVEL_TOPIC = "travel.offer.generated"
PAYMENT_TOPIC = "payment.succeeded"
DOC_TOPIC = "doc.uploaded"


async def _persist_checkpoint(state: JourneyState) -> None:
    if redis_store is None:
        return
    payload = state.to_dict()
    await redis_store.set_checkpoint(state.tenant_id, state.case_id, payload)


async def _emit(topic: str, state: JourneyState, payload: Dict[str, Any]) -> None:
    if kafka_producer is None:
        return
    await emit_case_event(
        kafka_producer,
        topic,
        tenant_id=state.tenant_id,
        case_id=state.case_id,
        payload=payload,
    )


def configure_workflow_dependencies(
    *,
    redis: RedisStore,
    kafka: KafkaEventProducer,
    langsmith: LangsmithTracer,
    d365: Doctor365Tool,
    amadeus: AmadeusTool,
    s3: S3Tool,
) -> None:
    global redis_store, kafka_producer, langsmith_tracer, doctor365_tool, amadeus_tool, s3_tool
    redis_store = redis
    kafka_producer = kafka
    langsmith_tracer = langsmith
    doctor365_tool = d365
    amadeus_tool = amadeus
    s3_tool = s3


async def _with_span(node_name: str, state: JourneyState, handler):
    async with langsmith_tracer.trace(node_name, state.case_id):
        with tracer.start_as_current_span(f"node.{node_name}") as span:
            span.set_attribute("case_id", state.case_id)
            span.set_attribute("tenant_id", state.tenant_id)
            span.set_attribute("event_type", f"node.{node_name}")
            span.set_attribute("request_id", state.case_id)
            span.set_attribute("stage", state.stage)
            result = await handler(span)
            if isinstance(result, JourneyState):
                span.set_attribute("stage.next", result.stage)
            return result


async def intake_node(state: JourneyState) -> JourneyState:
    async def handler(span):
        state.stage = "intake"
        state.status = "intake"
        state.transcript.append("Intake received and recorded.")
        state.add_disclaimer(NON_DIAGNOSTIC_DISCLAIMER)
        state.touch()
        if doctor365_tool:
            try:
                payload = await doctor365_tool.start_tourism_agent(
                    state.case_id,
                    {"tenantId": state.tenant_id, "intake": redact_payload(state.intake)},
                )
                span.set_attribute("d365.sessionId", payload.get("sessionId", ""))
            except Exception as exc:  # pragma: no cover
                logger.warning("Doctor365 start agent failed: %s", exc)
        await _persist_checkpoint(state)
        await _emit(CASE_CREATED_TOPIC, state, {"stage": state.stage})
        state.stage = "eligibility"
        state.status = "eligibility"
        return state

    return await _with_span("intake", state, handler)


async def eligibility_node(state: JourneyState) -> JourneyState:
    async def handler(span):
        metrics = state.intake.get("metrics", {})
        bmi = metrics.get("bmi", 24)
        status = "eligible" if bmi < 32 else "needs-review"
        state.eligibility = {
            "status": status,
            "bmi": bmi,
            "notes": [
                "BMI within acceptable range" if status == "eligible" else "BMI requires clinical oversight"
            ],
        }
        if status != "eligible":
            state.red_flags.append("clinical_review_required")
        state.stage = "provider_match"
        state.status = "eligibility"
        state.touch()
        await _persist_checkpoint(state)
        return state

    return await _with_span("eligibility", state, handler)


async def provider_match_node(state: JourneyState) -> JourneyState:
    async def handler(span):
        preferences = state.intake.get("travelPreferences", {})
        provider_payload = {
            "primary": {
                "id": "provider-istanbul-1",
                "name": "Istanbul Care Hospital",
                "score": 0.92,
                "language_support": ["en", "tr"],
            },
            "alternatives": [
                {"id": "provider-ankara-1", "name": "Ankara Ortho Center", "score": 0.88}
            ],
            "preferences": preferences,
        }
        state.docs["provider_match"] = provider_payload
        if doctor365_tool:
            note = f"Matched providers for case {state.case_id}"
            try:
                await doctor365_tool.add_note(state.case_id, note)
            except Exception as exc:  # pragma: no cover
                logger.debug("Doctor365 add note failed: %s", exc)
        state.stage = "pricing"
        state.status = "provider-match"
        state.touch()
        await _persist_checkpoint(state)
        return state

    return await _with_span("provider_match", state, handler)


async def pricing_node(state: JourneyState) -> JourneyState:
    async def handler(span):
        base_price = 6200
        travel_allowance = 900
        budget = state.intake.get("budget", {}).get("maxAmount")
        if budget:
            base_price = min(base_price, float(budget))
        total = float(base_price + travel_allowance)
        state.pricing = {
            "currency": "EUR",
            "total": total,
            "travel": float(travel_allowance),
            "breakdown": {
                "procedure": float(base_price - 1200),
                "hospital": 1200.0,
                "travel": float(travel_allowance),
            },
            "disclaimer": NON_DIAGNOSTIC_DISCLAIMER,
        }
        state.stage = "travel"
        state.status = "pricing"
        state.touch()
        await _persist_checkpoint(state)
        await _emit(PAYMENT_TOPIC, state, {"amount": total, "currency": "EUR"})
        return state

    return await _with_span("pricing", state, handler)


async def travel_node(state: JourneyState) -> JourneyState:
    async def handler(span):
        flights: Dict[str, Any] = {}
        hotels: Dict[str, Any] = {}
        preferences = state.intake.get("travelPreferences", {})
        try:
            if amadeus_tool:
                flights = await amadeus_tool.search_flights({"preferences": preferences})
                hotels = await amadeus_tool.search_hotels({"preferences": preferences})
        except Exception as exc:  # pragma: no cover
            logger.warning("Amadeus search fallback: %s", exc)
            departure = datetime.utcnow() + timedelta(days=21)
            flights = {
                "itineraries": [
                    {
                        "carrier": "TK",
                        "number": "TK34",
                        "origin": "LHR",
                        "destination": "IST",
                        "departure": departure.isoformat(),
                    }
                ]
            }
            hotels = {"options": [{"name": "Harbiye Surgical Suites", "nights": 7}]}
        state.travel = {
            "flights": flights.get("itineraries") or flights,
            "hotels": hotels.get("options") or hotels,
        }
        state.stage = "docs_visa"
        state.status = "travel"
        state.touch()
        await _persist_checkpoint(state)
        await _emit(TRAVEL_TOPIC, state, {"offers": redact_payload(state.travel)})
        return state

    return await _with_span("travel", state, handler)


async def docs_visa_node(state: JourneyState) -> JourneyState:
    async def handler(span):
        documents = [
            {"name": "Passport copy", "status": "required"},
            {"name": "Medical history", "status": "required"},
            {"name": "Treatment plan", "status": "optional"},
        ]
        state.docs["visa_requirements"] = {
            "documents": documents,
            "processing_time_days": 10,
            "disclaimer": NON_DIAGNOSTIC_DISCLAIMER,
        }
        if s3_tool:
            sample_key = f"{state.case_id}/checklist.json"
            try:
                await s3_tool.upload(sample_key, b"{}", content_type="application/json")
                presigned = await s3_tool.generate_presigned_url(sample_key, expires=3600)
                state.docs["uploadLink"] = presigned
            except Exception as exc:  # pragma: no cover
                logger.debug("S3 upload skipped: %s", exc)
        state.stage = "approvals"
        state.status = "docs"
        state.touch()
        await _persist_checkpoint(state)
        await _emit(DOC_TOPIC, state, {"documents": redact_payload({"items": documents})})
        return state

    return await _with_span("docs_visa", state, handler)


async def approvals_node(state: JourneyState) -> JourneyState:
    async def handler(span):
        state.approvals = []
        if state.red_flags:
            state.approvals.append(
                {
                    "id": f"approval-{state.case_id}",
                    "type": "clinical_review",
                    "payload": {"flags": state.red_flags},
                }
            )
            state.stage = "awaiting-approval"
            state.status = "awaiting-approval"
            state.touch()
            await _persist_checkpoint(state)
            await _emit(APPROVAL_REQUIRED_TOPIC, state, {"flags": state.red_flags})
        else:
            state.stage = "itinerary"
            state.status = "approved"
            state.touch()
            await _persist_checkpoint(state)
        return state

    return await _with_span("approvals", state, handler)


def approvals_branch(state: JourneyState) -> str:
    if state.approvals:
        return "awaiting"
    return "continue"


async def itinerary_node(state: JourneyState) -> JourneyState:
    async def handler(span):
        start = datetime.utcnow() + timedelta(days=22)
        itinerary = [
            {"id": "consult-1", "title": "Pre-op consultation", "start": start.isoformat()},
            {
                "id": "surgery",
                "title": redact_text(state.intake.get("targetProcedure", "Procedure")),
                "start": (start + timedelta(days=1)).isoformat(),
            },
        ]
        state.itinerary = {"events": itinerary, "disclaimer": NON_DIAGNOSTIC_DISCLAIMER}
        state.stage = "aftercare"
        state.status = "itinerary"
        state.touch()
        await _persist_checkpoint(state)
        return state

    return await _with_span("itinerary", state, handler)


async def aftercare_node(state: JourneyState) -> JourneyState:
    async def handler(span):
        state.aftercare = {
            "virtual_followups": 3,
            "local_clinic": "Partner Clinic - London",
            "disclaimer": NON_DIAGNOSTIC_DISCLAIMER,
        }
        state.stage = "completed"
        state.status = "completed"
        state.touch()
        await _persist_checkpoint(state)
        return state

    return await _with_span("aftercare", state, handler)


def compile_workflow(*, redis_url: str | None = None, namespace: str = "orchestrator"):
    workflow = StateGraph(JourneyState)
    workflow.add_node("intake_step", intake_node)
    workflow.add_node("eligibility_step", eligibility_node)
    workflow.add_node("provider_match_step", provider_match_node)
    workflow.add_node("pricing_step", pricing_node)
    workflow.add_node("travel_step", travel_node)
    workflow.add_node("docs_visa_step", docs_visa_node)
    workflow.add_node("approvals_step", approvals_node)
    workflow.add_node("itinerary_step", itinerary_node)
    workflow.add_node("aftercare_step", aftercare_node)

    workflow.add_edge("intake_step", "eligibility_step")
    workflow.add_edge("eligibility_step", "provider_match_step")
    workflow.add_edge("provider_match_step", "pricing_step")
    workflow.add_edge("pricing_step", "travel_step")
    workflow.add_edge("travel_step", "docs_visa_step")
    workflow.add_edge("docs_visa_step", "approvals_step")
    workflow.add_conditional_edges(
        "approvals_step",
        approvals_branch,
        {"awaiting": END, "continue": "itinerary_step"},
    )
    workflow.add_edge("itinerary_step", "aftercare_step")
    workflow.add_edge("aftercare_step", END)

    workflow.set_entry_point("intake_step")

    checkpointer = MemorySaver()
    if redis_url and RedisSaver:
        try:
            checkpointer = RedisSaver(redis_url, namespace=namespace)  # type: ignore[arg-type]
        except Exception as exc:  # pragma: no cover
            logger.debug("Redis checkpoint initialisation failed: %s", exc)
    return workflow.compile(checkpointer=checkpointer)
