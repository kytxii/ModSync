"""add icon fields to modpacks

Revision ID: e7a3d91f4c82
Revises: c3e8f5a12b44
Create Date: 2026-04-28 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e7a3d91f4c82'
down_revision: Union[str, None] = 'c3e8f5a12b44'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('modpacks', sa.Column('icon_color', sa.String(length=20), nullable=True))
    op.add_column('modpacks', sa.Column('icon_letter', sa.String(length=2), nullable=True))
    op.add_column('modpacks', sa.Column('icon_url', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('modpacks', 'icon_url')
    op.drop_column('modpacks', 'icon_letter')
    op.drop_column('modpacks', 'icon_color')
