from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from statistics import mean, pstdev
from typing import Protocol

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.ml.feature_extractor import extract_features
from app.ml.model_loader import get_model
from app.models.anomaly_event import BehaviorAnomalyEvent
from app.models.app_settings import AppSettings
from app.models.audit_log import AuditLog
from app.models.user import User
from app.models.user_session import AccessSession
from app.services.audit_service import log_event
from app.services.risk_explanation_service import generateRiskExplanation
from app.services.risk_engine import BehaviorContext, classify_risk_level


@dataclass(frozen=True)
class AnomalyWeights:
    login_time: float = 0.24
    ip_change: float = 0.22
    device_change: float = 0.18
    session_duration: float = 0.20
    login_attempt_frequency: float = 0.16


@dataclass(frozen=True)
class AnomalyFactors:
    login_time: float
    ip_change: float
    device_change: float
    session_duration: float
    login_attempt_frequency: float

    @property
    def session_pattern(self) -> float:
        return _normalize_score((self.session_duration * 0.7) + (self.login_attempt_frequency * 0.3))

    def api(self) -> dict[str, float]:
        return {
            "loginTime": self.login_time,
            "ipChange": self.ip_change,
            "deviceChange": self.device_change,
            "sessionPattern": self.session_pattern,
        }

    def storage(self) -> dict[str, float]:
        return {
            **self.api(),
            "sessionDuration": self.session_duration,
            "loginAttemptFrequency": self.login_attempt_frequency,
        }


@dataclass(frozen=True)
class AnomalyEvaluation:
    anomaly_score: float
    factors: AnomalyFactors
    metrics: dict
    alert_triggered: bool


class AnomalyDetector(Protocol):
    def evaluate(
        self,
        db: Session,
        *,
        user: User,
        context: BehaviorContext,
        session_obj: AccessSession | None = None,
        event_source: str = "login",
    ) -> AnomalyEvaluation: ...


class RuleBasedAnomalyDetector:
    def __init__(self, weights: AnomalyWeights | None = None) -> None:
        self.weights = weights or AnomalyWeights()

    def evaluate(
        self,
        db: Session,
        *,
        user: User,
        context: BehaviorContext,
        session_obj: AccessSession | None = None,
        event_source: str = "login",
    ) -> AnomalyEvaluation:
        now = context.login_time
        recent_sessions = _get_recent_sessions(db, user.id, lookback_days=14)

        login_time_score, login_time_metrics = _score_login_time_deviation(user, context)
        ip_change_score, ip_change_metrics = _score_ip_change_frequency(user, context, recent_sessions, now)
        device_change_score, device_change_metrics = _score_device_change(user, context, recent_sessions, now)
        session_duration_score, session_duration_metrics = _score_session_duration_anomaly(
            db,
            user=user,
            session_obj=session_obj,
            now=now,
            event_source=event_source,
        )
        login_attempt_score, login_attempt_metrics = _score_login_attempt_frequency(db, user, context, now)

        factors = AnomalyFactors(
            login_time=login_time_score,
            ip_change=ip_change_score,
            device_change=device_change_score,
            session_duration=session_duration_score,
            login_attempt_frequency=login_attempt_score,
        )

        score = (
            (self.weights.login_time * factors.login_time)
            + (self.weights.ip_change * factors.ip_change)
            + (self.weights.device_change * factors.device_change)
            + (self.weights.session_duration * factors.session_duration)
            + (self.weights.login_attempt_frequency * factors.login_attempt_frequency)
        )
        anomaly_score = _normalize_score(score)

        metrics = {
            "eventSource": event_source,
            "loginTime": login_time_metrics,
            "ipChange": ip_change_metrics,
            "deviceChange": device_change_metrics,
            "sessionDuration": session_duration_metrics,
            "loginAttempts": login_attempt_metrics,
        }

        return AnomalyEvaluation(
            anomaly_score=anomaly_score,
            factors=factors,
            metrics=metrics,
            alert_triggered=anomaly_score > 70,
        )


_default_detector = RuleBasedAnomalyDetector()


def evaluate_behavior_anomaly(
    db: Session,
    *,
    user: User,
    context: BehaviorContext,
    session_obj: AccessSession | None = None,
    event_source: str = "login",
) -> AnomalyEvaluation:
    rule_eval = _default_detector.evaluate(
        db,
        user=user,
        context=context,
        session_obj=session_obj,
        event_source=event_source,
    )

    # Attempt ML-based anomaly detection; fall back to rule-based on any failure.
    try:
        baseline = user.baseline
        baseline_hour = float(baseline.average_login_hour) if baseline else context.login_time.hour
        known_ips = list(baseline.ip_history) if baseline and baseline.ip_history else []
        known_devices = list(baseline.known_device_fingerprints) if baseline and baseline.known_device_fingerprints else []

        session_duration_metrics = rule_eval.metrics.get("sessionDuration", {})
        avg_session_duration = float(session_duration_metrics.get("averageDurationSeconds") or 0.0)
        current_duration = float(session_duration_metrics.get("currentDurationSeconds") or 0.0)
        if current_duration <= 0.0 and session_obj is not None:
            issued_at = _as_utc(session_obj.issued_at)
            if issued_at:
                current_duration = max(0.0, (context.login_time - issued_at).total_seconds())

        login_attempts_metrics = rule_eval.metrics.get("loginAttempts", {})
        login_attempts = int(login_attempts_metrics.get("attemptsLastHour") or 0)

        features = extract_features(
            {
                "login_time": context.login_time,
                "ip_address": context.ip_address,
                "device_fingerprint": context.device_fingerprint,
                "session_duration": current_duration,
                "login_attempts": login_attempts,
            },
            {
                "average_login_hour": baseline_hour,
                "known_ips": known_ips,
                "known_devices": known_devices,
                "avg_session_duration": avg_session_duration,
            },
        )

        model = get_model()
        ml_result = model.predict(features)
        ml_score = float(ml_result.score)
        ml_label = ml_result.label

        log_event(
            db,
            user_id=user.id,
            actor_role=user.role.value if user.role else None,
            event_type="ML_ANOMALY_DETECTION",
            action="ml_anomaly_detection",
            message="ML anomaly detection triggered",
            risk_score=ml_score,
            risk_level=ml_label,
            ip_address=context.ip_address,
            device_id=context.device_fingerprint,
            details={
                "features": features,
                "anomaly_score": ml_score,
                "risk_level": ml_label,
                "eventSource": event_source,
            },
            commit=False,
        )

        metrics = {**rule_eval.metrics, "mlScore": ml_score, "mlLabel": ml_label}
        return AnomalyEvaluation(
            anomaly_score=ml_score,
            factors=rule_eval.factors,
            metrics=metrics,
            alert_triggered=ml_score > 70,
        )
    except Exception:
        return rule_eval


def combine_total_risk(base_risk_score: float, anomaly_score: float) -> float:
    return _normalize_score((base_risk_score * 0.65) + (anomaly_score * 0.35))


def resolve_combined_risk(
    *,
    base_risk_score: float,
    anomaly_evaluation: AnomalyEvaluation,
    app_settings: AppSettings,
) -> tuple[float, str]:
    ml_score = anomaly_evaluation.metrics.get("mlScore") if isinstance(anomaly_evaluation.metrics, dict) else None
    ml_label = anomaly_evaluation.metrics.get("mlLabel") if isinstance(anomaly_evaluation.metrics, dict) else None

    if ml_score is not None:
        total_risk = _normalize_score((base_risk_score * 0.6) + (float(ml_score) * 0.4))
        risk_level = classify_risk_level(total_risk, app_settings)
        ml_risk_level = _normalize_policy_risk_level(
            ml_label,
            total_risk=total_risk,
            app_settings=app_settings,
        )
        if _risk_rank(ml_risk_level) >= _risk_rank("high") and _risk_rank(risk_level) < _risk_rank(ml_risk_level):
            risk_level = ml_risk_level
    else:
        total_risk = combine_total_risk(base_risk_score, anomaly_evaluation.anomaly_score)
        risk_level = classify_risk_level(total_risk, app_settings)

    if anomaly_evaluation.alert_triggered and risk_level in {"low", "medium", "normal", "suspicious"}:
        risk_level = "high"
        total_risk = max(total_risk, app_settings.risk_medium_threshold + 1.0)

    return _normalize_score(total_risk), risk_level


def _normalize_policy_risk_level(
    label: str | None,
    *,
    total_risk: float,
    app_settings: AppSettings,
) -> str:
    if label in {"low", "medium", "high", "critical"}:
        return label

    mapped = {
        "normal": "low",
        "suspicious": "medium",
        "high": "high",
    }.get((label or "").lower())

    if mapped == "high" and total_risk >= app_settings.risk_high_threshold:
        return "critical"

    if mapped:
        return mapped

    return classify_risk_level(total_risk, app_settings)


def _risk_rank(level: str) -> int:
    rank = {
        "low": 0,
        "medium": 1,
        "high": 2,
        "critical": 3,
    }
    return rank.get(level, -1)


def record_anomaly_event(
    db: Session,
    *,
    user_id: int,
    session_id: str | None,
    context: BehaviorContext,
    event_source: str,
    total_risk_score: float,
    risk_level: str,
    anomaly_evaluation: AnomalyEvaluation,
    commit: bool = False,
) -> BehaviorAnomalyEvent:
    row = BehaviorAnomalyEvent(
        user_id=user_id,
        session_id=session_id,
        event_source=event_source,
        anomaly_score=anomaly_evaluation.anomaly_score,
        total_risk_score=total_risk_score,
        risk_level=risk_level,
        alert_triggered=anomaly_evaluation.alert_triggered,
        login_time_score=anomaly_evaluation.factors.login_time,
        ip_change_score=anomaly_evaluation.factors.ip_change,
        device_change_score=anomaly_evaluation.factors.device_change,
        session_pattern_score=anomaly_evaluation.factors.session_pattern,
        login_attempt_score=anomaly_evaluation.factors.login_attempt_frequency,
        factors=anomaly_evaluation.factors.storage(),
        metrics=anomaly_evaluation.metrics,
        ip_address=context.ip_address,
        device_fingerprint=context.device_fingerprint,
        location=context.location,
        engine_version="rule_v1",
    )
    db.add(row)
    if commit:
        db.commit()
        db.refresh(row)
    else:
        db.flush()
    return row


def get_live_risk_snapshot(db: Session, user: User) -> dict:
    latest_event = db.scalar(
        select(BehaviorAnomalyEvent)
        .where(BehaviorAnomalyEvent.user_id == user.id)
        .order_by(desc(BehaviorAnomalyEvent.detected_at), desc(BehaviorAnomalyEvent.id))
        .limit(1)
    )

    active_session = db.scalar(
        select(AccessSession)
        .where(AccessSession.user_id == user.id, AccessSession.is_active.is_(True))
        .order_by(desc(AccessSession.issued_at))
        .limit(1)
    )

    factors = {
        "loginTime": 0.0,
        "ipChange": 0.0,
        "deviceChange": 0.0,
        "sessionPattern": 0.0,
    }
    anomaly_score = 0.0
    total_risk = 0.0

    if latest_event:
        event_factors = latest_event.factors or {}
        factors["loginTime"] = float(event_factors.get("loginTime", latest_event.login_time_score))
        factors["ipChange"] = float(event_factors.get("ipChange", latest_event.ip_change_score))
        factors["deviceChange"] = float(event_factors.get("deviceChange", latest_event.device_change_score))
        factors["sessionPattern"] = float(event_factors.get("sessionPattern", latest_event.session_pattern_score))
        anomaly_score = float(latest_event.anomaly_score)
        total_risk = float(latest_event.total_risk_score)

    if active_session:
        total_risk = float(active_session.current_risk_score)

    snapshot = {
        "totalRisk": _normalize_score(total_risk),
        "anomalyScore": _normalize_score(anomaly_score),
        "factors": factors,
    }
    snapshot["insight"] = generateRiskExplanation(snapshot)
    return snapshot


def _normalize_score(value: float) -> float:
    return float(max(0.0, min(100.0, round(value, 2))))


def _cyclical_hour_difference(hour_a: float, hour_b: float) -> float:
    direct = abs(hour_a - hour_b)
    return min(direct, 24 - direct)


def _get_recent_sessions(db: Session, user_id: int, lookback_days: int = 14) -> list[AccessSession]:
    from_time = datetime.now(tz=timezone.utc) - timedelta(days=lookback_days)
    rows = db.scalars(
        select(AccessSession)
        .where(AccessSession.user_id == user_id, AccessSession.issued_at >= from_time)
        .order_by(AccessSession.issued_at.asc())
    ).all()
    return list(rows)


def _score_login_time_deviation(user: User, context: BehaviorContext) -> tuple[float, dict]:
    if not user.baseline:
        return 10.0, {"baselineAvailable": False, "hourDeviation": 0.0}

    baseline_hour = float(user.baseline.average_login_hour or 0.0)
    current_hour = context.login_time.hour + (context.login_time.minute / 60)
    deviation = _cyclical_hour_difference(current_hour, baseline_hour)

    if deviation <= 1:
        score = 0.0
    elif deviation <= 3:
        score = (deviation - 1) * 12.5
    elif deviation <= 6:
        score = 25 + ((deviation - 3) / 3) * 45
    else:
        score = 70 + ((deviation - 6) / 6) * 30

    return _normalize_score(score), {
        "baselineAvailable": True,
        "baselineHour": round(baseline_hour, 2),
        "currentHour": round(current_hour, 2),
        "hourDeviation": round(deviation, 2),
    }


def _score_ip_change_frequency(
    user: User,
    context: BehaviorContext,
    recent_sessions: list[AccessSession],
    now: datetime,
) -> tuple[float, dict]:
    known_ips = set(user.baseline.ip_history) if user.baseline and user.baseline.ip_history else set()
    window_start = now - timedelta(hours=24)
    session_ips: list[str] = []
    for row in recent_sessions:
        issued_at = _as_utc(row.issued_at)
        if issued_at and issued_at >= window_start:
            session_ips.append(row.ip_address)
    timeline = [*session_ips, context.ip_address]

    is_new_ip = bool(known_ips) and context.ip_address not in known_ips
    transitions = _count_transitions(timeline)
    transition_rate = transitions / max(1, len(timeline) - 1)
    unique_ratio = len(set(timeline)) / max(1, len(timeline))

    if not known_ips and len(timeline) <= 1:
        score = 8.0
    else:
        score = (transition_rate * 55) + (unique_ratio * 20) + (25 if is_new_ip else 0)

    return _normalize_score(score), {
        "isNewIp": is_new_ip,
        "transitions24h": transitions,
        "transitionRate24h": round(transition_rate, 2),
        "uniqueIpRatio24h": round(unique_ratio, 2),
    }


def _score_device_change(
    user: User,
    context: BehaviorContext,
    recent_sessions: list[AccessSession],
    now: datetime,
) -> tuple[float, dict]:
    known_devices = (
        set(user.baseline.known_device_fingerprints)
        if user.baseline and user.baseline.known_device_fingerprints
        else set()
    )
    window_start = now - timedelta(hours=24)
    session_devices: list[str] = []
    for row in recent_sessions:
        issued_at = _as_utc(row.issued_at)
        if issued_at and issued_at >= window_start:
            session_devices.append(row.device_fingerprint)
    timeline = [*session_devices, context.device_fingerprint]

    is_new_device = bool(known_devices) and context.device_fingerprint not in known_devices
    transitions = _count_transitions(timeline)
    transition_rate = transitions / max(1, len(timeline) - 1)
    unique_ratio = len(set(timeline)) / max(1, len(timeline))

    if not known_devices and len(timeline) <= 1:
        score = 8.0
    else:
        score = (transition_rate * 45) + (unique_ratio * 20) + (35 if is_new_device else 0)

    return _normalize_score(score), {
        "isNewDevice": is_new_device,
        "transitions24h": transitions,
        "transitionRate24h": round(transition_rate, 2),
        "uniqueDeviceRatio24h": round(unique_ratio, 2),
    }


def _score_session_duration_anomaly(
    db: Session,
    *,
    user: User,
    session_obj: AccessSession | None,
    now: datetime,
    event_source: str,
) -> tuple[float, dict]:
    issued_at_utc = _as_utc(session_obj.issued_at) if session_obj else None
    if event_source != "heartbeat" or not session_obj or not issued_at_utc:
        return 0.0, {"evaluated": False}

    current_seconds = max(0.0, (now - issued_at_utc).total_seconds())
    duration_rows = db.execute(
        select(AccessSession.issued_at, AccessSession.terminated_at)
        .where(
            AccessSession.user_id == user.id,
            AccessSession.terminated_at.is_not(None),
        )
        .order_by(desc(AccessSession.terminated_at))
        .limit(30)
    ).all()

    durations: list[float] = []
    for issued_at, terminated_at in duration_rows:
        issued_at_utc = _as_utc(issued_at)
        terminated_at_utc = _as_utc(terminated_at)
        if not issued_at_utc or not terminated_at_utc:
            continue
        durations.append(max(0.0, (terminated_at_utc - issued_at_utc).total_seconds()))

    if not durations:
        score = 60.0 if current_seconds > 4 * 3600 else 0.0
        return _normalize_score(score), {
            "evaluated": True,
            "historyCount": 0,
            "currentDurationSeconds": round(current_seconds, 2),
        }

    avg_duration = mean(durations)
    std_duration = pstdev(durations) if len(durations) > 1 else max(300.0, avg_duration * 0.25)
    deviation = abs(current_seconds - avg_duration)
    z_like = deviation / max(300.0, std_duration)
    score = z_like * 22

    if current_seconds > avg_duration * 3 or current_seconds < avg_duration * 0.1:
        score = max(score, 80.0)

    return _normalize_score(score), {
        "evaluated": True,
        "historyCount": len(durations),
        "currentDurationSeconds": round(current_seconds, 2),
        "averageDurationSeconds": round(avg_duration, 2),
        "stdDurationSeconds": round(std_duration, 2),
        "zLikeDeviation": round(z_like, 2),
    }


def _score_login_attempt_frequency(
    db: Session,
    user: User,
    context: BehaviorContext,
    now: datetime,
) -> tuple[float, dict]:
    from_time = now - timedelta(hours=1)
    login_events = {
        "AUTH_SUCCESS",
        "AUTH_FAILURE",
        "AUTH_DENY",
        "AUTH_STEP_UP_REQUIRED",
        "AUTH_STEP_UP_FAILURE",
        "AUTH_CRITICAL_LOCK",
    }
    failed_events = {"AUTH_FAILURE", "AUTH_DENY", "AUTH_STEP_UP_FAILURE", "AUTH_CRITICAL_LOCK"}

    rows = db.scalars(
        select(AuditLog.event_type).where(
            AuditLog.user_id == user.id,
            AuditLog.timestamp >= from_time,
            AuditLog.event_type.in_(login_events),
        )
    ).all()

    attempts_last_hour = len(rows) + 1
    failed_last_hour = sum(1 for item in rows if item in failed_events)

    attempt_pressure = min(1.0, attempts_last_hour / 8.0)
    failure_ratio = failed_last_hour / max(1, attempts_last_hour)
    carry_over_failures = min(1.0, context.failed_login_attempts / 5.0)

    score = (attempt_pressure * 50) + (failure_ratio * 35) + (carry_over_failures * 15)
    return _normalize_score(score), {
        "attemptsLastHour": attempts_last_hour,
        "failedLastHour": failed_last_hour,
        "attemptPressure": round(attempt_pressure, 2),
        "failureRatio": round(failure_ratio, 2),
        "carryOverFailures": round(carry_over_failures, 2),
    }


def _count_transitions(values: list[str]) -> int:
    if len(values) <= 1:
        return 0
    return sum(1 for idx in range(1, len(values)) if values[idx] != values[idx - 1])


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
