from enum import Enum


class PolicyDecision(str, Enum):
    ALLOW = "allow"
    STEP_UP = "step_up"
    DENY = "deny"
    LOCK_AND_ALERT = "lock_and_alert"


def decide_policy(risk_level: str) -> PolicyDecision:
    if risk_level == "low":
        return PolicyDecision.ALLOW
    if risk_level == "medium":
        return PolicyDecision.STEP_UP
    if risk_level == "high":
        return PolicyDecision.DENY
    return PolicyDecision.LOCK_AND_ALERT
