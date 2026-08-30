import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings


pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


class TokenError(Exception):
    pass


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def generate_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def _create_token(data: Dict[str, Any], expires_delta: timedelta, secret_key: str) -> str:
    payload = data.copy()
    now = datetime.now(tz=timezone.utc)
    payload.update({"iat": int(now.timestamp()), "exp": int((now + expires_delta).timestamp())})
    return jwt.encode(payload, secret_key, algorithm=settings.algorithm)


def create_access_token(data: Dict[str, Any]) -> str:
    expires = timedelta(minutes=settings.access_token_expire_minutes)
    return _create_token(data=data, expires_delta=expires, secret_key=settings.secret_key)


def create_refresh_token(data: Dict[str, Any]) -> str:
    expires = timedelta(minutes=settings.refresh_token_expire_minutes)
    return _create_token(data=data, expires_delta=expires, secret_key=settings.refresh_secret_key)


def decode_token(token: str, secret_key: str) -> Dict[str, Any]:
    try:
        return jwt.decode(token, secret_key, algorithms=[settings.algorithm])
    except JWTError as exc:
        raise TokenError("Invalid token") from exc
