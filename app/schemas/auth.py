from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    display_name: str
    avatar_url: str | None
    avatar_color: str | None
    avatar_image: str | None
    username: str | None
    username_changed_at: datetime | None
    created_at: datetime


class UsernameAvailabilityResponse(BaseModel):
    available: bool
    reason: str | None = None


class UsernameUpdate(BaseModel):
    username: str = Field(min_length=3, max_length=20)


class AvatarUpdate(BaseModel):
    avatar_color: str | None = None
    avatar_image: str | None = None
