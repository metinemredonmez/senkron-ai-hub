from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime
from typing import AsyncIterator, Optional

try:
    from langsmith import Client as LangsmithClient
except ImportError:  # pragma: no cover
    LangsmithClient = None  # type: ignore

logger = logging.getLogger(__name__)


class LangsmithTracer:
    def __init__(self, api_key: Optional[str]):
        self._enabled = bool(api_key and LangsmithClient)
        self._client = None
        if self._enabled:
            try:
                self._client = LangsmithClient(api_key=api_key)
            except Exception as exc:  # pragma: no cover
                logger.warning("Langsmith tracer disabled: %s", exc)
                self._enabled = False

    @asynccontextmanager
    async def trace(self, node_name: str, case_id: str) -> AsyncIterator[None]:
        start = datetime.utcnow()
        status = "success"
        error_message = None
        try:
            yield
        except Exception as exc:
            status = "error"
            error_message = str(exc)
            raise
        finally:
            duration = (datetime.utcnow() - start).total_seconds()
            if self._enabled and self._client:
                try:
                    await asyncio.to_thread(
                        self._client.create_trace,
                        trace_name=node_name,
                        inputs={"caseId": case_id},
                        outputs={"status": status},
                        metadata={"duration": duration},
                    )
                except Exception as exc:  # pragma: no cover
                    logger.debug("Langsmith trace failed: %s", exc)
            else:
                logger.debug(
                    "Trace %s for %s completed: status=%s duration=%.3fs detail=%s",
                    node_name,
                    case_id,
                    status,
                    duration,
                    error_message,
                )
