from __future__ import annotations

from datetime import datetime, timezone


def _normalize_score(value: float) -> float:
    return float(max(0.0, min(100.0, round(float(value), 2))))


def _severity_for_score(score: float) -> str:
    if score >= 85:
        return "critical"
    if score >= 70:
        return "high"
    if score >= 40:
        return "medium"
    return "low"


def _mitigation_for_severity(severity: str) -> str:
    mapping = {
        "critical": "Immediately terminate the session, lock the account, and open a SOC incident for containment.",
        "high": "Deny access, enforce step-up authentication, and investigate source IP/device telemetry.",
        "medium": "Require step-up authentication and monitor subsequent access attempts for escalation.",
        "low": "Continue monitoring with standard controls and keep behavioral baseline updates enabled.",
    }
    return mapping.get(severity, mapping["low"])


def generateRiskExplanation(riskFactors: dict) -> dict:
    total_risk = _normalize_score(riskFactors.get("totalRisk", 0.0))
    anomaly_score = _normalize_score(riskFactors.get("anomalyScore", 0.0))
    factors = riskFactors.get("factors", {}) or {}

    login_time = _normalize_score(factors.get("loginTime", 0.0))
    ip_change = _normalize_score(factors.get("ipChange", 0.0))
    device_change = _normalize_score(factors.get("deviceChange", 0.0))
    session_pattern = _normalize_score(factors.get("sessionPattern", 0.0))

    keywords: list[dict[str, str]] = []
    reason_chunks: list[str] = []

    if ip_change >= 35:
        reason_chunks.append("Login observed from unusual geographic region with foreign IP characteristics.")
        keywords.append({"text": "unusual geographic region", "severity": "high" if ip_change >= 70 else "medium"})
        keywords.append({"text": "foreign IP", "severity": "high" if ip_change >= 70 else "medium"})

    if device_change >= 35:
        reason_chunks.append("Device fingerprint mismatch detected against known trusted device history.")
        keywords.append({"text": "Device fingerprint mismatch", "severity": "high" if device_change >= 70 else "medium"})

    if login_time >= 35:
        reason_chunks.append("Authentication time deviates significantly from baseline login behavior.")
        keywords.append({"text": "deviates significantly", "severity": "high" if login_time >= 70 else "medium"})

    if session_pattern >= 35:
        reason_chunks.append("Session interaction pattern indicates abnormal frequency and continuity.")
        keywords.append({"text": "abnormal frequency", "severity": "high" if session_pattern >= 70 else "medium"})

    if not reason_chunks:
        reason_chunks.append("Current identity behavior remains within expected baseline thresholds.")
        keywords.append({"text": "expected baseline", "severity": "medium"})

    severity = _severity_for_score(total_risk)
    risk_delta = int(round(anomaly_score))

    explanation = f"{' '.join(reason_chunks)} Risk increased by {risk_delta}%."
    mitigation = _mitigation_for_severity(severity)

    return {
        "severity": severity,
        "explanation": explanation,
        "mitigation": mitigation,
        "keywords": keywords,
        "generatedAt": datetime.now(tz=timezone.utc),
    }
