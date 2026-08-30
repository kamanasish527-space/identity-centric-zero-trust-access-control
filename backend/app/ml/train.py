"""Training script for anomaly detection model.

Fetches historical session/log data, extracts features, trains IsolationForest,
then persists model.pkl.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Dict, List

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import base  # noqa: F401
from app.db.session import SessionLocal
from app.models.audit_log import AuditLog
from app.models.user import User
from app.models.user_session import AccessSession
from app.models.baseline import BehaviorBaseline
from app.ml.feature_extractor import extract_features
from app.ml.anomaly_model import AnomalyModel

LOGIN_EVENTS = {
    "AUTH_SUCCESS",
    "AUTH_FAILURE",
    "AUTH_DENY",
    "AUTH_STEP_UP_REQUIRED",
    "AUTH_STEP_UP_FAILURE",
    "AUTH_CRITICAL_LOCK",
}


def _compute_session_duration(session: AccessSession, now: datetime) -> float:
    end_time = session.terminated_at or now
    if end_time.tzinfo is None:
        end_time = end_time.replace(tzinfo=timezone.utc)
    start_time = session.issued_at
    if start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=timezone.utc)
    return max(0.0, (end_time - start_time).total_seconds())


def _get_login_attempts(db: Session, user_id: int, at_time: datetime) -> int:
    window_start = at_time - timedelta(hours=1)
    rows = db.scalars(
        select(AuditLog.event_type).where(
            AuditLog.user_id == user_id,
            AuditLog.timestamp >= window_start,
            AuditLog.timestamp <= at_time,
            AuditLog.event_type.in_(LOGIN_EVENTS),
        )
    ).all()
    return len(rows)


def train_model() -> None:
    now = datetime.now(tz=timezone.utc)

    with SessionLocal() as db:
        sessions = db.scalars(select(AccessSession)).all()
        if not sessions:
            print("No sessions found; nothing to train.")
            return

        users = {user.id: user for user in db.scalars(select(User)).all()}
        baselines = {b.user_id: b for b in db.scalars(select(BehaviorBaseline)).all()}

        # Fallback aggregates per user
        duration_map: Dict[int, List[float]] = defaultdict(list)
        hour_map: Dict[int, List[float]] = defaultdict(list)
        ip_map: Dict[int, List[str]] = defaultdict(list)
        device_map: Dict[int, List[str]] = defaultdict(list)

        for session in sessions:
            user_id = session.user_id
            duration_map[user_id].append(_compute_session_duration(session, now))
            hour = session.issued_at.hour + (session.issued_at.minute / 60.0)
            hour_map[user_id].append(hour)
            ip_map[user_id].append(session.ip_address)
            device_map[user_id].append(session.device_fingerprint)

        dataset: List[List[float]] = []

        for session in sessions:
            user = users.get(session.user_id)
            if not user:
                continue

            baseline = baselines.get(session.user_id)
            avg_login_hour = baseline.average_login_hour if baseline else (
                sum(hour_map[session.user_id]) / max(1, len(hour_map[session.user_id]))
            )
            known_ips = baseline.ip_history if baseline else list(set(ip_map[session.user_id]))
            known_devices = baseline.known_device_fingerprints if baseline else list(set(device_map[session.user_id]))
            avg_session_duration = (
                sum(duration_map[session.user_id]) / max(1, len(duration_map[session.user_id]))
            )

            login_attempts = _get_login_attempts(db, session.user_id, session.issued_at)

            features = extract_features(
                {
                    "login_time": session.issued_at,
                    "ip_address": session.ip_address,
                    "device_fingerprint": session.device_fingerprint,
                    "session_duration": _compute_session_duration(session, now),
                    "login_attempts": login_attempts,
                },
                {
                    "average_login_hour": avg_login_hour,
                    "known_ips": known_ips,
                    "known_devices": known_devices,
                    "avg_session_duration": avg_session_duration,
                },
            )
            dataset.append(features)

        model = AnomalyModel()
        model.train(dataset)


if __name__ == "__main__":
    train_model()
    print("Training completed")
