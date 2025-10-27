"""FastAPI application entry point for AI services."""
from __future__ import annotations

import logging
from typing import Any, Dict

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Tourism AI Services", version="0.1.0")

# Configure CORS for local development as well as deployed origins.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class QueryRequest(BaseModel):
    """Schema for incoming AI query requests."""

    query: str
    context: Dict[str, Any] | None = None


class QueryResponse(BaseModel):
    """Schema for AI query responses."""

    message: str
    data: Dict[str, Any] | None = None


@app.on_event("startup")
async def startup_event() -> None:
    """Application startup hook to configure logging."""
    logging.basicConfig(level=logging.INFO)
    logging.info("AI service starting up")


@app.get("/health", tags=["health"])
async def health() -> Dict[str, str]:
    """Simple health-check endpoint."""
    return {"status": "ok"}


@app.post("/api/v1/query", response_model=QueryResponse, tags=["query"])
async def query_ai(payload: QueryRequest) -> QueryResponse:
    """Handle AI queries (placeholder implementation)."""
    if not payload.query:
        raise HTTPException(status_code=400, detail="Query text is required")

    # TODO: integrate LangChain / LangGraph pipeline.
    logging.info("Received query: %s", payload.query)
    return QueryResponse(message="AI response placeholder", data={"echo": payload.query})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
