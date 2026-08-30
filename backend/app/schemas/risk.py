from datetime import datetime

from pydantic import BaseModel


class RiskFactorBreakdown(BaseModel):
    loginTime: float
    ipChange: float
    deviceChange: float
    sessionPattern: float


class RiskInsightKeyword(BaseModel):
    text: str
    severity: str


class RiskInsight(BaseModel):
    severity: str
    explanation: str
    mitigation: str
    keywords: list[RiskInsightKeyword]
    generatedAt: datetime


class LiveRiskResponse(BaseModel):
    totalRisk: float
    anomalyScore: float
    factors: RiskFactorBreakdown
    insight: RiskInsight


class MitreTechniqueItem(BaseModel):
    technique_id: str
    technique_name: str
    tactic: str
    explanation: str


class AttackSimulationResponse(BaseModel):
    simulationActive: bool
    totalRisk: float
    anomalyScore: float
    riskLevel: str
    decision: str
    sessionTerminated: bool
    terminationReason: str | None = None
    alert: bool
    factors: RiskFactorBreakdown
    simulatedBehaviors: list[str]
    mitre: list[MitreTechniqueItem]
    activityMessage: str
    timestamp: datetime


class AttackSimulationResetResponse(BaseModel):
    simulationActive: bool
    totalRisk: float
    riskLevel: str
    message: str
    timestamp: datetime
