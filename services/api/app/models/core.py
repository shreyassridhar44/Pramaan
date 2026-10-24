"""Reference and identity tables: regions, institutions, programmes, banks, users, rules."""

from datetime import date, datetime
from typing import Any

from sqlalchemy import JSON, BigInteger, Boolean, Date, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

JsonB = JSON().with_variant(JSONB(), "postgresql")


class Region(Base):
    __tablename__ = "regions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(32), unique=True)
    name: Mapped[str] = mapped_column(String(80))
    office_city: Mapped[str] = mapped_column(String(80))
    is_camp_office: Mapped[bool] = mapped_column(Boolean, default=False)
    lat: Mapped[float]
    lng: Mapped[float]


class Institution(Base):
    __tablename__ = "institutions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    aicte_id: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    trust_name: Mapped[str] = mapped_column(String(200))
    region_id: Mapped[int] = mapped_column(ForeignKey("regions.id"), index=True)
    state: Mapped[str] = mapped_column(String(60))
    district: Mapped[str] = mapped_column(String(80))
    city: Mapped[str] = mapped_column(String(80))
    premises: Mapped[str] = mapped_column(String(16))
    ownership: Mapped[str] = mapped_column(String(16))
    established_year: Mapped[int]
    status: Mapped[str] = mapped_column(String(24), default="operating")
    flags: Mapped[dict[str, Any]] = mapped_column(JsonB, default=dict)

    region: Mapped[Region] = relationship(lazy="joined")
    programmes: Mapped[list["Programme"]] = relationship(back_populates="institution")


class Programme(Base):
    __tablename__ = "programmes"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    institution_id: Mapped[int] = mapped_column(ForeignKey("institutions.id"), index=True)
    discipline: Mapped[str] = mapped_column(String(40))
    level: Mapped[str] = mapped_column(String(12))
    intake: Mapped[int]
    approved_from: Mapped[date] = mapped_column(Date)

    institution: Mapped[Institution] = relationship(back_populates="programmes")


class Bank(Base):
    __tablename__ = "banks"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(8), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    hq_city: Mapped[str] = mapped_column(String(80))
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=True)
    key_id: Mapped[str] = mapped_column(String(40))
    public_key_b64: Mapped[str] = mapped_column(String(80))
    integration: Mapped[str] = mapped_column(String(16), default="network")  # network | desk


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(160), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    designation: Mapped[str] = mapped_column(String(120), default="")
    password_hash: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(32), index=True)
    region_id: Mapped[int | None] = mapped_column(ForeignKey("regions.id"))
    institution_id: Mapped[int | None] = mapped_column(ForeignKey("institutions.id"))
    bank_id: Mapped[int | None] = mapped_column(ForeignKey("banks.id"))
    cell: Mapped[str | None] = mapped_column(String(16))
    persona_key: Mapped[str | None] = mapped_column(String(32), unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    failed_logins: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RuleVersion(Base):
    __tablename__ = "rules"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(48), index=True)
    version: Mapped[int]
    params: Mapped[dict[str, Any]] = mapped_column(JsonB)
    aph_ref: Mapped[str] = mapped_column(String(160))
    is_assumption: Mapped[bool] = mapped_column(Boolean, default=False)
    effective_from: Mapped[date] = mapped_column(Date)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DataVersion(Base):
    """A single-row counter bumped on every write that affects portfolio computations, used as a
    cache key so forecasts are recomputed only when the data changes."""

    __tablename__ = "data_version"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    version: Mapped[int] = mapped_column(BigInteger, default=1)
    seed_label: Mapped[str] = mapped_column(String(80), default="")
    anchor_date: Mapped[date | None] = mapped_column(Date)
