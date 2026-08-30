from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.app_settings import AppSettings
from app.models.user import User, UserRole
from app.models.user_session import AccessSession
from app.services.anomaly_engine import (
    evaluate_behavior_anomaly,
    record_anomaly_event,
    resolve_combined_risk,
)
from app.services.policy_engine import PolicyDecision, decide_policy
from app.services.risk_engine import BehaviorContext, evaluate_risk


def create_session(
    db: Session,
    *,
    user: User,
    context: BehaviorContext,
    risk_score: float,
    risk_level: str,
    commit: bool = False,
) -> AccessSession:
    session_id = str(uuid4())
    expires_at = datetime.now(tz=timezone.utc) + timedelta(minutes=settings.refresh_token_expire_minutes)

    user_session = AccessSession(
        id=session_id,
        user_id=user.id,
        expires_at=expires_at,
        ip_address=context.ip_address,
        device_fingerprint=context.device_fingerprint,
        location=context.location,
        current_risk_score=risk_score,
        current_risk_level=risk_level,
        is_active=True,
    )
    db.add(user_session)
    db.flush()

    if commit:
        db.commit()
        db.refresh(user_session)

    return user_session


def terminate_session(db: Session, session_obj: AccessSession, reason: str, commit: bool = True) -> AccessSession:
    session_obj.is_active = False
    session_obj.termination_reason = reason
    session_obj.terminated_at = datetime.now(tz=timezone.utc)
    db.flush()
    if commit:
        db.commit()
        db.refresh(session_obj)
    return session_obj


def get_active_session_for_user(db: Session, user_id: int, session_id: str) -> AccessSession | None:
    now = datetime.now(tz=timezone.utc)
    return db.scalar(
        select(AccessSession).where(
            AccessSession.id == session_id,
            AccessSession.user_id == user_id,
            AccessSession.is_active.is_(True),
            AccessSession.expires_at > now,
        )
    )


def heartbeat_evaluate(
    db: Session,
    *,
    user: User,
    session_obj: AccessSession,
    context: BehaviorContext,
    app_settings: AppSettings,
) -> tuple[AccessSession, dict]:
    if not app_settings.continuous_monitoring_enabled:
        return session_obj, {
            "session_id": session_obj.id,
            "is_active": session_obj.is_active,
            "risk_score": session_obj.current_risk_score,
            "risk_level": session_obj.current_risk_level,
            "termination_reason": session_obj.termination_reason,
            "decision": "allow",
            "anomalies": [],
            "mitre_matches": [],
            "anomaly_score": 0.0,
            "anomaly_factors": {
                "loginTime": 0.0,
                "ipChange": 0.0,
                "deviceChange": 0.0,
                "sessionPattern": 0.0,
            },
            "alert_flag": False,
        }

    evaluation = evaluate_risk(user.baseline, context, app_settings, app_settings.mitre_mapping_enabled)
    anomaly_evaluation = evaluate_behavior_anomaly(
        db,
        user=user,
        context=context,
        session_obj=session_obj,
        event_source="heartbeat",
    )
    combined_risk_score, combined_risk_level = resolve_combined_risk(
        base_risk_score=evaluation.score,
        anomaly_evaluation=anomaly_evaluation,
        app_settings=app_settings,
    )
    decision = decide_policy(combined_risk_level)
    admin_override = False

    if user.role == UserRole.ADMIN and decision in {PolicyDecision.DENY, PolicyDecision.LOCK_AND_ALERT}:
        decision = PolicyDecision.ALLOW
        admin_override = True

    session_obj.current_risk_score = combined_risk_score
    session_obj.current_risk_level = combined_risk_level
    record_anomaly_event(
        db,
        user_id=user.id,
        session_id=session_obj.id,
        context=context,
        event_source="heartbeat",
        total_risk_score=combined_risk_score,
        risk_level=combined_risk_level,
        anomaly_evaluation=anomaly_evaluation,
        commit=False,
    )

    termination_reason = None
    if decision in {PolicyDecision.DENY, PolicyDecision.LOCK_AND_ALERT}:
        termination_reason = f"Risk escalated to {combined_risk_level} during continuous monitoring"
        terminate_session(db, session_obj, termination_reason, commit=False)

    db.commit()
    db.refresh(session_obj)

    return session_obj, {
        "session_id": session_obj.id,
        "is_active": session_obj.is_active,
        "risk_score": combined_risk_score,
        "risk_level": combined_risk_level,
        "termination_reason": termination_reason or session_obj.termination_reason,
        "decision": decision.value,
        "anomalies": evaluation.anomalies,
        "mitre_matches": evaluation.mitre_matches,
        "anomaly_score": anomaly_evaluation.anomaly_score,
        "anomaly_factors": anomaly_evaluation.factors.api(),
        "alert_flag": anomaly_evaluation.alert_triggered,
        "admin_override": admin_override,
    }
