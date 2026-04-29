"""add enriched fields to modpack_mods

Revision ID: c3e8f5a12b44
Revises: 7f317934956d
Create Date: 2026-04-27 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'c3e8f5a12b44'
down_revision: Union[str, None] = '7f317934956d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('modpack_mods', sa.Column('icon_url', sa.String(length=500), nullable=True))
    op.add_column('modpack_mods', sa.Column('version_number', sa.String(length=100), nullable=True))
    op.add_column('modpack_mods', sa.Column('version_type', sa.String(length=20), nullable=True))
    op.add_column('modpack_mods', sa.Column('filename', sa.String(length=255), nullable=True))
    op.add_column('modpack_mods', sa.Column('categories', postgresql.JSON(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    op.drop_column('modpack_mods', 'categories')
    op.drop_column('modpack_mods', 'filename')
    op.drop_column('modpack_mods', 'version_type')
    op.drop_column('modpack_mods', 'version_number')
    op.drop_column('modpack_mods', 'icon_url')