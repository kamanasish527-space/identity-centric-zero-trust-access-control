import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.core.websocket_manager import broadcast_event
from app.models.audit_log import AuditLog


logger = logging.getLogger("audit")


def log_event(
    db: Session,
    *,
    user_id: int | None,
    actor_role: str | None,
    timestamp: datetime | None = None,
    event_type: str,
    action: str,
    message: str,
    risk_score: float | None = None,
    risk_level: str | None = None,
    decision: str | None = None,
    mitre_technique_id: str | None = None,
    mitre_technique_name: str | None = None,
    mitre_tactic: str | None = None,
    ip_address: str | None = None,
    device_id: str | None = None,
    details: dict[str, Any] | None = None,
    commit: bool = True,
) -> AuditLog:
    log = AuditLog(
        timestamp=timestamp,
        user_id=user_id,
        actor_role=actor_role,
        event_type=event_type,
        action=action,
        message=message,
        risk_score=risk_score,
        risk_level=risk_level,
        decision=decision,
        mitre_technique_id=mitre_technique_id,
        mitre_technique_name=mitre_technique_name,
        mitre_tactic=mitre_tactic,
        ip_address=ip_address,
        device_id=device_id,
        details=details,
    )
    db.add(log)
    if commit:
        db.commit()
        db.refresh(log)
    else:
        db.flush()

    logger.info(
        "audit_event",
        extra={
            "event_type": event_type,
            "action": action,
            "decision": decision,
            "risk_level": risk_level,
            "user_id": user_id,
        },
    )

    broadcast_event(
        {
            "type": "audit_event",
            "payload": {
                "id": log.id,
                "timestamp": (log.timestamp or datetime.now(tz=timezone.utc)).isoformat(),
                "event_type": log.event_type,
                "action": log.action,
                "message": log.message,
                "risk_score": log.risk_score,
                "risk_level": log.risk_level,
                "decision": log.decision,
                "mitre_technique_id": log.mitre_technique_id,
                "mitre_technique_name": log.mitre_technique_name,
                "mitre_tactic": log.mitre_tactic,
                "ip_address": log.ip_address,
                "device_id": log.device_id,
                "user_id": log.user_id,
            },
        }
    )

    return log
