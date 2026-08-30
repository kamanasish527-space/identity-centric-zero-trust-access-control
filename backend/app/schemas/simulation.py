from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


TimelineStatus = Literal["pending", "active", "completed"]


class SimulationTimelineStep(BaseModel):
    id: int
    name: str
    status: TimelineStatus


class SimulationStatusResponse(BaseModel):
    running: bool
    step: int = Field(ge=0)
    isRunning: bool
    currentStep: int = Field(ge=0)
    riskScore: float = Field(ge=0, le=100)
    anomalyScore: float = Field(ge=0, le=100)
    detectionConfidence: float = Field(ge=0, le=100)
    attackBlocked: bool = False
    sessionTerminated: bool = False
    finalOutcome: str | None = None
    timeline: list[SimulationTimelineStep]
    lastUpdated: datetime
