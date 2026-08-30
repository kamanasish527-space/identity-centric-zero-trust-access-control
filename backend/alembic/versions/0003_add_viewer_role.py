"""Add viewer role to user enum

Revision ID: 0003_add_viewer_role
Revises: 0002_anomaly_events
Create Date: 2026-02-27 00:00:00
"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "0003_add_viewer_role"
down_revision: Union[str, Sequence[str], None] = "0002_anomaly_events"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_type t
                JOIN pg_enum e ON t.oid = e.enumtypid
                WHERE t.typname = 'userrole'
                  AND e.enumlabel = 'VIEWER'
            ) THEN
                ALTER TYPE userrole ADD VALUE 'VIEWER';
            END IF;
        END
        $$;
        """
    )


def downgrade() -> None:
    # PostgreSQL enum values cannot be removed without recreating the type.
    # Intentionally left as no-op.
    pass
