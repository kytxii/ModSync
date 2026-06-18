"""add username and username_changed_at to users

Revision ID: d58675bc1bc3
Revises: b4aa0df0bd10
Create Date: 2026-06-07 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd58675bc1bc3'
down_revision: Union[str, None] = 'b4aa0df0bd10'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('username', sa.String(length=20), nullable=True))
    op.add_column('users', sa.Column('username_changed_at', sa.DateTime(), nullable=True))
    op.create_index('ix_users_username_lower', 'users', [sa.text('lower(username)')], unique=True)


def downgrade() -> None:
    op.drop_index('ix_users_username_lower', table_name='users')
    op.drop_column('users', 'username_changed_at')
    op.drop_column('users', 'username')
