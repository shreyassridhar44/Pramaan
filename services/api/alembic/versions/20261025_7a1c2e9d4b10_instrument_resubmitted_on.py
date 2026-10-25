"""instrument resubmitted_on

Revision ID: 7a1c2e9d4b10
Revises: bdd5b41ff9e1
Create Date: 2026-10-25 08:30:00
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "7a1c2e9d4b10"
down_revision: str | None = "bdd5b41ff9e1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("instruments", sa.Column("resubmitted_on", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("instruments", "resubmitted_on")
