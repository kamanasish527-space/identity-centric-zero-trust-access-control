from __future__ import annotations

from datetime import datetime, timezone
from random import randint
from uuid import uuid4

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.models.user_session import AccessSession
from app.models.user import User
from app.services.anomaly_engine import (
    AnomalyEvaluation,
    AnomalyFactors,
    evaluate_behavior_anomaly,
    record_anomaly_event,
    resolve_combined_risk,
)
from app.services.audit_service import log_event
from app.services.policy_engine import decide_policy
from app.services.risk_engine import BehaviorContext, classify_risk_level, evaluate_risk
from app.services.session_service import get_active_session_for_user
from app.services.settings_service import get_app_settings


SIMULATED_BEHAVIORS = [
    "Foreign IP login attempt detected",
    "5 rapid failed authentication attempts",
    "Midnight login pattern anomaly",
    "Unknown device fingerprint mismatch",
]


def _normalize_score(value: float) -> float:
    return float(max(0.0, min(100.0, round(value, 2))))


def run_attack_simulation(
    db: Session,
    *,
    user: User,
    session_id: str | None,
) -> dict:
    now = datetime.now(tz=timezone.utc)
    app_settings = get_app_settings(db)
    active_session = get_active_session_for_user(db, user.id, session_id) if session_id else None

    # Synthetic attack profile for deterministic high-risk simulation.
    simulated_ip = f"185.{randint(20, 220)}.{randint(1, 254)}.{randint(1, 254)}"
    simulated_device = f"sim-device-{uuid4().hex[:10]}"
    simulated_location = "RU-MOW-MOSCOW"
    simulated_login_time = now.replace(hour=0, minute=8, second=0, microsecond=0)

    context = BehaviorContext(
        login_time=simulated_login_time,
        ip_address=simulated_ip,
        device_fingerprint=simulated_device,
        location=simulated_location,
        protocol="http",
        access_frequency_24h=max(12, len(user.sessions) + 6),
        failed_login_attempts=5,
        simulated_phishing=False,
    )

    risk_eval = evaluate_risk(user.baseline, context, app_settings, app_settings.mitre_mapping_enabled)

    base_anomaly_eval = evaluate_behavior_anomaly(
        db,
        user=user,
        context=context,
        session_obj=active_session,
        event_source="attack_simulation",
    )
    anomaly_eval = AnomalyEvaluation(
        anomaly_score=base_anomaly_eval.anomaly_score,
        factors=base_anomaly_eval.factors,
        metrics={
            **(base_anomaly_eval.metrics or {}),
            "eventSource": "attack_simulation",
            "scenario": SIMULATED_BEHAVIORS,
            "failedAttempts": 5,
            "injectedIp": simulated_ip,
            "injectedDevice": simulated_device,
            "injectedLocation": simulated_location,
            "injectedLoginTimeUtc": simulated_login_time.isoformat(),
        },
        alert_triggered=base_anomaly_eval.alert_triggered,
    )
    anomaly_score = anomaly_eval.anomaly_score

    total_risk, risk_level = resolve_combined_risk(
        base_risk_score=risk_eval.score,
        anomaly_evaluation=anomaly_eval,
        app_settings=app_settings,
    )

    # Attack-mode is intentionally dramatic and should visibly spike.
    total_risk = _normalize_score(max(total_risk, 90.0))
    risk_level = classify_risk_level(total_risk, app_settings)

    if active_session:
        active_session.current_risk_score = total_risk
        active_session.current_risk_level = risk_level

    record_anomaly_event(
        db,
        user_id=user.id,
        session_id=active_session.id if active_session else None,
        context=context,
        event_source="attack_simulation",
        total_risk_score=total_risk,
        risk_level=risk_level,
        anomaly_evaluation=anomaly_eval,
        commit=False,
    )

    mitre_first = risk_eval.mitre_matches[0] if risk_eval.mitre_matches else None
    log_event(
        db,
        user_id=user.id,
        actor_role=user.role.value,
        event_type="ATTACK_SIMULATION",
        action="run_attack_simulation",
        message="Attack Simulation Mode injected malicious behavior sequence",
        risk_score=total_risk,
        risk_level=risk_level,
        decision=decide_policy(risk_level).value,
        mitre_technique_id=mitre_first["technique_id"] if mitre_first else None,
        mitre_technique_name=mitre_first["technique_name"] if mitre_first else None,
        mitre_tactic=mitre_first["tactic"] if mitre_first else None,
        ip_address=simulated_ip,
        device_id=simulated_device,
        details={
            "behaviors": SIMULATED_BEHAVIORS,
            "anomaly_score": anomaly_score,
            "anomaly_factors": anomaly_eval.factors.api(),
            "mitre": risk_eval.mitre_matches,
        },
        commit=False,
    )

    session_terminated = False
    termination_reason = None
    decision = decide_policy(risk_level).value

    if total_risk > 85:
        decision = "deny"
        termination_reason = "Access Denied - High Risk (Attack Simulation)"
        session_terminated = True

        log_event(
            db,
            user_id=user.id,
            actor_role=user.role.value,
            event_type="ACCESS_DENIED_HIGH_RISK",
            action="enforce_high_risk_termination",
            message="Access Denied - High Risk",
            risk_score=total_risk,
            risk_level=risk_level,
            decision="deny",
            mitre_technique_id=mitre_first["technique_id"] if mitre_first else None,
            mitre_technique_name=mitre_first["technique_name"] if mitre_first else None,
            mitre_tactic=mitre_first["tactic"] if mitre_first else None,
            ip_address=simulated_ip,
            device_id=simulated_device,
            details={
                "reason": termination_reason,
                "simulation": True,
                "operatorSessionPreserved": True,
            },
            commit=False,
        )

    db.commit()

    return {
        "simulationActive": True,
        "totalRisk": total_risk,
        "anomalyScore": anomaly_score,
        "riskLevel": risk_level,
        "decision": decision,
        "sessionTerminated": session_terminated,
        "terminationReason": termination_reason,
        "alert": anomaly_eval.alert_triggered,
        "factors": anomaly_eval.factors.api(),
        "simulatedBehaviors": SIMULATED_BEHAVIORS,
        "mitre": risk_eval.mitre_matches,
        "activityMessage": "Access Denied - High Risk" if total_risk > 85 else "Attack simulation completed",
        "timestamp": now,
    }


def reset_attack_simulation(
    db: Session,
    *,
    user: User,
    session_id: str | None,
) -> dict:
    now = datetime.now(tz=timezone.utc)
    app_settings = get_app_settings(db)
    active_session = get_active_session_for_user(db, user.id, session_id) if session_id else None
    latest_session = db.scalar(
        select(AccessSession).where(AccessSession.user_id == user.id).order_by(desc(AccessSession.issued_at)).limit(1)
    )

    baseline_risk = 12.0
    risk_level = classify_risk_level(baseline_risk, app_settings)
    context = BehaviorContext(
        login_time=now,
        ip_address=active_session.ip_address if active_session else "127.0.0.1",
        device_fingerprint=active_session.device_fingerprint if active_session else "fp_reset",
        location=active_session.location if active_session else "LOCAL-SIM",
        protocol="https",
        access_frequency_24h=max(1, len(user.sessions)),
        failed_login_attempts=0,
        simulated_phishing=False,
    )

    session_for_reset = active_session or latest_session
    if session_for_reset:
        session_for_reset.current_risk_score = baseline_risk
        session_for_reset.current_risk_level = risk_level

    anomaly_eval = AnomalyEvaluation(
        anomaly_score=0.0,
        factors=AnomalyFactors(
            login_time=0.0,
            ip_change=0.0,
            device_change=0.0,
            session_duration=0.0,
            login_attempt_frequency=0.0,
        ),
        metrics={"eventSource": "attack_simulation_reset"},
        alert_triggered=False,
    )

    record_anomaly_event(
        db,
        user_id=user.id,
        session_id=session_for_reset.id if session_for_reset else None,
        context=context,
        event_source="attack_simulation_reset",
        total_risk_score=baseline_risk,
        risk_level=risk_level,
        anomaly_evaluation=anomaly_eval,
        commit=False,
    )

    log_event(
        db,
        user_id=user.id,
        actor_role=user.role.value,
        event_type="ATTACK_SIMULATION_RESET",
        action="reset_attack_simulation",
        message="Attack Simulation Mode reset",
        risk_score=baseline_risk,
        risk_level=risk_level,
        decision="allow",
        ip_address=context.ip_address,
        device_id=context.device_fingerprint,
        details={"simulation": False},
        commit=False,
    )

    db.commit()

    return {
        "simulationActive": False,
        "totalRisk": baseline_risk,
        "riskLevel": risk_level,
        "message": "Attack simulation reset",
        "timestamp": now,
    }
