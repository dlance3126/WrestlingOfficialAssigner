from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


EventOfficial = Table(
    "event_official",
    Base.metadata,
    Column("event_id", ForeignKey("events.id"), primary_key=True),
    Column("official_id", ForeignKey("officials.id"), primary_key=True),
)

EventTeam = Table(
    "event_team",
    Base.metadata,
    Column("event_id", ForeignKey("events.id"), primary_key=True),
    Column("team_id", ForeignKey("teams.id"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    is_admin: Mapped[bool] = mapped_column(Boolean, default=True)
    area: Mapped[str] = mapped_column(String(20))


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    tier: Mapped[int] = mapped_column(Integer)
    area: Mapped[str] = mapped_column(String(20))

    events = relationship(
        "Event",
        secondary=EventTeam,
        back_populates="teams",
    )


class Official(Base):
    __tablename__ = "officials"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    tier: Mapped[int] = mapped_column(Integer)
    unavailable_dates: Mapped[str] = mapped_column(String(2048), default="")
    area: Mapped[str] = mapped_column(String(20))

    events = relationship(
        "Event",
        secondary=EventOfficial,
        back_populates="officials",
    )


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    event_type: Mapped[str] = mapped_column(String(16))
    tier_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    starts_at: Mapped[datetime] = mapped_column(DateTime)
    ends_at: Mapped[datetime] = mapped_column(DateTime)
    officials_needed: Mapped[int] = mapped_column(Integer, default=1)
    area: Mapped[str] = mapped_column(String(20))

    officials = relationship(
        "Official",
        secondary=EventOfficial,
        back_populates="events",
    )
    teams = relationship(
        "Team",
        secondary=EventTeam,
        back_populates="events",
    )
