import csv
import io
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.api.deps import require_csrf, require_roles
from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.user import User, UserRole
from app.schemas.user import UserSummary
from app.services.audit_service import log_event

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[UserSummary])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.ANALYST)),
):
    users = db.scalars(select(User).order_by(User.created_at.desc())).all()
    return users


@router.post("/users/{user_id}/lock")
def lock_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
    _: None = Depends(require_csrf),
):
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    target.is_locked = True
    target.lock_until = datetime.now(tz=timezone.utc) + timedelta(minutes=30)
    db.commit()

    log_event(
        db,
        user_id=current_user.id,
        actor_role=current_user.role.value,
        event_type="ADMIN_LOCK_USER",
        action="lock_user",
        message=f"Admin locked user {target.username}",
        decision="allow",
        details={"target_user_id": target.id},
    )

    return {"status": "ok", "message": f"{target.username} locked"}


@router.post("/users/{user_id}/unlock")
def unlock_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
    _: None = Depends(require_csrf),
):
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    target.is_locked = False
    target.lock_until = None
    target.failed_login_attempts = 0
    db.commit()

    log_event(
        db,
        user_id=current_user.id,
        actor_role=current_user.role.value,
        event_type="ADMIN_UNLOCK_USER",
        action="unlock_user",
        message=f"Admin unlocked user {target.username}",
        decision="allow",
        details={"target_user_id": target.id},
    )

    return {"status": "ok", "message": f"{target.username} unlocked"}


@router.get("/logs/export")
def export_logs_csv(
    days: int = Query(default=7, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.ANALYST)),
):
    since = datetime.now(tz=timezone.utc) - timedelta(days=days)
    logs = db.scalars(
        select(AuditLog).where(AuditLog.timestamp >= since).order_by(desc(AuditLog.timestamp))
    ).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "timestamp",
            "user_id",
            "actor_role",
            "event_type",
            "action",
            "risk_score",
            "risk_level",
            "decision",
            "mitre_technique_id",
            "mitre_technique_name",
            "mitre_tactic",
            "ip_address",
            "device_id",
            "message",
        ]
    )

    for row in logs:
        writer.writerow(
            [
                row.timestamp.isoformat() if row.timestamp else "",
                row.user_id,
                row.actor_role,
                row.event_type,
                row.action,
                row.risk_score,
                row.risk_level,
                row.decision,
                row.mitre_technique_id,
                row.mitre_technique_name,
                row.mitre_tactic,
                row.ip_address,
                row.device_id,
                row.message,
            ]
        )

    output.seek(0)

    log_event(
        db,
        user_id=current_user.id,
        actor_role=current_user.role.value,
        event_type="ADMIN_EXPORT_LOGS",
        action="export_logs_csv",
        message="Audit logs exported as CSV",
        decision="allow",
        details={"days": days, "rows": len(logs)},
    )

    headers = {"Content-Disposition": f'attachment; filename="audit_logs_{days}d.csv"'}
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers=headers)
