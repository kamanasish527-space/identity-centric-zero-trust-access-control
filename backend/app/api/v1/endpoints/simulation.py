from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user, get_token_payload, require_csrf, require_roles
from app.models.user import User, UserRole
from app.schemas.simulation import SimulationStatusResponse
from app.services.simulation_engine import simulation_engine

router = APIRouter(prefix="/simulation", tags=["simulation"])


@router.post("/start", response_model=SimulationStatusResponse)
def start_simulation(
    current_user: User = Depends(get_current_user),
    token_payload: dict = Depends(get_token_payload),
    _: None = Depends(require_csrf),
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    return SimulationStatusResponse(
        **simulation_engine.start(
            user=current_user,
            session_id=token_payload.get("session_id"),
        )
    )


@router.post("/stop", response_model=SimulationStatusResponse)
def stop_simulation(
    _: User = Depends(require_roles(UserRole.ADMIN)),
    __: None = Depends(require_csrf),
):
    return SimulationStatusResponse(**simulation_engine.stop())


@router.post("/reset", response_model=SimulationStatusResponse)
def reset_simulation(
    _: User = Depends(require_roles(UserRole.ADMIN)),
    __: None = Depends(require_csrf),
):
    return SimulationStatusResponse(**simulation_engine.reset())


@router.get("/status", response_model=SimulationStatusResponse)
def simulation_status(
    _: User = Depends(get_current_user),
):
    return SimulationStatusResponse(**simulation_engine.get_status())
