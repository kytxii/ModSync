"""servers: expand model, add source_server_id to modpacks

Revision ID: a5e2f91b3c74
Revises: b4aa0df0bd10
Create Date: 2026-05-07 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM as PgEnum


revision: str = 'a5e2f91b3c74'
down_revision: Union[str, None] = 'b4aa0df0bd10'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop old tables (no data to preserve)
    op.drop_table('server_mods')
    op.drop_table('server_profiles')

    # Create servers table
    op.create_table(
        'servers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('game_version', sa.String(length=20), nullable=False),
        sa.Column('loader', sa.String(length=50), nullable=False, server_default='fabric'),
        sa.Column('loader_version', sa.String(length=50), nullable=True),
        sa.Column('memory_mb', sa.Integer(), nullable=False, server_default='4096'),
        sa.Column('server_ip', sa.String(length=255), nullable=True),
        sa.Column('description', sa.String(length=1000), nullable=True),
        sa.Column('properties_text', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    # Create server_mods table
    op.create_table(
        'server_mods',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('server_id', sa.Integer(), nullable=False),
        sa.Column('modrinth_project_id', sa.String(length=64), nullable=False),
        sa.Column('version_id', sa.String(length=64), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('side', PgEnum('client', 'server', 'both', name='modside', create_type=False), nullable=False),
        sa.Column('icon_url', sa.String(length=500), nullable=True),
        sa.Column('filename', sa.String(length=255), nullable=True),
        sa.Column('version_number', sa.String(length=100), nullable=True),
        sa.Column('version_type', sa.String(length=20), nullable=True),
        sa.Column('categories', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['server_id'], ['servers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    # Add source_server_id to modpacks (SET NULL on server delete)
    op.add_column('modpacks', sa.Column('source_server_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'modpacks_source_server_id_fkey',
        'modpacks', 'servers',
        ['source_server_id'], ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('modpacks_source_server_id_fkey', 'modpacks', type_='foreignkey')
    op.drop_column('modpacks', 'source_server_id')
    op.drop_table('server_mods')
    op.drop_table('servers')

    # Restore original tables
    op.create_table(
        'server_profiles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('server_ip', sa.String(length=255), nullable=False),
        sa.Column('description', sa.String(length=1000), nullable=True),
        sa.Column('game_version', sa.String(length=20), nullable=False),
        sa.Column('loader', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_table(
        'server_mods',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('server_profile_id', sa.Integer(), nullable=False),
        sa.Column('modrinth_project_id', sa.String(length=64), nullable=False),
        sa.Column('version_id', sa.String(length=64), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('side', PgEnum('client', 'server', 'both', name='modside', create_type=False), nullable=False),
        sa.ForeignKeyConstraint(['server_profile_id'], ['server_profiles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
