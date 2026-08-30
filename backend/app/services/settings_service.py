from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.app_settings import AppSettings
from app.schemas.settings import AppSettingsUpdate


def get_app_settings(db: Session) -> AppSettings:
    settings_row = db.scalar(select(AppSettings).where(AppSettings.id == 1))
    if settings_row:
        return settings_row

    settings_row = AppSettings(id=1)
    db.add(settings_row)
    db.commit()
    db.refresh(settings_row)
    return settings_row


def update_app_settings(db: Session, payload: AppSettingsUpdate) -> AppSettings:
    row = get_app_settings(db)
    row.risk_low_threshold = payload.risk_low_threshold
    row.risk_medium_threshold = payload.risk_medium_threshold
    row.risk_high_threshold = payload.risk_high_threshold
    row.continuous_monitoring_enabled = payload.continuous_monitoring_enabled
    row.mitre_mapping_enabled = payload.mitre_mapping_enabled
    row.session_monitor_interval_seconds = payload.session_monitor_interval_seconds
    db.commit()
    db.refresh(row)
    return row
