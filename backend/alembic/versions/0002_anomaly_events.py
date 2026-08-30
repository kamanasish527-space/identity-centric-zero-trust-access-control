"""Add anomaly events table

Revision ID: 0002_anomaly_events
Revises: 0001_initial
Create Date: 2026-02-26 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0002_anomaly_events"
down_revision: Union[str, Sequence[str], None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "anomaly_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("detected_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.func.now()),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("session_id", sa.String(length=36), nullable=True),
        sa.Column("event_source", sa.String(length=32), nullable=False, server_default=sa.text("'login'")),
        sa.Column("anomaly_score", sa.Float(), nullable=False),
        sa.Column("total_risk_score", sa.Float(), nullable=False),
        sa.Column("risk_level", sa.String(length=20), nullable=False),
        sa.Column("alert_triggered", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("login_time_score", sa.Float(), nullable=False),
        sa.Column("ip_change_score", sa.Float(), nullable=False),
        sa.Column("device_change_score", sa.Float(), nullable=False),
        sa.Column("session_pattern_score", sa.Float(), nullable=False),
        sa.Column("login_attempt_score", sa.Float(), nullable=False),
        sa.Column("factors", sa.JSON(), nullable=True),
        sa.Column("metrics", sa.JSON(), nullable=True),
        sa.Column("ip_address", sa.String(length=128), nullable=True),
        sa.Column("device_fingerprint", sa.String(length=255), nullable=True),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("engine_version", sa.String(length=32), nullable=False, server_default=sa.text("'rule_v1'")),
        sa.ForeignKeyConstraint(["session_id"], ["access_sessions.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_anomaly_events_id"), "anomaly_events", ["id"], unique=False)
    op.create_index(op.f("ix_anomaly_events_detected_at"), "anomaly_events", ["detected_at"], unique=False)
    op.create_index(op.f("ix_anomaly_events_user_id"), "anomaly_events", ["user_id"], unique=False)
    op.create_index(op.f("ix_anomaly_events_session_id"), "anomaly_events", ["session_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_anomaly_events_session_id"), table_name="anomaly_events")
    op.drop_index(op.f("ix_anomaly_events_user_id"), table_name="anomaly_events")
    op.drop_index(op.f("ix_anomaly_events_detected_at"), table_name="anomaly_events")
    op.drop_index(op.f("ix_anomaly_events_id"), table_name="anomaly_events")
    op.drop_table("anomaly_events")
