"""projects: published + published_at (M5 Publish)

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-07
"""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("published", sa.Boolean(), server_default="0", nullable=False),
    )
    op.add_column(
        "projects",
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("projects", "published_at")
    op.drop_column("projects", "published")
