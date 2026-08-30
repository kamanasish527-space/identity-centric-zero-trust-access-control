from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_token_payload, require_csrf, require_roles
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.risk import AttackSimulationResetResponse, AttackSimulationResponse, LiveRiskResponse
from app.services.attack_simulation_service import reset_attack_simulation, run_attack_simulation
from app.services.anomaly_engine import get_live_risk_snapshot

router = APIRouter(prefix="/risk", tags=["risk"])


@router.get("/live", response_model=LiveRiskResponse)
def live_risk(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return LiveRiskResponse(**get_live_risk_snapshot(db, current_user))


@router.post("/simulate-attack", response_model=AttackSimulationResponse)
def simulate_attack(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
    token_payload: dict = Depends(get_token_payload),
    _: None = Depends(require_csrf),
):
    return AttackSimulationResponse(
        **run_attack_simulation(
            db,
            user=current_user,
            session_id=token_payload.get("session_id"),
        )
    )


@router.post("/simulation/reset", response_model=AttackSimulationResetResponse)
def reset_simulation(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
    token_payload: dict = Depends(get_token_payload),
    _: None = Depends(require_csrf),
):
    return AttackSimulationResetResponse(
        **reset_attack_simulation(
            db,
            user=current_user,
            session_id=token_payload.get("session_id"),
        )
    )
