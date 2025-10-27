from __future__ import annotations

from typing import Any, Dict, Optional

from .base import BaseTool


class AmadeusTool(BaseTool):
    provider_name = "amadeus"

    async def search_flights(self, query: Dict[str, Any]) -> Dict[str, Any]:
        return await self._request("POST", "/travel/flights/search", json_payload=query)

    async def search_hotels(self, query: Dict[str, Any]) -> Dict[str, Any]:
        return await self._request("POST", "/travel/hotels/search", json_payload=query)

    async def recommend_bundle(self, case_id: str, preferences: Dict[str, Any]) -> Dict[str, Any]:
        payload = {"caseId": case_id, "preferences": preferences}
        return await self._request("POST", "/travel/bundles", json_payload=payload)
