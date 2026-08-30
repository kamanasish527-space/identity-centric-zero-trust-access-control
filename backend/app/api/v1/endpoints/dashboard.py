

from sqlalchemy import func, select
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.user import User, UserRole
from app.models.user_session import AccessSession

from app.schemas.dashboard import (
    ActivityLogEntry,
    DashboardOverview,
    RiskAnalyticsResponse,
    SystemArchitectureHealthResponse,
    ThreatIntelItem,
)
from app.schemas.user import UserSecurityProfile
from app.services.dashboard_service import (
    get_overview_metrics,
    get_risk_analytics,
    get_system_architecture_health,
    get_threat_intel_feed,
    get_user_security_profile,
    list_activity_logs,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _scope_for_user(user: User) -> str:
    return "global" if user.role in [UserRole.ADMIN, UserRole.ANALYST] else "user"


@router.get("/overview", response_model=DashboardOverview)
def overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scope = _scope_for_user(current_user)
    if scope == "global":
        return DashboardOverview(**get_overview_metrics(db))

    total_users = 1
    now = datetime.now(tz=timezone.utc)
    active_sessions = db.scalar(
        select(func.count()).select_from(AccessSession).where(
            AccessSession.user_id == current_user.id,
            AccessSession.is_active.is_(True),
            AccessSession.expires_at > now,
        )
    ) or 0
    high_risk_attempts = db.scalar(
        select(func.count()).select_from(AuditLog).where(
            AuditLog.user_id == current_user.id,
            AuditLog.risk_level.in_(["high", "critical"]),
        )
    ) or 0
    denied_attempts = db.scalar(
        select(func.count()).select_from(AuditLog).where(
            AuditLog.user_id == current_user.id,
            AuditLog.decision.in_(["deny", "lock_and_alert", "lock"]),
        )
    ) or 0

    return DashboardOverview(
        total_users=total_users,
        active_sessions=active_sessions,
        high_risk_attempts=high_risk_attempts,
        denied_attempts=denied_attempts,
    )


@router.get("/profile", response_model=UserSecurityProfile)
def profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return UserSecurityProfile(**get_user_security_profile(db, current_user))


@router.get("/logs", response_model=list[ActivityLogEntry])
def logs(
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scope = _scope_for_user(current_user)
    return [ActivityLogEntry(**item) for item in list_activity_logs(db, user=current_user, role_scope=scope, limit=limit)]


@router.get("/risk-analytics", response_model=RiskAnalyticsResponse)
def risk_analytics(
    hours: int = Query(default=24, ge=1, le=168),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scope = _scope_for_user(current_user)
    return RiskAnalyticsResponse(**get_risk_analytics(db, user=current_user, role_scope=scope, hours=hours))


@router.get("/threat-intel", response_model=list[ThreatIntelItem])
def threat_intel(
    limit: int = Query(default=20, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scope = _scope_for_user(current_user)
    return [ThreatIntelItem(**item) for item in get_threat_intel_feed(db, user=current_user, role_scope=scope, limit=limit)]


@router.get("/system-health", response_model=SystemArchitectureHealthResponse)
def system_health(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return SystemArchitectureHealthResponse(**get_system_architecture_health(db))
