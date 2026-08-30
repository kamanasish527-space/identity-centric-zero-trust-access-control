from datetime import datetime

from pydantic import BaseModel


class DashboardOverview(BaseModel):
    total_users: int
    active_sessions: int
    high_risk_attempts: int
    denied_attempts: int


class ActivityLogEntry(BaseModel):
    id: int
    timestamp: datetime
    username: str | None
    event_type: str
    action: str
    risk_score: float | None
    risk_level: str | None
    decision: str | None
    mitre_technique_id: str | None
    mitre_technique_name: str | None
    mitre_tactic: str | None
    ip_address: str | None
    device_id: str | None
    message: str


class RiskTrendPoint(BaseModel):
    timestamp: datetime
    risk_score: float


class DecisionBreakdown(BaseModel):
    decision: str
    count: int


class MitreTechniqueCount(BaseModel):
    technique_id: str
    technique_name: str
    count: int


class ThreatIntelItem(BaseModel):
    timestamp: datetime
    severity: str
    risk_level: str
    technique_id: str | None
    technique_name: str | None
    tactic: str | None
    summary: str


class SessionMonitorState(BaseModel):
    session_id: str
    is_active: bool
    risk_score: float
    risk_level: str
    termination_reason: str | None


class RiskAnalyticsResponse(BaseModel):
    trend: list[RiskTrendPoint]
    decision_breakdown: list[DecisionBreakdown]
    mitre_techniques: list[MitreTechniqueCount]


class HealthComponent(BaseModel):
    name: str
    status: str
    message: str
    latency_ms: float | None = None


class SystemArchitectureHealthResponse(BaseModel):
    timestamp: datetime
    overall_status: str
    microservices: list[HealthComponent]
    database: HealthComponent
    api_latency_ms: float
    api_latency_status: str
    cpu_usage_percent: float
    cpu_status: str
    memory_usage_percent: float
    memory_status: str
