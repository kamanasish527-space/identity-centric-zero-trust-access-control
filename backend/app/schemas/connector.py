from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.utils.sanitizers import sanitize_text


class ConnectorCreateRequest(BaseModel):
    name: str = Field(min_length=3, max_length=120)
    description: str | None = Field(default=None, max_length=255)
    allowed_ips: list[str] = Field(default_factory=list)

    @field_validator("name", "description", mode="before")
    @classmethod
    def clean_text(cls, value):
        if value is None:
            return value
        return sanitize_text(str(value))

    @field_validator("allowed_ips", mode="before")
    @classmethod
    def normalize_ips(cls, value):
        if value is None:
            return []
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value


class ConnectorSummary(BaseModel):
    connector_id: str
    name: str
    description: str | None
    allowed_ips: list[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime | None = None
    last_used_at: datetime | None = None
    last_used_ip: str | None = None


class ConnectorSecretResponse(BaseModel):
    connector_id: str
    name: str
    api_key: str
    description: str | None
    allowed_ips: list[str]
    is_active: bool


class ConnectorAuthContext(BaseModel):
    connector_id: str
    name: str
    allowed_ips: list[str]
    authenticated_at: datetime
