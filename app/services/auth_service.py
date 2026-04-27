from datetime import datetime, timedelta, timezone

from jose import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.models import User

_ALGORITHM = "HS256"
_EXPIRE_DAYS = 30


def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=_EXPIRE_DAYS)
    return jwt.encode({"sub": str(user_id), "exp": expire}, settings.secret_key, algorithm=_ALGORITHM)


def decode_access_token(token: str) -> int:
    payload = jwt.decode(token, settings.secret_key, algorithms=[_ALGORITHM])
    return int(payload["sub"])


async def get_or_create_user(
    db: AsyncSession,
    google_id: str,
    email: str,
    display_name: str,
    avatar_url: str | None,
) -> User:
    result = await db.execute(select(User).where(User.google_id == google_id))
    user = result.scalar_one_or_none()

    if user:
        user.email = email
        user.display_name = display_name
        user.avatar_url = avatar_url
    else:
        user = User(google_id=google_id, email=email, display_name=display_name, avatar_url=avatar_url)
        db.add(user)

    await db.commit()
    await db.refresh(user)
    return user
