from __future__ import annotations

import logging
import random
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.event_queue import enqueue_event, get_queue_size
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.ingest import IngestAcceptedResponse, IngestEventRequest, TestEventResponse
from app.services.audit_service import log_event


logger = logging.getLogger("ingest.api")

router = APIRouter(prefix="/ingest", tags=["ingestion"])


@router.post("/event", response_model=IngestAcceptedResponse)
def ingest_event(
    payload: IngestEventRequest,
    db: Session = Depends(get_db),
):
    audit_log = _persist_raw_event(db, payload)

    enqueue_event(
        {
            "audit_log_id": audit_log.id,
            "event": payload.model_dump(mode="json"),
        }
    )

    logger.info(
        "event_ingested",
        extra={
            "audit_log_id": audit_log.id,
            "user_id": payload.user_id,
            "event_type": payload.event_type,
            "status": payload.status,
        },
    )

    return IngestAcceptedResponse(
        status="accepted",
        message="Event accepted and queued for processing",
        audit_log_id=audit_log.id,
        queued=True,
        queue_size=get_queue_size(),
    )


@router.get("/generate-test-event", response_model=TestEventResponse)
def generate_test_event(
    kind: str = Query(default="login", pattern="^(login|failed_login|suspicious_activity)$"),
    db: Session = Depends(get_db),
):
    payload = _build_test_event(db, kind)
    audit_log = _persist_raw_event(db, payload)
    enqueue_event(
        {
            "audit_log_id": audit_log.id,
            "event": payload.model_dump(mode="json"),
        }
    )

    logger.info(
        "test_event_generated",
        extra={
            "audit_log_id": audit_log.id,
            "event_kind": kind,
        },
    )

    return TestEventResponse(
        status="accepted",
        message="Test event generated and queued",
        audit_log_id=audit_log.id,
        queued=True,
        queue_size=get_queue_size(),
        event_kind=kind,
        payload=payload.model_dump(mode="json"),
    )


def _persist_raw_event(db: Session, payload: IngestEventRequest):
    metadata_message = payload.metadata.get("message") if payload.metadata else None
    message = str(metadata_message) if metadata_message else "Ingested external event"
    user = db.get(User, payload.user_id) if payload.user_id is not None else None

    return log_event(
        db,
        user_id=payload.user_id,
        actor_role=user.role.value if user else None,
        timestamp=payload.timestamp,
        event_type="INGEST_EVENT",
        action=payload.event_type,
        message=message,
        decision=payload.status,
        ip_address=payload.ip_address,
        device_id=payload.device,
        details={
            "ingestion_status": "queued",
            "original_event": payload.model_dump(mode="json"),
        },
        commit=True,
    )


def _build_test_event(db: Session, kind: str) -> IngestEventRequest:
    user = db.scalar(select(User).where(User.role == UserRole.ADMIN).limit(1)) or db.scalar(select(User).limit(1))
    user_id = user.id if user else None
    base_timestamp = datetime.now(tz=timezone.utc)

    base_payload: dict[str, Any] = {
        "user_id": user_id,
        "ip_address": "203.0.113.10",
        "device": "ingest-device-01",
        "event_type": "login_success",
        "status": "success",
        "timestamp": base_timestamp,
        "metadata": {
            "message": "External login success received from upstream identity provider",
            "location": "US-CA-SFO",
            "protocol": "https",
            "source": "test-generator",
        },
    }

    if kind == "failed_login":
        base_payload.update(
            {
                "ip_address": "198.51.100.77",
                "event_type": "login_failed",
                "status": "failed",
                "metadata": {
                    "message": "Upstream failed login telemetry received",
                    "location": "Unknown",
                    "protocol": "https",
                    "login_attempts": 4,
                    "source": "test-generator",
                },
            }
        )
    elif kind == "suspicious_activity":
        base_payload.update(
            {
                "ip_address": random.choice(["185.161.1.104", "45.12.9.9", "203.0.113.250"]),
                "device": "ingest-device-anomalous",
                "event_type": "suspicious_activity",
                "status": "warning",
                "timestamp": base_timestamp - timedelta(minutes=1),
                "metadata": {
                    "message": "Suspicious upstream activity with unfamiliar IP and elevated frequency",
                    "location": random.choice(["SG-SIN", "NL-AMS", "US-CA-SFO"]),
                    "protocol": "http",
                    "login_attempts": 6,
                    "simulated_phishing": True,
                    "source": "test-generator",
                },
            }
        )

    return IngestEventRequest(**base_payload)
