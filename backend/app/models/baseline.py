from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class BehaviorBaseline(Base):
    __tablename__ = "behavior_baselines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    average_login_hour: Mapped[float] = mapped_column(Float, default=0.0)
    known_locations: Mapped[list] = mapped_column(JSON, default=list)
    known_device_fingerprints: Mapped[list] = mapped_column(JSON, default=list)
    ip_history: Mapped[list] = mapped_column(JSON, default=list)
    access_frequency_per_day: Mapped[float] = mapped_column(Float, default=1.0)
    last_updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="baseline")
