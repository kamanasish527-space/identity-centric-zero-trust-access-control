from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base


class AppSettings(Base):
    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    risk_low_threshold: Mapped[float] = mapped_column(Float, default=30.0)
    risk_medium_threshold: Mapped[float] = mapped_column(Float, default=60.0)
    risk_high_threshold: Mapped[float] = mapped_column(Float, default=80.0)
    continuous_monitoring_enabled: Mapped[bool] = mapped_column(default=True)
    mitre_mapping_enabled: Mapped[bool] = mapped_column(default=True)
    session_monitor_interval_seconds: Mapped[int] = mapped_column(Integer, default=20)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
