"""add share_code to servers

Revision ID: d1f3a7b2c5e8
Revises: a5e2f91b3c74
Create Date: 2026-05-07 00:01:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd1f3a7b2c5e8'
down_revision: Union[str, None] = 'a5e2f91b3c74'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('servers', sa.Column('share_code', sa.String(length=12), nullable=True))
    op.create_index(op.f('ix_servers_share_code'), 'servers', ['share_code'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_servers_share_code'), table_name='servers')
    op.drop_column('servers', 'share_code')
