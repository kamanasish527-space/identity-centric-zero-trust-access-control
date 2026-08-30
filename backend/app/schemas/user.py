from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.user import UserRole


class UserSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: EmailStr
    role: UserRole
    is_active: bool
    is_locked: bool
    failed_login_attempts: int
    lock_until: datetime | None
    created_at: datetime
    last_login_at: datetime | None


class UserSecurityProfile(BaseModel):
    user_id: int
    trust_score: float
    trust_level: str
    current_risk_score: float
    current_risk_level: str
    average_login_hour: float
    known_locations: list[str]
    known_device_fingerprints: list[str]
    ip_history: list[str]
    access_frequency_per_day: float
