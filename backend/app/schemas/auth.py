import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.user import UserRole
from app.utils.sanitization import sanitize_text


PASSWORD_COMPLEXITY_REGEX = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{12,128}$")
USERNAME_REGEX = re.compile(r"^[a-zA-Z0-9_.-]{3,50}$")


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        value = sanitize_text(value)
        if not USERNAME_REGEX.match(value):
            raise ValueError("Username must be 3-50 chars and use letters, numbers, _, -, .")
        return value

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if not PASSWORD_COMPLEXITY_REGEX.match(value):
            raise ValueError(
                "Password must be 12+ chars and include upper, lower, number, and special character"
            )
        return value


class LoginRequest(BaseModel):
    identifier: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    device_fingerprint: str = Field(min_length=8, max_length=255)
    location: str = Field(min_length=2, max_length=255)
    protocol: str = Field(default="https", min_length=2, max_length=16)
    simulated_phishing: bool = False

    @field_validator("identifier", "device_fingerprint", "location", "protocol")
    @classmethod
    def sanitize_fields(cls, value: str) -> str:
        return sanitize_text(value)


class StepUpVerifyRequest(BaseModel):
    challenge_id: str = Field(min_length=8, max_length=64)
    otp_code: str = Field(min_length=4, max_length=10)
    device_fingerprint: str = Field(min_length=8, max_length=255)
    location: str = Field(min_length=2, max_length=255)
    protocol: str = Field(default="https", min_length=2, max_length=16)

    @field_validator("challenge_id", "otp_code", "device_fingerprint", "location", "protocol")
    @classmethod
    def sanitize_fields(cls, value: str) -> str:
        return sanitize_text(value)


class RefreshTokenRequest(BaseModel):
    refresh_token: str | None = None


class LoginResponse(BaseModel):
    status: str
    message: str
    decision: str
    risk_score: float
    risk_level: str
    access_token: str | None = None
    refresh_token: str | None = None
    csrf_token: str | None = None
    token_type: str = "bearer"
    expires_in: int | None = None
    refresh_expires_in: int | None = None
    session_id: str | None = None
    challenge_id: str | None = None
    otp_hint: str | None = None


class TokenRefreshResponse(BaseModel):
    access_token: str
    refresh_token: str
    csrf_token: str
    token_type: str = "bearer"
    expires_in: int
    refresh_expires_in: int


class UserMeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: EmailStr
    role: UserRole
    is_locked: bool
    is_active: bool
    last_login_at: datetime | None
    created_at: datetime
