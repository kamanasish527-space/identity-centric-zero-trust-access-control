from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class BehaviorAnomalyEvent(Base):
    __tablename__ = "anomaly_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    session_id: Mapped[str | None] = mapped_column(
        ForeignKey("access_sessions.id", ondelete="SET NULL"), nullable=True, index=True
    )

    event_source: Mapped[str] = mapped_column(String(32), nullable=False, default="login")
    anomaly_score: Mapped[float] = mapped_column(Float, nullable=False)
    total_risk_score: Mapped[float] = mapped_column(Float, nullable=False)
    risk_level: Mapped[str] = mapped_column(String(20), nullable=False)
    alert_triggered: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    login_time_score: Mapped[float] = mapped_column(Float, nullable=False)
    ip_change_score: Mapped[float] = mapped_column(Float, nullable=False)
    device_change_score: Mapped[float] = mapped_column(Float, nullable=False)
    session_pattern_score: Mapped[float] = mapped_column(Float, nullable=False)
    login_attempt_score: Mapped[float] = mapped_column(Float, nullable=False)

    factors: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    metrics: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    ip_address: Mapped[str | None] = mapped_column(String(128), nullable=True)
    device_fingerprint: Mapped[str | None] = mapped_column(String(255), nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    engine_version: Mapped[str] = mapped_column(String(32), nullable=False, default="rule_v1")

    user = relationship("User", back_populates="anomaly_events")
    session = relationship("AccessSession", back_populates="anomaly_events")
