from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class APIError(BaseModel):
    code: str
    message: str
    details: Any | None = None


class APIErrorResponse(BaseModel):
    error: APIError


class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
