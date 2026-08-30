"""Feature extraction utilities for ML pipelines."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, Iterable, List


@dataclass
class FeatureVector:
    """Typed container for extracted features."""
    values: Dict[str, float]


class FeatureExtractor:
    """Base feature extractor. Extend for concrete implementations."""

    def extract(self, payload: Dict[str, Any]) -> FeatureVector:
        """Extract numeric features from raw payload."""
        return FeatureVector(values={})


def _safe_list(value: Iterable[str] | None) -> List[str]:
    if not value:
        return []
    return list(value)


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _normalize(value: float, scale: float) -> float:
    if scale <= 0:
        return value
    return value / scale


def extract_features(session_data: Dict[str, Any], baseline: Dict[str, Any]) -> List[float]:
    """Extract numeric features for anomaly detection.

    Inputs:
    - session_data: login_time (datetime), ip_address (str), device_fingerprint (str),
      session_duration (float), login_attempts (int)
    - baseline: average_login_hour (int), known_ips (list), known_devices (list),
      avg_session_duration (float)

    Output:
    [login_time_deviation, is_new_ip, is_new_device, session_duration_deviation, login_attempt_frequency]
    """

    login_time = session_data.get("login_time")
    if not isinstance(login_time, datetime):
        raise ValueError("session_data.login_time must be a datetime")

    login_hour = login_time.hour + (login_time.minute / 60.0) + (login_time.second / 3600.0)
    baseline_hour = _safe_float(baseline.get("average_login_hour"), 0.0)
    login_time_deviation = abs(login_hour - baseline_hour)
    # Normalize to 0-1 range by 24h window to keep scale stable.
    login_time_deviation = _normalize(login_time_deviation, 24.0)

    known_ips = _safe_list(baseline.get("known_ips"))
    ip_address = str(session_data.get("ip_address") or "")
    is_new_ip = 1.0 if ip_address and ip_address not in known_ips else 0.0

    known_devices = _safe_list(baseline.get("known_devices"))
    device_fingerprint = str(session_data.get("device_fingerprint") or "")
    is_new_device = 1.0 if device_fingerprint and device_fingerprint not in known_devices else 0.0

    avg_session_duration = _safe_float(baseline.get("avg_session_duration"), 0.0)
    session_duration = _safe_float(session_data.get("session_duration"), 0.0)
    session_duration_deviation = abs(session_duration - avg_session_duration)
    # Normalize by baseline duration if provided to keep scale consistent.
    session_duration_deviation = _normalize(session_duration_deviation, max(avg_session_duration, 1.0))

    login_attempt_frequency = _safe_float(session_data.get("login_attempts"), 0.0)

    return [
        login_time_deviation,
        is_new_ip,
        is_new_device,
        session_duration_deviation,
        login_attempt_frequency,
    ]
