from __future__ import annotations

from typing import Optional

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from opentelemetry import trace

TENANT_HEADER = "x-tenant"


class TenantContextMiddleware(BaseHTTPMiddleware):
    """Inject tenant information into request state for orchestrator routes."""

    async def dispatch(self, request: Request, call_next) -> Response:
        tenant_id = self._resolve_tenant(request) or "system"
        if tenant_id:
            request.state.tenant_id = tenant_id
            request.scope["tenant_id"] = tenant_id
            self._annotate_trace(tenant_id)
        response = await call_next(request)
        if tenant_id:
            response.headers.setdefault("X-Tenant", tenant_id)
        return response

    def _resolve_tenant(self, request: Request) -> Optional[str]:
        header = request.headers.get(TENANT_HEADER) or request.headers.get(TENANT_HEADER.upper())
        if header:
            return header
        # Fallback to JSON payload fields if header is missing
        tenant_from_scope = request.scope.get("tenant_id")
        if isinstance(tenant_from_scope, str):
            return tenant_from_scope
        return None

    @staticmethod
    def _annotate_trace(tenant_id: str) -> None:
        span = trace.get_current_span()
        if span and tenant_id:
            span.set_attribute("tenant_id", tenant_id)
