from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_csrf, require_roles
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.connector import ConnectorCreateRequest, ConnectorSecretResponse, ConnectorSummary
from app.services.audit_service import log_event
from app.services.connector_service import (
    create_connector,
    get_connector_by_public_id,
    list_connectors,
    rotate_connector_key,
    set_connector_active_state,
)

router = APIRouter(prefix="/connectors", tags=["connectors"])


@router.get("", response_model=list[ConnectorSummary])
def get_connectors(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.ANALYST)),
):
    rows = list_connectors(db)
    return [
        ConnectorSummary(
            connector_id=row.connector_id,
            name=row.name,
            description=row.description,
            allowed_ips=row.allowed_ips or [],
            is_active=row.is_active,
            created_at=row.created_at,
            updated_at=row.updated_at,
            last_used_at=row.last_used_at,
            last_used_ip=row.last_used_ip,
        )
        for row in rows
    ]


@router.post("", response_model=ConnectorSecretResponse, status_code=status.HTTP_201_CREATED)
def create_external_connector(
    payload: ConnectorCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
    _: None = Depends(require_csrf),
):
    connector, api_key = create_connector(db, payload)

    log_event(
        db,
        user_id=current_user.id,
        actor_role=current_user.role.value,
        event_type="ADMIN_CONNECTOR_CREATE",
        action="create_ingest_connector",
        message=f"Admin created external connector {connector.name}",
        decision="allow",
        details={"connector_id": connector.connector_id, "name": connector.name},
    )

    return ConnectorSecretResponse(
        connector_id=connector.connector_id,
        name=connector.name,
        api_key=api_key,
        description=connector.description,
        allowed_ips=connector.allowed_ips or [],
        is_active=connector.is_active,
    )


@router.post("/{connector_id}/rotate", response_model=ConnectorSecretResponse)
def rotate_external_connector(
    connector_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
    _: None = Depends(require_csrf),
):
    connector = get_connector_by_public_id(db, connector_id)
    if connector is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connector not found")

    api_key = rotate_connector_key(db, connector)

    log_event(
        db,
        user_id=current_user.id,
        actor_role=current_user.role.value,
        event_type="ADMIN_CONNECTOR_ROTATE",
        action="rotate_ingest_connector_key",
        message=f"Admin rotated external connector key for {connector.name}",
        decision="allow",
        details={"connector_id": connector.connector_id, "name": connector.name},
    )

    return ConnectorSecretResponse(
        connector_id=connector.connector_id,
        name=connector.name,
        api_key=api_key,
        description=connector.description,
        allowed_ips=connector.allowed_ips or [],
        is_active=connector.is_active,
    )


@router.post("/{connector_id}/activate", response_model=ConnectorSummary)
def activate_external_connector(
    connector_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
    _: None = Depends(require_csrf),
):
    connector = get_connector_by_public_id(db, connector_id)
    if connector is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connector not found")

    connector = set_connector_active_state(db, connector, is_active=True)

    log_event(
        db,
        user_id=current_user.id,
        actor_role=current_user.role.value,
        event_type="ADMIN_CONNECTOR_ACTIVATE",
        action="activate_ingest_connector",
        message=f"Admin activated external connector {connector.name}",
        decision="allow",
        details={"connector_id": connector.connector_id, "name": connector.name},
    )

    return ConnectorSummary(
        connector_id=connector.connector_id,
        name=connector.name,
        description=connector.description,
        allowed_ips=connector.allowed_ips or [],
        is_active=connector.is_active,
        created_at=connector.created_at,
        updated_at=connector.updated_at,
        last_used_at=connector.last_used_at,
        last_used_ip=connector.last_used_ip,
    )


@router.post("/{connector_id}/deactivate", response_model=ConnectorSummary)
def deactivate_external_connector(
    connector_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
    _: None = Depends(require_csrf),
):
    connector = get_connector_by_public_id(db, connector_id)
    if connector is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connector not found")

    connector = set_connector_active_state(db, connector, is_active=False)

    log_event(
        db,
        user_id=current_user.id,
        actor_role=current_user.role.value,
        event_type="ADMIN_CONNECTOR_DEACTIVATE",
        action="deactivate_ingest_connector",
        message=f"Admin deactivated external connector {connector.name}",
        decision="allow",
        details={"connector_id": connector.connector_id, "name": connector.name},
    )

    return ConnectorSummary(
        connector_id=connector.connector_id,
        name=connector.name,
        description=connector.description,
        allowed_ips=connector.allowed_ips or [],
        is_active=connector.is_active,
        created_at=connector.created_at,
        updated_at=connector.updated_at,
        last_used_at=connector.last_used_at,
        last_used_ip=connector.last_used_ip,
    )
