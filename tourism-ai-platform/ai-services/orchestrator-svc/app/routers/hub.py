from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Request

from ai_services.hub_core import ContextManager, HubRouter

from ..services.hub_registry import HubRegistry

router = APIRouter(prefix="/hub", tags=["Hub"])

@router.get("/agents")
async def list_agents(
    request: Request,
    registry: HubRegistry = Depends(get_hub_registry),
) -> Dict[str, Any]:
    tenant_id = getattr(request.state, "tenant_id", "system")
    agents = await registry.list_agents(tenant_id)
    return {
        "tenantId": tenant_id,
        "agents": [agent.model_dump(mode="json", by_alias=True) for agent in agents],
    }


def get_hub_router(request: Request) -> HubRouter:
    hub_router = getattr(request.app.state, "hub_router", None)
    if hub_router is None:
        raise HTTPException(status_code=500, detail="Hub router unavailable")
    return hub_router


def get_hub_registry(request: Request) -> HubRegistry:
    registry = getattr(request.app.state, "hub_registry", None)
    if registry is None:
        raise HTTPException(status_code=500, detail="Hub registry unavailable")
    return registry


def get_context_manager(request: Request) -> ContextManager:
    manager = getattr(request.app.state, "context_manager", None)
    if manager is None:
        raise HTTPException(status_code=500, detail="Context manager unavailable")
    return manager


@router.post("/events/publish")
async def publish_event(event: Dict[str, Any], router: HubRouter = Depends(get_hub_router)) -> Dict[str, Any]:
    event = dict(event)
    event.setdefault("timestamp", datetime.now(timezone.utc).isoformat())
    return await router.handle_rest_payload(event)


@router.post("/events/{event_id}/replay")
async def replay_event(event_id: str, router: HubRouter = Depends(get_hub_router)) -> Dict[str, Any]:
    result = await router.replay_event(event_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return result


@router.get("/registry")
async def list_registry(
    request: Request,
    registry: HubRegistry = Depends(get_hub_registry),
) -> List[Dict[str, Any]]:
    tenant_id = getattr(request.state, "tenant_id", None)
    agents = await registry.list_agents(tenant_id)
    return [agent.model_dump(mode="json", by_alias=True) for agent in agents]


@router.get("/tenants")
async def list_tenants(registry: HubRegistry = Depends(get_hub_registry)) -> List[Dict[str, Any]]:
    tenants = await registry.list_tenants()
    return [tenant.model_dump(mode="json", by_alias=True) for tenant in tenants]


@router.get("/events")
async def list_events(
    request: Request,
    manager: ContextManager = Depends(get_context_manager),
    limit: int = 50,
) -> List[Dict[str, Any]]:
    tenant_id = getattr(request.state, "tenant_id", None)
    stream_suffix = getattr(request.app.state, "hub_stream", "hub:events")
    stream = f"{tenant_id}:{stream_suffix}" if tenant_id else f"system:{stream_suffix}"
    entries = await manager.read_stream(stream, count=limit)
    events: List[Dict[str, Any]] = []
    for entry_id, data in entries:
        raw = data.get(b"data") or data.get("data")
        if isinstance(raw, bytes):
            raw = raw.decode("utf-8")
        payload = json.loads(raw) if isinstance(raw, str) else raw
        events.append({"id": entry_id, "payload": payload})
    return events


@router.post("/clients/{tenant_id}/{client_id}/heartbeat")
async def heartbeat_client(
    tenant_id: str,
    client_id: str,
    registry: HubRegistry = Depends(get_hub_registry),
) -> Dict[str, str]:
    registry.heartbeat_client(tenant_id, client_id)
    return {"status": "ok"}


@router.get("/clients")
async def list_clients(registry: HubRegistry = Depends(get_hub_registry)) -> Dict[str, Any]:
    return registry.list_clients()
