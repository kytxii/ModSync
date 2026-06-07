import re
from datetime import datetime, timedelta, timezone

from jose import jwt
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.models import User

_ALGORITHM = "HS256"
_EXPIRE_DAYS = 30

_USERNAME_PATTERN = re.compile(r"^[a-z][a-z0-9_-]{2,19}$")
_USERNAME_COOLDOWN = timedelta(days=7)

_AVATAR_DATA_URI_PATTERN = re.compile(r"^data:(image/[a-zA-Z0-9+.-]+);base64,")
_AVATAR_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
_AVATAR_MAX_LENGTH = 150_000  # base64 data URI length, ~110KB decoded


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


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


def validate_username_format(username: str) -> str | None:
    if not _USERNAME_PATTERN.match(username):
        return (
            "Username must be 3-20 characters, start with a letter, and contain only "
            "lowercase letters, numbers, underscores, and hyphens"
        )
    return None


async def username_taken(db: AsyncSession, username: str, *, exclude_user_id: int | None = None) -> bool:
    stmt = select(User.id).where(func.lower(User.username) == username.lower())
    if exclude_user_id is not None:
        stmt = stmt.where(User.id != exclude_user_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none() is not None


def username_cooldown_remaining(user: User) -> timedelta | None:
    if user.username_changed_at is None:
        return None
    elapsed = _utcnow() - user.username_changed_at
    if elapsed >= _USERNAME_COOLDOWN:
        return None
    return _USERNAME_COOLDOWN - elapsed


async def set_username(db: AsyncSession, user: User, username: str) -> User:
    user.username = username
    user.username_changed_at = _utcnow()
    await db.commit()
    await db.refresh(user)
    return user


def validate_avatar_image(data_uri: str) -> str | None:
    match = _AVATAR_DATA_URI_PATTERN.match(data_uri)
    if not match:
        return "Avatar image must be a base64 data URI"
    if match.group(1) not in _AVATAR_MIME_TYPES:
        return "Avatar image must be JPEG, PNG, or WebP"
    if len(data_uri) > _AVATAR_MAX_LENGTH:
        return "Avatar image is too large"
    return None


async def set_avatar(db: AsyncSession, user: User, *, color: str | None, image: str | None) -> User:
    user.avatar_color = color
    user.avatar_image = image
    await db.commit()
    await db.refresh(user)
    return user
