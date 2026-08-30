"""Initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-02-22 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0001_initial"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


userrole = sa.Enum("USER", "ANALYST", "ADMIN", name="userrole")


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "sqlite":
        userrole.create(bind, checkfirst=True)

    op.create_table(
        "app_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("risk_low_threshold", sa.Float(), nullable=False, server_default="30"),
        sa.Column("risk_medium_threshold", sa.Float(), nullable=False, server_default="60"),
        sa.Column("risk_high_threshold", sa.Float(), nullable=False, server_default="80"),
        sa.Column("continuous_monitoring_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("mitre_mapping_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("session_monitor_interval_seconds", sa.Integer(), nullable=False, server_default="20"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("username", sa.String(length=50), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("role", userrole if bind.dialect.name != "sqlite" else sa.String(length=20), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_locked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("lock_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failed_login_attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.func.now()),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)
    op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    op.create_table(
        "behavior_baselines",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("average_login_hour", sa.Float(), nullable=False, server_default="0"),
        sa.Column("known_locations", sa.JSON(), nullable=False),
        sa.Column("known_device_fingerprints", sa.JSON(), nullable=False),
        sa.Column("ip_history", sa.JSON(), nullable=False),
        sa.Column("access_frequency_per_day", sa.Float(), nullable=False, server_default="1"),
        sa.Column("last_updated_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )

    op.create_table(
        "access_sessions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("terminated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("termination_reason", sa.Text(), nullable=True),
        sa.Column("ip_address", sa.String(length=128), nullable=False),
        sa.Column("device_fingerprint", sa.String(length=255), nullable=False),
        sa.Column("location", sa.String(length=255), nullable=False),
        sa.Column("current_risk_score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("current_risk_level", sa.String(length=20), nullable=False, server_default="low"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_access_sessions_user_id"), "access_sessions", ["user_id"], unique=False)

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=True, server_default=sa.func.now()),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("actor_role", sa.String(length=20), nullable=True),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("action", sa.String(length=128), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("risk_score", sa.Float(), nullable=True),
        sa.Column("risk_level", sa.String(length=20), nullable=True),
        sa.Column("decision", sa.String(length=40), nullable=True),
        sa.Column("mitre_technique_id", sa.String(length=20), nullable=True),
        sa.Column("mitre_technique_name", sa.String(length=255), nullable=True),
        sa.Column("mitre_tactic", sa.String(length=100), nullable=True),
        sa.Column("ip_address", sa.String(length=128), nullable=True),
        sa.Column("device_id", sa.String(length=255), nullable=True),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_audit_logs_id"), "audit_logs", ["id"], unique=False)
    op.create_index(op.f("ix_audit_logs_timestamp"), "audit_logs", ["timestamp"], unique=False)
    op.create_index(op.f("ix_audit_logs_user_id"), "audit_logs", ["user_id"], unique=False)
    op.create_index(op.f("ix_audit_logs_event_type"), "audit_logs", ["event_type"], unique=False)

    op.create_table(
        "step_up_challenges",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("challenge_code", sa.String(length=10), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_used", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_step_up_challenges_user_id"), "step_up_challenges", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_step_up_challenges_user_id"), table_name="step_up_challenges")
    op.drop_table("step_up_challenges")

    op.drop_index(op.f("ix_audit_logs_event_type"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_user_id"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_timestamp"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_id"), table_name="audit_logs")
    op.drop_table("audit_logs")

    op.drop_index(op.f("ix_access_sessions_user_id"), table_name="access_sessions")
    op.drop_table("access_sessions")

    op.drop_table("behavior_baselines")

    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_index(op.f("ix_users_username"), table_name="users")
    op.drop_index(op.f("ix_users_id"), table_name="users")
    op.drop_table("users")

    op.drop_table("app_settings")

    bind = op.get_bind()
    if bind.dialect.name != "sqlite":
        userrole.drop(bind, checkfirst=True)
