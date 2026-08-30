from datetime import datetime, timedelta, timezone
import random

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.ml.feature_extractor import extract_features
from app.ml.model_loader import get_model
from app.models.user import User

router = APIRouter(prefix="/ml", tags=["ml"])


@router.get("/anomaly-test")
def anomaly_test(_: User = Depends(get_current_user)):
    """Generate sample session data, run ML anomaly detection, and return results."""
    now = datetime.now(tz=timezone.utc)

    baseline = {
        "average_login_hour": 9,
        "known_ips": ["192.168.1.10", "10.0.0.5", "203.0.113.10"],
        "known_devices": ["fp_76c8530a", "fp_91ab12cd"],
        "avg_session_duration": 1800.0,  # 30 minutes
    }

    session_data = {
        "login_time": now - timedelta(minutes=random.randint(0, 45)),
        "ip_address": random.choice(["203.0.113.50", "198.51.100.7", "192.168.1.10"]),
        "device_fingerprint": random.choice(["fp_76c8530a", "fp_deadbeef", "fp_91ab12cd"]),
        "session_duration": random.uniform(300, 7200),
        "login_attempts": random.randint(1, 12),
    }

    features = extract_features(session_data, baseline)
    model = get_model()
    result = model.predict(features)

    return {
        "features": features,
        "anomaly_score": result.score,
        "risk_level": result.label,
    }
