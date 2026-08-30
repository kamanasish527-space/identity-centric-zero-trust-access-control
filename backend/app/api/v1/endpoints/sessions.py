from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_token_payload, require_csrf
from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.user_session import AccessSession
from app.schemas.session import SessionHeartbeatRequest, SessionTerminateResponse
from app.services.audit_service import log_event
from app.services.risk_engine import BehaviorContext
from app.services.session_service import (
    get_active_session_for_user,
    heartbeat_evaluate,
    terminate_session,
)
from app.services.settings_service import get_app_settings

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.get("/active")
def list_active_sessions(
    all_users: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(tz=timezone.utc)
    stmt = select(AccessSession).where(
        AccessSession.is_active.is_(True),
        AccessSession.expires_at > now,
    )
    if not (all_users and current_user.role in {UserRole.ADMIN, UserRole.ANALYST}):
        stmt = stmt.where(AccessSession.user_id == current_user.id)

    sessions = db.scalars(stmt.order_by(AccessSession.issued_at.desc())).all()
    return [
        {
            "session_id": item.id,
            "user_id": item.user_id,
            "issued_at": item.issued_at,
            "expires_at": item.expires_at,
            "is_active": item.is_active,
            "risk_score": item.current_risk_score,
            "risk_level": item.current_risk_level,
            "ip_address": item.ip_address,
            "device_fingerprint": item.device_fingerprint,
            "location": item.location,
        }
        for item in sessions
    ]


@router.post("/heartbeat")
def session_heartbeat(
    payload: SessionHeartbeatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    token_payload: dict = Depends(get_token_payload),
    _: None = Depends(require_csrf),
):
    session_id = token_payload.get("session_id")
    if not session_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session context missing")

    session_obj = get_active_session_for_user(db, current_user.id, session_id)
    if not session_obj:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session not active")

    context = BehaviorContext(
        login_time=datetime.now(tz=timezone.utc),
        ip_address=session_obj.ip_address,
        device_fingerprint=payload.device_fingerprint,
        location=payload.location,
        protocol=payload.protocol,
        access_frequency_24h=len(current_user.sessions),
        failed_login_attempts=current_user.failed_login_attempts,
        simulated_phishing=False,
    )

    settings_row = get_app_settings(db)
    session_obj, result = heartbeat_evaluate(
        db,
        user=current_user,
        session_obj=session_obj,
        context=context,
        app_settings=settings_row,
    )

    mitre_first = result["mitre_matches"][0] if result["mitre_matches"] else None
    log_event(
        db,
        user_id=current_user.id,
        actor_role=current_user.role.value,
        event_type="SESSION_HEARTBEAT",
        action="evaluate_session",
        message="Continuous session monitoring update",
        risk_score=result["risk_score"],
        risk_level=result["risk_level"],
        decision=result["decision"],
        mitre_technique_id=mitre_first["technique_id"] if mitre_first else None,
        mitre_technique_name=mitre_first["technique_name"] if mitre_first else None,
        mitre_tactic=mitre_first["tactic"] if mitre_first else None,
        ip_address=session_obj.ip_address,
        device_id=session_obj.device_fingerprint,
        details={
            "anomalies": result["anomalies"],
            "anomaly_score": result.get("anomaly_score"),
            "anomaly_factors": result.get("anomaly_factors"),
            "alert_flag": result.get("alert_flag", False),
        },
    )

    if result.get("alert_flag"):
        log_event(
            db,
            user_id=current_user.id,
            actor_role=current_user.role.value,
            event_type="ANOMALY_ALERT",
            action="session_anomaly_alert",
            message="Behavioral anomaly score exceeded threshold during session monitoring",
            risk_score=result["risk_score"],
            risk_level=result["risk_level"],
            decision="alert",
            ip_address=session_obj.ip_address,
            device_id=session_obj.device_fingerprint,
            details={
                "anomaly_score": result.get("anomaly_score"),
                "anomaly_factors": result.get("anomaly_factors"),
            },
        )

    return result


@router.post("/terminate/{session_id}", response_model=SessionTerminateResponse)
def terminate(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_csrf),
):
    stmt = select(AccessSession).where(AccessSession.id == session_id)
    if current_user.role != UserRole.ADMIN:
        stmt = stmt.where(AccessSession.user_id == current_user.id)

    session_obj = db.scalar(stmt)
    if not session_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    terminate_session(db, session_obj, reason=f"Terminated by {current_user.username}", commit=True)

    log_event(
        db,
        user_id=current_user.id,
        actor_role=current_user.role.value,
        event_type="SESSION_TERMINATED",
        action="terminate_session",
        message="Session terminated by operator",
        decision="allow",
        ip_address=session_obj.ip_address,
        device_id=session_obj.device_fingerprint,
        details={"terminated_session": session_obj.id},
    )

    return SessionTerminateResponse(
        session_id=session_obj.id,
        is_active=session_obj.is_active,
        terminated_at=session_obj.terminated_at,
        termination_reason=session_obj.termination_reason,
    )
