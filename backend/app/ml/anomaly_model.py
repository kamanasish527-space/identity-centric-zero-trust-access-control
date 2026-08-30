"""Anomaly detection model using Isolation Forest."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Iterable, List, Optional, Tuple


@dataclass
class AnomalyResult:
    """Represents anomaly inference output."""
    score: float
    label: str


class AnomalyModel:
    """Isolation Forest anomaly detection model with persistence."""

    def __init__(self, model_path: str | None = None) -> None:
        self.model_path = model_path or os.path.join(os.path.dirname(__file__), "model.pkl")
        self.model = None
        self.score_min: float | None = None
        self.score_max: float | None = None
        self._import_error: Exception | None = None
        self._load_or_init()

    @staticmethod
    def _lazy_imports() -> Tuple[Optional[object], Optional[type], Optional[Exception]]:
        try:
            import joblib  # type: ignore
            from sklearn.ensemble import IsolationForest  # type: ignore
            return joblib, IsolationForest, None
        except Exception as exc:  # pragma: no cover - environment-dependent
            return None, None, exc

    def _load_or_init(self) -> None:
        joblib, IsolationForest, import_error = self._lazy_imports()
        self._import_error = import_error
        if import_error:
            self.model = None
            return

        if os.path.exists(self.model_path):
            payload = joblib.load(self.model_path)
            if isinstance(payload, dict):
                self.model = payload.get("model")
                self.score_min = payload.get("score_min")
                self.score_max = payload.get("score_max")
            else:
                self.model = payload
        else:
            self.model = IsolationForest(n_estimators=100, contamination=0.1, random_state=42)

    def train(self, data: Iterable[Iterable[float]]) -> None:
        if self._import_error:
            raise RuntimeError(
                "ML dependencies not installed. Install scikit-learn and joblib to train the model."
            ) from self._import_error

        data_list: List[List[float]] = [list(row) for row in data]
        if not data_list:
            raise ValueError("Training data is empty.")

        joblib, IsolationForest, _ = self._lazy_imports()
        if not joblib or not IsolationForest:
            raise RuntimeError("ML dependencies not installed. Cannot train the model.")

        if self.model is None:
            self.model = IsolationForest(n_estimators=100, contamination=0.1, random_state=42)

        self.model.fit(data_list)

        scores = self.model.score_samples(data_list)
        # score_samples: higher = more normal. We invert for anomaly scaling.
        inverted = [-s for s in scores]
        self.score_min = min(inverted)
        self.score_max = max(inverted)

        joblib.dump(
            {"model": self.model, "score_min": self.score_min, "score_max": self.score_max},
            self.model_path,
        )

    def _scale_score(self, raw_inverted_score: float) -> float:
        if self.score_min is None or self.score_max is None or self.score_max == self.score_min:
            # Fallback scaling using a bounded sigmoid-like mapping.
            # In IsolationForest, decision_function/score_samples roughly near 0 for boundary.
            # We convert inverted raw to 0-100 in a stable way without training stats.
            return max(0.0, min(100.0, 50.0 + (raw_inverted_score * 50.0)))
        return max(0.0, min(100.0, ((raw_inverted_score - self.score_min) / (self.score_max - self.score_min)) * 100.0))

    def predict(self, features: Iterable[float]) -> AnomalyResult:
        if self._import_error:
            raise RuntimeError(
                "ML dependencies not installed. Install scikit-learn and joblib to run predictions."
            ) from self._import_error

        joblib, IsolationForest, _ = self._lazy_imports()
        if not IsolationForest:
            raise RuntimeError("ML dependencies not installed. Cannot run predictions.")

        if self.model is None:
            self.model = IsolationForest(n_estimators=100, contamination=0.1, random_state=42)

        vector = [list(features)]
        raw_score = self.model.score_samples(vector)[0]
        inverted = -raw_score
        anomaly_score = self._scale_score(inverted)

        if anomaly_score < 30:
            label = "normal"
        elif anomaly_score <= 70:
            label = "suspicious"
        else:
            label = "high"

        return AnomalyResult(score=round(anomaly_score, 2), label=label)
