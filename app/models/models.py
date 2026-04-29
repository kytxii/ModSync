import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, String, Text, ForeignKey, func, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ModSide(str, enum.Enum):
    client = "client"
    server = "server"
    both = "both"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    google_id: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    display_name: Mapped[str] = mapped_column(String(255))
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    modpacks: Mapped[list["Modpack"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    server_profiles: Mapped[list["ServerProfile"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Modpack(Base):
    __tablename__ = "modpacks"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255))
    game_version: Mapped[str] = mapped_column(String(20))
    loader: Mapped[str] = mapped_column(String(50))
    share_code: Mapped[str] = mapped_column(String(12), unique=True, index=True)
    source_share_code: Mapped[str | None] = mapped_column(String(12), nullable=True, default=None)
    icon_color: Mapped[str | None] = mapped_column(String(20), nullable=True, default=None)
    icon_letter: Mapped[str | None] = mapped_column(String(2), nullable=True, default=None)
    icon_url: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    user: Mapped["User"] = relationship(back_populates="modpacks")
    mods: Mapped[list["ModpackMod"]] = relationship(back_populates="modpack", cascade="all, delete-orphan")

    @property
    def mod_count(self) -> int:
        return len(self.mods)


class ModpackMod(Base):
    __tablename__ = "modpack_mods"

    id: Mapped[int] = mapped_column(primary_key=True)
    modpack_id: Mapped[int] = mapped_column(ForeignKey("modpacks.id", ondelete="CASCADE"))
    modrinth_project_id: Mapped[str] = mapped_column(String(64))
    version_id: Mapped[str] = mapped_column(String(64))
    name: Mapped[str] = mapped_column(String(255))
    side: Mapped[ModSide] = mapped_column(Enum(ModSide))
    icon_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    version_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    version_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    categories: Mapped[list | None] = mapped_column(JSON, nullable=True)

    modpack: Mapped["Modpack"] = relationship(back_populates="mods")


class ServerProfile(Base):
    __tablename__ = "server_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255))
    server_ip: Mapped[str] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    game_version: Mapped[str] = mapped_column(String(20))
    loader: Mapped[str] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="server_profiles")
    mods: Mapped[list["ServerMod"]] = relationship(back_populates="server_profile", cascade="all, delete-orphan")


class ServerMod(Base):
    __tablename__ = "server_mods"

    id: Mapped[int] = mapped_column(primary_key=True)
    server_profile_id: Mapped[int] = mapped_column(ForeignKey("server_profiles.id", ondelete="CASCADE"))
    modrinth_project_id: Mapped[str] = mapped_column(String(64))
    version_id: Mapped[str] = mapped_column(String(64))
    name: Mapped[str] = mapped_column(String(255))
    side: Mapped[ModSide] = mapped_column(Enum(ModSide))

    server_profile: Mapped["ServerProfile"] = relationship(back_populates="mods")
