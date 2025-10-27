from __future__ import annotations

import hashlib
from typing import Dict, List, Tuple

from rapidfuzz import fuzz


class RAGMemoryStore:
    def __init__(self) -> None:
        self._store: Dict[str, List[Dict]] = {}

    def ingest(self, tenant: str, text: str, metadata: Dict[str, str]) -> str:
        collection = self._store.setdefault(tenant, [])
        doc_id = hashlib.sha256(text.encode("utf-8")).hexdigest()
        collection.append({
            "id": doc_id,
            "text": text,
            "metadata": metadata,
        })
        return doc_id

    def query(self, tenant: str, prompt: str, limit: int = 3) -> List[Tuple[Dict, int]]:
        collection = self._store.get(tenant, [])
        results: List[Tuple[Dict, int]] = []
        for doc in collection:
            score = fuzz.token_set_ratio(prompt, doc["text"])
            results.append((doc, score))
        results.sort(key=lambda item: item[1], reverse=True)
        return results[:limit]


store = RAGMemoryStore()
