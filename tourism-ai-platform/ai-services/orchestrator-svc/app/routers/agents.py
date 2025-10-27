from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from ai_services.interfaces.schemas.event_schema import HubEvent

from ..services.agent_executor import AgentExecutor
from ..services.hub_registry import HubRegistry
from ..services.tenant_context import TenantContextService

router = APIRouter(prefix="/agents", tags=["Agents"])


def get_agent_executor(request: Request) -> AgentExecutor:
    executor = getattr(request.app.state, "agent_executor", None)
    if executor is None:
        raise HTTPException(status_code=500, detail="Agent executor unavailable")
    return executor


def get_hub_registry(request: Request) -> HubRegistry:
    registry = getattr(request.app.state, "hub_registry", None)
    if registry is None:
        raise HTTPException(status_code=500, detail="Hub registry unavailable")
    return registry


def get_tenant_context(request: Request) -> TenantContextService:
    service = getattr(request.app.state, "tenant_context", None)
    if service is None:
        raise HTTPException(status_code=500, detail="Tenant context unavailable")
    return service


class AgentRunRequest(BaseModel):
    tenant_id: str = Field(alias="tenantId")
    payload: Dict[str, Any] = Field(default_factory=dict)
    session_id: str | None = Field(default=None, alias="sessionId")
    channel: str | None = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        populate_by_name = True


@router.post("/{agent_name}/run")
async def run_agent(
    agent_name: str,
    payload: AgentRunRequest,
    executor: AgentExecutor = Depends(get_agent_executor),
    registry: HubRegistry = Depends(get_hub_registry),
    tenant_context: TenantContextService = Depends(get_tenant_context),
) -> Dict[str, Any]:
    agent = await registry.get_agent(agent_name, payload.tenant_id)
    if agent is None:
        raise HTTPException(status_code=404, detail=f"Agent {agent_name} not registered")
    event = HubEvent(
        id=payload.metadata.get("eventId") or str(uuid4()),
        tenant_id=payload.tenant_id,
        event_type=payload.metadata.get("eventType", "agent.direct"),
        source="orchestrator",
        timestamp=datetime.now(timezone.utc),
        payload=payload.payload,
        session_id=payload.session_id,
        agent_name=agent_name,
        channel=payload.channel,
        metadata=payload.metadata,
    )
    session_context = None
    if payload.session_id:
        session_context = await tenant_context.get_session_state(
            payload.tenant_id, payload.session_id
        )
    result = await executor.execute(
        agent=agent,
        tenant_id=payload.tenant_id,
        payload=payload.payload,
        event=event,
        session_context=session_context,
        channel=payload.channel,
    )
    return {"status": "completed", "agent": agent_name, "result": result}
