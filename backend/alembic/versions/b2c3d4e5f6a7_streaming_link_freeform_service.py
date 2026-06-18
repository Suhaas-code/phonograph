"""streaming link free-form service (drop enum, use varchar)

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-06-18 09:40:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_ENUM = sa.Enum(
    "spotify", "tidal", "qobuz", "deezer", "amazon_music", "youtube_music",
    name="streaming_service",
)


def upgrade() -> None:
    # Convert the enum column to plain text so any provider key can be stored.
    # Existing values (e.g. 'spotify') cast straight through — no data loss.
    op.alter_column(
        "streaming_links",
        "service",
        existing_type=_ENUM,
        type_=sa.String(length=60),
        existing_nullable=False,
        postgresql_using="service::text",
    )
    op.execute("DROP TYPE IF EXISTS streaming_service")


def downgrade() -> None:
    # Recreate the enum and cast back (fails if custom values exist — expected).
    _ENUM.create(op.get_bind(), checkfirst=True)
    op.alter_column(
        "streaming_links",
        "service",
        existing_type=sa.String(length=60),
        type_=_ENUM,
        existing_nullable=False,
        postgresql_using="service::streaming_service",
    )
