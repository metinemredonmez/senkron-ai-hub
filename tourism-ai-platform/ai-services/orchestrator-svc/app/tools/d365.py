from __future__ import annotations

from typing import Any, Dict, Optional

from .base import BaseTool


class Doctor365Tool(BaseTool):
    provider_name = "doctor365"

    async def start_tourism_agent(self, case_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        endpoint = f"/external/doctor365/cases/{case_id}/start-agent"
        return await self._request("POST", endpoint, json_payload=payload)

    async def add_note(
        self,
        case_id: str,
        note: str,
        *,
        author: Optional[str] = None,
    ) -> Dict[str, Any]:
        endpoint = f"/external/doctor365/cases/{case_id}/notes"
        payload = {"note": note, "author": author}
        return await self._request("POST", endpoint, json_payload=payload)
