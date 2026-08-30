from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.utils.sanitization import sanitize_text


class IngestEventRequest(BaseModel):
    user_id: int | None = None
    ip_address: str = Field(min_length=2, max_length=128)
    device: str = Field(min_length=2, max_length=255)
    event_type: str = Field(min_length=2, max_length=128)
    status: str = Field(min_length=2, max_length=64)
    timestamp: datetime
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("ip_address", "device", "event_type", "status")
    @classmethod
    def sanitize_fields(cls, value: str) -> str:
        return sanitize_text(value)

    @field_validator("timestamp")
    @classmethod
    def normalize_timestamp(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)


class IngestAcceptedResponse(BaseModel):
    status: str
    message: str
    audit_log_id: int
    queued: bool
    queue_size: int


class TestEventResponse(IngestAcceptedResponse):
    event_kind: str
    payload: dict[str, Any]
