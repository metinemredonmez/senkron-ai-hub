from __future__ import annotations

import time
import uuid
from typing import Any, Dict


class SpeechJobStore:
    def __init__(self) -> None:
        self._jobs: Dict[str, Dict[str, Any]] = {}

    def create_job(self, job_type: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        job_id = str(uuid.uuid4())
        job = {
            "id": job_id,
            "type": job_type,
            "status": "completed",
            "createdAt": time.time(),
            "result": payload,
        }
        self._jobs[job_id] = job
        return job

    def get_job(self, job_id: str) -> Dict[str, Any] | None:
        return self._jobs.get(job_id)

    def update_job(self, job_id: str, result: Dict[str, Any]) -> Dict[str, Any]:
        job = self._jobs[job_id]
        job["result"] = result
        return job


store = SpeechJobStore()
