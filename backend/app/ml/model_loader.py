"""Model loader utility for ML artifacts."""

from __future__ import annotations

from typing import Optional

from .anomaly_model import AnomalyModel

_MODEL_INSTANCE: AnomalyModel | None = None

def load_anomaly_model(path: Optional[str] = None) -> AnomalyModel:
    """Load and return an anomaly model instance."""
    return AnomalyModel(model_path=path)


def get_model(path: Optional[str] = None) -> AnomalyModel:
    """Return a singleton AnomalyModel instance."""
    global _MODEL_INSTANCE
    if _MODEL_INSTANCE is None:
        _MODEL_INSTANCE = AnomalyModel(model_path=path)
    return _MODEL_INSTANCE
