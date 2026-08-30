from fastapi import APIRouter

from app.api.v1.endpoints import admin, auth, dashboard, health, risk, sessions, settings, simulation

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(dashboard.router)
api_router.include_router(risk.router)
api_router.include_router(simulation.router)
api_router.include_router(sessions.router)
api_router.include_router(settings.router)
api_router.include_router(admin.router)
