"""bugs table (M4: Bug -> Fix -> Regression)

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-07
"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "bugs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "project_id",
            sa.Integer(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("gate", sa.String(length=60), nullable=False),
        sa.Column("summary", sa.Text(), server_default=""),
        sa.Column("evidence", sa.Text(), server_default=""),
        sa.Column("status", sa.String(length=40), server_default="open"),
        sa.Column("broken_bible", sa.JSON(), server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("fixed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("bugs")
