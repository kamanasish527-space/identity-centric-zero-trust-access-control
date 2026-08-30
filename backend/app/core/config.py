from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "AI Zero Trust Access Control Platform"
    api_v1_str: str = "/api/v1"
    debug: bool = False

    database_url: str = "sqlite:///./zerotrust.db"

    secret_key: str = Field(default="change-me-in-env")
    refresh_secret_key: str = Field(default="change-me-refresh-in-env")
    csrf_secret: str = Field(default="change-me-csrf-in-env")

    access_token_expire_minutes: int = 15
    refresh_token_expire_minutes: int = 60 * 24 * 7

    algorithm: str = "HS256"

    allowed_origins: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
    ]

    cookie_secure: bool = False
    cookie_samesite: str = "strict"

    rate_limit_api: str = "120/minute"
    rate_limit_login: str = "5/minute"

    max_failed_logins: int = 5
    account_lock_minutes: int = 30

    default_session_monitor_interval_seconds: int = 20

    log_level: str = "INFO"

    bootstrap_admin_username: str | None = None
    bootstrap_admin_email: str | None = None
    bootstrap_admin_password: str | None = None

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def split_allowed_origins(cls, value):
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
