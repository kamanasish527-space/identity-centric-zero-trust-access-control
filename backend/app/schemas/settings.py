from pydantic import BaseModel, Field, model_validator


class AppSettingsResponse(BaseModel):
    risk_low_threshold: float
    risk_medium_threshold: float
    risk_high_threshold: float
    continuous_monitoring_enabled: bool
    mitre_mapping_enabled: bool
    session_monitor_interval_seconds: int


class AppSettingsUpdate(BaseModel):
    risk_low_threshold: float = Field(ge=0, le=100)
    risk_medium_threshold: float = Field(ge=0, le=100)
    risk_high_threshold: float = Field(ge=0, le=100)
    continuous_monitoring_enabled: bool
    mitre_mapping_enabled: bool
    session_monitor_interval_seconds: int = Field(ge=5, le=300)

    @model_validator(mode="after")
    def validate_threshold_order(self):
        if not (self.risk_low_threshold < self.risk_medium_threshold < self.risk_high_threshold):
            raise ValueError("Thresholds must satisfy low < medium < high")
        return self
