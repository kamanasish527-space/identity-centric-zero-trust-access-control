from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class AccessSession(Base):
    __tablename__ = "access_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    terminated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    is_active: Mapped[bool] = mapped_column(default=True)
    termination_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    ip_address: Mapped[str] = mapped_column(String(128), nullable=False)
    device_fingerprint: Mapped[str] = mapped_column(String(255), nullable=False)
    location: Mapped[str] = mapped_column(String(255), nullable=False)

    current_risk_score: Mapped[float] = mapped_column(Float, default=0.0)
    current_risk_level: Mapped[str] = mapped_column(String(20), default="low")

    user = relationship("User", back_populates="sessions")
    anomaly_events = relationship("BehaviorAnomalyEvent", back_populates="session")
