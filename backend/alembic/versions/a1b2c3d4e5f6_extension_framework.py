"""extension framework

Revision ID: a1b2c3d4e5f6
Revises: 7dc770016edf
Create Date: 2026-06-16 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '7dc770016edf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'extensions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('owner_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=160), nullable=False),
        sa.Column('version', sa.String(length=40), nullable=False),
        sa.Column('author', sa.String(length=160), nullable=False),
        sa.Column('api_version', sa.String(length=20), nullable=False),
        sa.Column('manifest_url', sa.Text(), nullable=False),
        sa.Column('endpoint_url', sa.Text(), nullable=False),
        sa.Column('capabilities', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('requested_permissions', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('granted_permissions', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            'status',
            sa.Enum('enabled', 'disabled', 'error', name='extension_status'),
            nullable=False,
        ),
        sa.Column('needs_reapproval', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('last_error', sa.Text(), nullable=True),
        sa.Column('last_refresh_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('manifest_snapshot', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('shared_secret', sa.String(length=128), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('owner_id', 'manifest_url', name='uq_extension_owner_manifest'),
    )
    op.create_index(op.f('ix_extensions_owner_id'), 'extensions', ['owner_id'], unique=False)

    op.create_table(
        'extension_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('extension_id', sa.Integer(), nullable=False),
        sa.Column('kind', sa.String(length=40), nullable=False),
        sa.Column('detail', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['extension_id'], ['extensions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_extension_events_extension_id'), 'extension_events', ['extension_id'], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_extension_events_extension_id'), table_name='extension_events')
    op.drop_table('extension_events')
    op.drop_index(op.f('ix_extensions_owner_id'), table_name='extensions')
    op.drop_table('extensions')
    sa.Enum(name='extension_status').drop(op.get_bind(), checkfirst=True)
