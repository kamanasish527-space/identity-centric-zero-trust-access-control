from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_csrf, require_roles
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.settings import AppSettingsResponse, AppSettingsUpdate
from app.services.audit_service import log_event
from app.services.settings_service import get_app_settings, update_app_settings

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=AppSettingsResponse)
def read_settings(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.ANALYST)),
):
    row = get_app_settings(db)
    return AppSettingsResponse(
        risk_low_threshold=row.risk_low_threshold,
        risk_medium_threshold=row.risk_medium_threshold,
        risk_high_threshold=row.risk_high_threshold,
        continuous_monitoring_enabled=row.continuous_monitoring_enabled,
        mitre_mapping_enabled=row.mitre_mapping_enabled,
        session_monitor_interval_seconds=row.session_monitor_interval_seconds,
    )


@router.put("", response_model=AppSettingsResponse)
def update_settings(
    payload: AppSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
    _: None = Depends(require_csrf),
):
    row = update_app_settings(db, payload)

    log_event(
        db,
        user_id=current_user.id,
        actor_role=current_user.role.value,
        event_type="ADMIN_SETTINGS_UPDATE",
        action="update_settings",
        message="Security settings updated",
        decision="allow",
        details=payload.model_dump(),
    )

    return AppSettingsResponse(
        risk_low_threshold=row.risk_low_threshold,
        risk_medium_threshold=row.risk_medium_threshold,
        risk_high_threshold=row.risk_high_threshold,
        continuous_monitoring_enabled=row.continuous_monitoring_enabled,
        mitre_mapping_enabled=row.mitre_mapping_enabled,
        session_monitor_interval_seconds=row.session_monitor_interval_seconds,
    )
