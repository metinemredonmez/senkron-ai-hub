from __future__ import annotations

import re
from typing import Any, Dict

EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
PHONE_PATTERN = re.compile(r"\+?\d[\d\-\s]{7,}\d")
PASSPORT_PATTERN = re.compile(r"\b([A-Z]{1,2}\d{6,9})\b")
NATIONAL_ID_PATTERN = re.compile(r"\b\d{11}\b")

REDACTION_TOKEN = "***redacted***"


def redact_text(text: str) -> str:
    if not text:
        return text
    sanitized = EMAIL_PATTERN.sub(REDACTION_TOKEN, text)
    sanitized = PHONE_PATTERN.sub(REDACTION_TOKEN, sanitized)
    sanitized = PASSPORT_PATTERN.sub(REDACTION_TOKEN, sanitized)
    sanitized = NATIONAL_ID_PATTERN.sub(REDACTION_TOKEN, sanitized)
    return sanitized


def redact_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    sanitized: Dict[str, Any] = {}
    for key, value in payload.items():
        if isinstance(value, str):
            sanitized[key] = redact_text(value)
        elif isinstance(value, dict):
            sanitized[key] = redact_payload(value)
        elif isinstance(value, list):
            sanitized[key] = [
                redact_payload(item) if isinstance(item, dict) else redact_text(item) if isinstance(item, str) else item
                for item in value
            ]
        else:
            sanitized[key] = value
    return sanitized
