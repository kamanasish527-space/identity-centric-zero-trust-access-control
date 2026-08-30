from datetime import datetime

from pydantic import BaseModel


class SessionHeartbeatRequest(BaseModel):
    device_fingerprint: str
    location: str
    protocol: str = "https"


class SessionTerminateResponse(BaseModel):
    session_id: str
    is_active: bool
    terminated_at: datetime | None
    termination_reason: str | None
