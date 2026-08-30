from datetime import datetime

from sqlalchemy.orm import Session

from app.models.baseline import BehaviorBaseline
from app.models.user import User
from app.services.risk_engine import BehaviorContext


def _upsert_with_cap(values: list[str], new_value: str, cap: int = 15) -> list[str]:
    current = list(values or [])
    if new_value not in current:
        current.append(new_value)
    return current[-cap:]


def create_or_update_baseline(db: Session, user: User, context: BehaviorContext) -> BehaviorBaseline:
    login_hour = context.login_time.hour + (context.login_time.minute / 60)

    baseline = user.baseline
    if baseline is None:
        baseline = BehaviorBaseline(
            user_id=user.id,
            average_login_hour=login_hour,
            known_locations=[context.location],
            known_device_fingerprints=[context.device_fingerprint],
            ip_history=[context.ip_address],
            access_frequency_per_day=max(1.0, float(context.access_frequency_24h)),
        )
        db.add(baseline)
        db.flush()
        return baseline

    alpha = 0.3
    baseline.average_login_hour = (baseline.average_login_hour * (1 - alpha)) + (login_hour * alpha)
    baseline.known_locations = _upsert_with_cap(baseline.known_locations, context.location)
    baseline.known_device_fingerprints = _upsert_with_cap(
        baseline.known_device_fingerprints,
        context.device_fingerprint,
    )
    baseline.ip_history = _upsert_with_cap(baseline.ip_history, context.ip_address, cap=30)
    baseline.access_frequency_per_day = max(
        1.0,
        (baseline.access_frequency_per_day * (1 - alpha)) + (float(context.access_frequency_24h) * alpha),
    )
    baseline.last_updated_at = datetime.utcnow()
    db.flush()
    return baseline
