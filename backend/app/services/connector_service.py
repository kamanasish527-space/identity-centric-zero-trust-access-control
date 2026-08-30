from __future__ import annotations

import secrets
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_password_hash, verify_password
from app.models.external_connector import ExternalConnector
from app.schemas.connector import ConnectorAuthContext, ConnectorCreateRequest


def _generate_connector_id() -> str:
    return f"conn_{secrets.token_urlsafe(9).replace('-', '').replace('_', '')[:18]}"


def _generate_api_key() -> str:
    return f"zt_ingest_{secrets.token_urlsafe(24)}"


def create_connector(db: Session, payload: ConnectorCreateRequest) -> tuple[ExternalConnector, str]:
    existing = db.scalar(
        select(ExternalConnector).where(
            (ExternalConnector.name == payload.name) | (ExternalConnector.connector_id == payload.name)
        )
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Connector name already exists")

    api_key = _generate_api_key()
    connector = ExternalConnector(
        connector_id=_generate_connector_id(),
        name=payload.name,
        description=payload.description,
        hashed_api_key=get_password_hash(api_key),
        allowed_ips=payload.allowed_ips or [],
        is_active=True,
    )
    db.add(connector)
    db.commit()
    db.refresh(connector)
    return connector, api_key


def list_connectors(db: Session) -> list[ExternalConnector]:
    return list(db.scalars(select(ExternalConnector).order_by(ExternalConnector.created_at.desc())).all())


def get_connector_by_public_id(db: Session, connector_id: str) -> ExternalConnector | None:
    return db.scalar(select(ExternalConnector).where(ExternalConnector.connector_id == connector_id))


def rotate_connector_key(db: Session, connector: ExternalConnector) -> str:
    api_key = _generate_api_key()
    connector.hashed_api_key = get_password_hash(api_key)
    connector.updated_at = datetime.now(tz=timezone.utc)
    db.commit()
    db.refresh(connector)
    return api_key


def set_connector_active_state(db: Session, connector: ExternalConnector, *, is_active: bool) -> ExternalConnector:
    connector.is_active = is_active
    connector.updated_at = datetime.now(tz=timezone.utc)
    db.commit()
    db.refresh(connector)
    return connector


def authenticate_connector(
    db: Session,
    *,
    connector_id: str | None,
    api_key: str | None,
    client_ip: str | None,
) -> ConnectorAuthContext:
    if not connector_id or not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing connector credentials",
            headers={"WWW-Authenticate": "Connector-Key"},
        )

    connector = get_connector_by_public_id(db, connector_id)
    if connector is None or not connector.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid connector")

    if not verify_password(api_key, connector.hashed_api_key):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid connector credentials")

    allowed_ips = connector.allowed_ips or []
    if allowed_ips and client_ip and client_ip not in allowed_ips:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Connector IP not allowed")

    connector.last_used_at = datetime.now(tz=timezone.utc)
    connector.last_used_ip = client_ip
    db.commit()

    return ConnectorAuthContext(
        connector_id=connector.connector_id,
        name=connector.name,
        allowed_ips=allowed_ips,
        authenticated_at=connector.last_used_at,
    )


def initialize_bootstrap_connector(db: Session) -> tuple[ExternalConnector, str] | None:
    name = settings.bootstrap_ingest_connector_name
    connector_id = settings.bootstrap_ingest_connector_id
    api_key = settings.bootstrap_ingest_connector_key

    if not (name and connector_id and api_key):
        return None

    existing = get_connector_by_public_id(db, connector_id)
    if existing:
        return None

    connector = ExternalConnector(
        connector_id=connector_id,
        name=name,
        description="Bootstrap external ingestion connector",
        hashed_api_key=get_password_hash(api_key),
        allowed_ips=[],
        is_active=True,
    )
    db.add(connector)
    db.commit()
    db.refresh(connector)
    return connector, api_key
