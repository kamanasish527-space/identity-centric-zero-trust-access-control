from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_client_ip, get_current_user, get_token_payload, require_csrf
from app.core.config import settings
from app.core.rate_limiter import limiter
from app.db.session import get_db
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    RefreshTokenRequest,
    TokenRefreshResponse,
    UserMeResponse,
    RegisterRequest,
    StepUpVerifyRequest,
)
from app.services.auth_service import AuthService, AuthServiceError

router = APIRouter(prefix="/auth", tags=["authentication"])


def _set_auth_cookies(response: Response, refresh_token: str, csrf_token: str) -> None:
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=settings.refresh_token_expire_minutes * 60,
    )
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        httponly=False,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=settings.refresh_token_expire_minutes * 60,
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie("refresh_token")
    response.delete_cookie("csrf_token")


def _auth_error_to_http(error: AuthServiceError) -> HTTPException:
    mapping = {
        "duplicate_identity": status.HTTP_409_CONFLICT,
        "invalid_credentials": status.HTTP_401_UNAUTHORIZED,
        "account_locked": status.HTTP_423_LOCKED,
        "risk_denied": status.HTTP_403_FORBIDDEN,
        "critical_lock": status.HTTP_423_LOCKED,
        "invalid_challenge": status.HTTP_400_BAD_REQUEST,
        "invalid_otp": status.HTTP_401_UNAUTHORIZED,
        "invalid_refresh_token": status.HTTP_401_UNAUTHORIZED,
        "inactive_user": status.HTTP_401_UNAUTHORIZED,
        "session_inactive": status.HTTP_401_UNAUTHORIZED,
    }
    return HTTPException(
        status_code=mapping.get(error.code, status.HTTP_400_BAD_REQUEST),
        detail={"code": error.code, "message": str(error)},
    )


@router.post("/register", response_model=UserMeResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
def register(
    request: Request,
    payload: RegisterRequest,
    db: Session = Depends(get_db),
):
    try:
        user = AuthService.register_user(db, payload.username, payload.email, payload.password)
        return user
    except AuthServiceError as exc:
        raise _auth_error_to_http(exc) from exc


@router.post("/login", response_model=LoginResponse)
@limiter.limit(settings.rate_limit_login)
def login(
    request: Request,
    payload: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    ip_address = get_client_ip(request)
    try:
        result = AuthService.authenticate(
            db,
            identifier=payload.identifier,
            password=payload.password,
            ip_address=ip_address,
            device_fingerprint=payload.device_fingerprint,
            location=payload.location,
            protocol=payload.protocol,
            simulated_phishing=payload.simulated_phishing,
        )
    except AuthServiceError as exc:
        raise _auth_error_to_http(exc) from exc

    if result.get("status") == "success":
        _set_auth_cookies(response, result["refresh_token"], result["csrf_token"])

    return LoginResponse(**result)


@router.post("/step-up", response_model=LoginResponse)
@limiter.limit("20/minute")
def verify_step_up(
    request: Request,
    payload: StepUpVerifyRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    ip_address = get_client_ip(request)
    try:
        result = AuthService.verify_step_up(
            db,
            challenge_id=payload.challenge_id,
            otp_code=payload.otp_code,
            ip_address=ip_address,
            device_fingerprint=payload.device_fingerprint,
            location=payload.location,
            protocol=payload.protocol,
        )
    except AuthServiceError as exc:
        raise _auth_error_to_http(exc) from exc

    _set_auth_cookies(response, result["refresh_token"], result["csrf_token"])
    return LoginResponse(**result)


@router.post("/refresh", response_model=TokenRefreshResponse)
@limiter.limit("30/minute")
def refresh_token(
    request: Request,
    payload: RefreshTokenRequest,
    response: Response,
    refresh_cookie: str | None = Cookie(default=None, alias="refresh_token"),
    db: Session = Depends(get_db),
):
    refresh_token = payload.refresh_token or refresh_cookie
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Refresh token missing")

    try:
        tokens = AuthService.refresh_tokens(db, refresh_token)
    except AuthServiceError as exc:
        raise _auth_error_to_http(exc) from exc

    _set_auth_cookies(response, tokens["refresh_token"], tokens["csrf_token"])
    return TokenRefreshResponse(**tokens)


@router.get("/me", response_model=UserMeResponse)
def me(current_user=Depends(get_current_user)):
    return current_user


@router.post("/logout")
def logout(
    response: Response,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    payload: dict = Depends(get_token_payload),
    _: None = Depends(require_csrf),
):
    session_id = payload.get("session_id")
    if session_id:
        AuthService.logout(db, current_user, session_id)

    _clear_auth_cookies(response)
    return {"status": "ok", "message": "Logged out"}
