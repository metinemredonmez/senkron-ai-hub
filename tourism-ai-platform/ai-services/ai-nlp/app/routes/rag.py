from __future__ import annotations

import io
from typing import Any, Dict, List

from bs4 import BeautifulSoup
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from PyPDF2 import PdfReader
from pydantic import BaseModel

from ..config import get_settings
from ..services.rag_store import store

router = APIRouter(prefix="/rag", tags=["rag"])


class QueryRequest(BaseModel):
    tenant_id: str = "default"
    query: str
    top_k: int = 3


def extract_text(upload: UploadFile) -> str:
    content = upload.file.read()
    upload.file.seek(0)
    if upload.filename and upload.filename.lower().endswith(".pdf"):
        reader = PdfReader(io.BytesIO(content))
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
        return text
    if upload.filename and upload.filename.lower().endswith(('.md', '.markdown')):
        return content.decode("utf-8")
    if upload.filename and upload.filename.lower().endswith('.html'):
        soup = BeautifulSoup(content, "html.parser")
        return soup.get_text(separator="\n")
    return content.decode("utf-8")


@router.post("/ingest")
async def ingest(
    request: Request,
    file: UploadFile = File(...),
    language: str = "en",
    tags: str | None = None,
    settings=Depends(get_settings),
):
    tenant = request.headers.get("x-tenant") or "default"
    text = extract_text(file)
    if not text.strip():
        raise HTTPException(status_code=400, detail="Empty document")
    metadata = {
        "filename": file.filename,
        "language": language,
        "tags": tags.split(",") if tags else [],
        "qdrant": settings.qdrant_enabled,
    }
    doc_id = store.ingest(tenant, text, metadata)
    return {"documentId": doc_id, "tenantId": tenant}


@router.post("/query")
async def query(payload: QueryRequest) -> Dict[str, Any]:
    matches = store.query(payload.tenant_id, payload.query, payload.top_k)
    answer = "Relevant information could not be generated."
    sources: List[Dict[str, Any]] = []
    if matches:
        context = "\n".join(doc["text"] for doc, score in matches)
        answer = f"Based on available packages: {context[:400]}..."
        sources = [
            {
                "id": doc["id"],
                "score": score,
                "metadata": doc["metadata"],
            }
            for doc, score in matches
        ]
    return {"answer": answer, "sources": sources}
