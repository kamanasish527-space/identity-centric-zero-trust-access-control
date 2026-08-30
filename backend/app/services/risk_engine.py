from dataclasses import dataclass
from datetime import datetime

from app.models.app_settings import AppSettings
from app.models.baseline import BehaviorBaseline
from app.services.mitre_service import map_anomalies_to_mitre


@dataclass
class BehaviorContext:
    login_time: datetime
    ip_address: str
    device_fingerprint: str
    location: str
    protocol: str = "https"
    access_frequency_24h: int = 1
    failed_login_attempts: int = 0
    simulated_phishing: bool = False


@dataclass
class RiskEvaluation:
    score: float
    level: str
    anomalies: list[str]
    threat_classification: str
    mitre_matches: list[dict]


def _normalize_score(value: float) -> float:
    return float(max(0.0, min(100.0, round(value, 2))))


def _cyclical_hour_difference(hour_a: float, hour_b: float) -> float:
    direct = abs(hour_a - hour_b)
    return min(direct, 24 - direct)


def classify_risk_level(score: float, app_settings: AppSettings) -> str:
    if score < app_settings.risk_low_threshold:
        return "low"
    if score < app_settings.risk_medium_threshold:
        return "medium"
    if score < app_settings.risk_high_threshold:
        return "high"
    return "critical"


def classify_threat(risk_level: str) -> str:
    mapping = {
        "low": "normal",
        "medium": "suspicious",
        "high": "malicious",
        "critical": "active_compromise",
    }
    return mapping.get(risk_level, "unknown")


def evaluate_risk(
    baseline: BehaviorBaseline | None,
    context: BehaviorContext,
    app_settings: AppSettings,
    mitre_enabled: bool,
) -> RiskEvaluation:
    score = 0.0
    anomalies: list[str] = []

    hour = context.login_time.hour + (context.login_time.minute / 60)

    if baseline is None:
        score += 8.0
    else:
        hour_diff = _cyclical_hour_difference(hour, baseline.average_login_hour)
        if hour_diff > 6:
            score += 25
            anomalies.append("unusual_login_time")
        elif hour_diff > 3:
            score += 10

        if context.location not in baseline.known_locations:
            score += 20
            anomalies.append("unfamiliar_location")

        if context.device_fingerprint not in baseline.known_device_fingerprints:
            score += 25
            anomalies.append("new_device")

        if context.ip_address not in baseline.ip_history:
            score += 15
            anomalies.append("new_ip")

        allowed_frequency = max(3.0, baseline.access_frequency_per_day * 2)
        if float(context.access_frequency_24h) > allowed_frequency:
            score += 18
            anomalies.append("abnormal_access_frequency")

    if context.failed_login_attempts >= 2:
        score += 20
        anomalies.append("brute_force_pattern")

    if context.protocol.lower() != "https":
        score += 12
        anomalies.append("protocol_anomaly")

    if context.simulated_phishing:
        score += 30
        anomalies.append("phishing_indicator")

    score = _normalize_score(score)
    level = classify_risk_level(score, app_settings)
    threat_classification = classify_threat(level)
    mitre_matches = map_anomalies_to_mitre(anomalies) if mitre_enabled else []

    return RiskEvaluation(
        score=score,
        level=level,
        anomalies=anomalies,
        threat_classification=threat_classification,
        mitre_matches=mitre_matches,
    )
