import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy.exc import SQLAlchemyError

from app.api.v1.api import api_router
from app.api.v1.endpoints.ingest import router as ingest_router
from app.api.v1.endpoints.ml import router as ml_router
from app.api.v1.endpoints.risk import router as risk_router
from app.api.v1.endpoints.simulation import router as simulation_router
from app.core.config import settings
from app.core.event_queue import start_event_worker, stop_event_worker
from app.core.logging_config import configure_logging
from app.core.middleware import SecurityHeadersMiddleware
from app.core.rate_limiter import limiter
from app.core.websocket_manager import ws_manager
from app.db.base import Base
from app.db.init_db import initialize_defaults
from app.db.session import SessionLocal, engine
from app.services.event_processor import process_event

configure_logging(settings.log_level)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    ws_manager.set_loop(asyncio.get_running_loop())

    if settings.is_sqlite:
        Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        try:
            initialize_defaults(db)
        except SQLAlchemyError:
            logger.exception("failed_to_initialize_defaults")
            db.rollback()

    start_event_worker(process_event)

    yield

    stop_event_worker()


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    debug=settings.debug,
    lifespan=lifespan,
)

app.state.limiter = limiter

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(SecurityHeadersMiddleware)


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException):
    detail = exc.detail
    if isinstance(detail, dict):
        code = detail.get("code", "http_error")
        message = detail.get("message", "Request failed")
        details = detail.get("details")
    else:
        code = "http_error"
        message = str(detail)
        details = None

    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": code, "message": message, "details": details}},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "validation_error",
                "message": "Input validation failed",
                "details": exc.errors(),
            }
        },
    )


@app.exception_handler(RateLimitExceeded)
async def rate_limit_exception_handler(_: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={
            "error": {
                "code": "rate_limited",
                "message": "Rate limit exceeded",
                "details": str(exc),
            }
        },
    )


@app.exception_handler(Exception)
async def generic_exception_handler(_: Request, exc: Exception):
    logger.exception("unhandled_exception", exc_info=exc)
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "internal_error",
                "message": "An internal error occurred",
                "details": None,
            }
        },
    )


@app.get("/")
def root():
    return {
        "name": settings.app_name,
        "status": "running",
        "timestamp": datetime.now(tz=timezone.utc).isoformat(),
        "docs": "/docs",
    }


@app.websocket("/ws/events")
async def websocket_events(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)


app.include_router(api_router, prefix=settings.api_v1_str)
app.include_router(ingest_router, prefix="/api")
app.include_router(risk_router, prefix="/api")
app.include_router(simulation_router, prefix="/api")
app.include_router(ml_router, prefix="/api")
