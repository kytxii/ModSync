"""add avatar fields to users

Revision ID: 232d4662bf91
Revises: d58675bc1bc3
Create Date: 2026-06-07 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '232d4662bf91'
down_revision: Union[str, None] = 'd58675bc1bc3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('avatar_color', sa.String(length=20), nullable=True))
    op.add_column('users', sa.Column('avatar_image', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'avatar_image')
    op.drop_column('users', 'avatar_color')
