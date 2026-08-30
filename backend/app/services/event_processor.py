from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import desc, func, select

from app.core.websocket_manager import broadcast_event
from app.db.session import SessionLocal
from app.models.audit_log import AuditLog
from app.models.user import User, UserRole
from app.models.user_session import AccessSession
from app.schemas.ingest import IngestEventRequest
from app.services.anomaly_engine import (
    evaluate_behavior_anomaly,
    record_anomaly_event,
    resolve_combined_risk,
)
from app.services.audit_service import log_event
from app.services.baseline_service import create_or_update_baseline
from app.services.policy_engine import PolicyDecision, decide_policy
from app.services.risk_engine import BehaviorContext, evaluate_risk
from app.services.session_service import create_session, terminate_session
from app.services.settings_service import get_app_settings


logger = logging.getLogger("ingest.processor")


def process_event(event: dict[str, Any]) -> dict[str, Any]:
    db = SessionLocal()
    raw_log: AuditLog | None = None
    payload_data = event.get("event", event)

    try:
        payload = IngestEventRequest(**payload_data)
        raw_log_id = event.get("audit_log_id")
        if raw_log_id is not None:
            raw_log = db.get(AuditLog, raw_log_id)

        user = db.get(User, payload.user_id) if payload.user_id is not None else None
        app_settings = get_app_settings(db)
        context = _build_behavior_context(db, payload)

        risk_evaluation = evaluate_risk(
            user.baseline if user else None,
            context,
            app_settings,
            app_settings.mitre_mapping_enabled,
        )

        anomaly_evaluation = (
            evaluate_behavior_anomaly(
                db,
                user=user,
                context=context,
                session_obj=None,
                event_source=f"ingest:{payload.event_type}",
            )
            if user is not None
            else None
        )

        if anomaly_evaluation is not None:
            combined_risk_score, combined_risk_level = resolve_combined_risk(
                base_risk_score=risk_evaluation.score,
                anomaly_evaluation=anomaly_evaluation,
                app_settings=app_settings,
            )
            anomaly_score = anomaly_evaluation.anomaly_score
            anomaly_factors = anomaly_evaluation.factors.api()
            decision = decide_policy(combined_risk_level)
        else:
            combined_risk_score = risk_evaluation.score
            combined_risk_level = risk_evaluation.level
            anomaly_score = 0.0
            anomaly_factors = {
                "loginTime": 0.0,
                "ipChange": 0.0,
                "deviceChange": 0.0,
                "sessionPattern": 0.0,
            }
            decision = decide_policy(combined_risk_level)

        admin_override = False
        if user and user.role == UserRole.ADMIN and decision != PolicyDecision.ALLOW:
            decision = PolicyDecision.ALLOW
            admin_override = True

        session_obj = _synchronize_session_state(
            db=db,
            user=user,
            context=context,
            status=payload.status,
            event_type=payload.event_type,
            risk_score=combined_risk_score,
            risk_level=combined_risk_level,
            decision=decision,
        )

        if user and anomaly_evaluation is not None:
            record_anomaly_event(
                db,
                user_id=user.id,
                session_id=session_obj.id if session_obj else None,
                context=context,
                event_source=f"ingest:{payload.event_type}",
                total_risk_score=combined_risk_score,
                risk_level=combined_risk_level,
                anomaly_evaluation=anomaly_evaluation,
                commit=False,
            )

        if user and _should_update_baseline(payload.status, payload.event_type, decision):
            create_or_update_baseline(db, user, context)

        mitre_first = risk_evaluation.mitre_matches[0] if risk_evaluation.mitre_matches else None
        processed_details = {
            "ingestion_status": "processed",
            "original_event": payload.model_dump(mode="json"),
            "processing": {
                "risk_score": combined_risk_score,
                "risk_level": combined_risk_level,
                "anomaly_score": anomaly_score,
                "anomaly_factors": anomaly_factors,
                "decision": decision.value,
                "anomalies": risk_evaluation.anomalies,
                "threat_classification": risk_evaluation.threat_classification,
                "admin_override": admin_override,
                "session_id": session_obj.id if session_obj else None,
            },
        }

        if raw_log is not None:
            raw_log.actor_role = user.role.value if user else raw_log.actor_role
            raw_log.timestamp = payload.timestamp
            raw_log.action = payload.event_type
            raw_log.message = _metadata_to_message(payload.metadata)
            raw_log.risk_score = combined_risk_score
            raw_log.risk_level = combined_risk_level
            raw_log.decision = decision.value
            raw_log.mitre_technique_id = mitre_first["technique_id"] if mitre_first else None
            raw_log.mitre_technique_name = mitre_first["technique_name"] if mitre_first else None
            raw_log.mitre_tactic = mitre_first["tactic"] if mitre_first else None
            raw_log.ip_address = payload.ip_address
            raw_log.device_id = payload.device
            raw_log.details = processed_details
        else:
            log_event(
                db,
                user_id=user.id if user else payload.user_id,
                actor_role=user.role.value if user else None,
                timestamp=payload.timestamp,
                event_type="INGEST_EVENT",
                action=payload.event_type,
                message=_metadata_to_message(payload.metadata),
                risk_score=combined_risk_score,
                risk_level=combined_risk_level,
                decision=decision.value,
                mitre_technique_id=mitre_first["technique_id"] if mitre_first else None,
                mitre_technique_name=mitre_first["technique_name"] if mitre_first else None,
                mitre_tactic=mitre_first["tactic"] if mitre_first else None,
                ip_address=payload.ip_address,
                device_id=payload.device,
                details=processed_details,
                commit=False,
            )

        db.commit()

        if raw_log is not None:
            broadcast_event(
                {
                    "type": "audit_event",
                    "payload": {
                        "id": raw_log.id,
                        "timestamp": raw_log.timestamp.isoformat() if raw_log.timestamp else None,
                        "event_type": raw_log.event_type,
                        "action": raw_log.action,
                        "message": raw_log.message,
                        "risk_score": raw_log.risk_score,
                        "risk_level": raw_log.risk_level,
                        "decision": raw_log.decision,
                        "mitre_technique_id": raw_log.mitre_technique_id,
                        "mitre_technique_name": raw_log.mitre_technique_name,
                        "mitre_tactic": raw_log.mitre_tactic,
                        "ip_address": raw_log.ip_address,
                        "device_id": raw_log.device_id,
                        "user_id": raw_log.user_id,
                    },
                }
            )

        logger.info(
            "event_processed",
            extra={
                "audit_log_id": raw_log.id if raw_log else None,
                "user_id": payload.user_id,
                "event_type": payload.event_type,
                "risk_score": combined_risk_score,
                "anomaly_score": anomaly_score,
                "risk_level": combined_risk_level,
            },
        )

        return {
            "audit_log_id": raw_log.id if raw_log else None,
            "risk_score": combined_risk_score,
            "anomaly_score": anomaly_score,
            "risk_level": combined_risk_level,
            "decision": decision.value,
        }
    except Exception as exc:
        logger.exception("event_processing_exception")
        if raw_log is not None:
            raw_log.details = {
                **(raw_log.details or {}),
                "ingestion_status": "failed",
                "processing_error": str(exc),
            }
            db.commit()
        raise
    finally:
        db.close()


def _build_behavior_context(db, payload: IngestEventRequest) -> BehaviorContext:
    metadata = payload.metadata or {}
    return BehaviorContext(
        login_time=_ensure_utc(payload.timestamp),
        ip_address=payload.ip_address,
        device_fingerprint=payload.device,
        location=str(metadata.get("location") or metadata.get("geo") or metadata.get("country") or "unknown"),
        protocol=str(metadata.get("protocol") or "https"),
        access_frequency_24h=_count_recent_user_events(db, payload.user_id, payload.timestamp, hours=24),
        failed_login_attempts=_derive_login_attempts(payload),
        simulated_phishing=bool(metadata.get("simulated_phishing") or metadata.get("phishing_signal")),
    )


def _count_recent_user_events(db, user_id: int | None, timestamp: datetime, hours: int) -> int:
    if user_id is None:
        return 1
    window_start = _ensure_utc(timestamp) - timedelta(hours=hours)
    recent = db.scalar(
        select(func.count())
        .select_from(AuditLog)
        .where(
            AuditLog.user_id == user_id,
            AuditLog.timestamp >= window_start,
        )
    ) or 0
    return int(recent) + 1


def _derive_login_attempts(payload: IngestEventRequest) -> int:
    metadata = payload.metadata or {}
    if isinstance(metadata.get("login_attempts"), int):
        return int(metadata["login_attempts"])
    if isinstance(metadata.get("failed_login_attempts"), int):
        return int(metadata["failed_login_attempts"])
    lowered_status = payload.status.lower()
    lowered_event = payload.event_type.lower()
    if "failed" in lowered_status or "deny" in lowered_status or "fail" in lowered_event:
        return 1
    return 0


def _synchronize_session_state(
    *,
    db,
    user: User | None,
    context: BehaviorContext,
    status: str,
    event_type: str,
    risk_score: float,
    risk_level: str,
    decision: PolicyDecision,
) -> AccessSession | None:
    if user is None:
        return None

    session_obj = db.scalar(
        select(AccessSession)
        .where(
            AccessSession.user_id == user.id,
            AccessSession.is_active.is_(True),
            AccessSession.expires_at > datetime.now(tz=timezone.utc),
        )
        .order_by(desc(AccessSession.issued_at))
        .limit(1)
    )

    normalized_status = status.lower()
    normalized_event = event_type.lower()

    if session_obj and _is_termination_event(normalized_status, normalized_event):
        terminate_session(db, session_obj, f"Ingested event ended session: {event_type}", commit=False)
        return session_obj

    if session_obj is None and _is_session_start_event(normalized_status, normalized_event):
        return create_session(
            db,
            user=user,
            context=context,
            risk_score=risk_score,
            risk_level=risk_level,
            commit=False,
        )

    if session_obj is not None:
        session_obj.ip_address = context.ip_address
        session_obj.device_fingerprint = context.device_fingerprint
        session_obj.location = context.location
        session_obj.current_risk_score = risk_score
        session_obj.current_risk_level = risk_level

        if decision in {PolicyDecision.DENY, PolicyDecision.LOCK_AND_ALERT} and user.role != UserRole.ADMIN:
            terminate_session(
                db,
                session_obj,
                f"Ingested event triggered {decision.value}",
                commit=False,
            )

    return session_obj


def _is_session_start_event(status: str, event_type: str) -> bool:
    return (
        "login" in event_type
        and any(token in status for token in ("success", "allow", "ok", "passed"))
    )


def _is_termination_event(status: str, event_type: str) -> bool:
    return any(token in status for token in ("logout", "terminated", "ended")) or any(
        token in event_type for token in ("logout", "terminate", "session_end")
    )


def _should_update_baseline(status: str, event_type: str, decision: PolicyDecision) -> bool:
    normalized_status = status.lower()
    normalized_event = event_type.lower()
    if decision != PolicyDecision.ALLOW:
        return False
    if "login" in normalized_event:
        return any(token in normalized_status for token in ("success", "allow", "ok", "passed"))
    return any(token in normalized_status for token in ("success", "allow", "ok", "passed", "normal"))


def _metadata_to_message(metadata: dict[str, Any]) -> str:
    if not metadata:
        return "No metadata supplied"
    if "message" in metadata and metadata["message"]:
        return str(metadata["message"])
    return json.dumps(metadata, default=str, separators=(",", ":"), sort_keys=True)


def _ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
