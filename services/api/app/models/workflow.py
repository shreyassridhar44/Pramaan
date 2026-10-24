"""Workflow, communication and accountability tables."""

from datetime import date, datetime
from typing import Any

from sqlalchemy import BigInteger, Date, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.core import JsonB


class Event(Base):
    __tablename__ = "events"
    __table_args__ = (Index("ix_events_entity", "entity_type", "entity_id", "occurred_on"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entity_type: Mapped[str] = mapped_column(String(24))
    entity_id: Mapped[int]
    type: Mapped[str] = mapped_column(String(48))
    payload: Mapped[dict[str, Any]] = mapped_column(JsonB, default=dict)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    occurred_on: Mapped[date] = mapped_column(Date)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Reminder(Base):
    __tablename__ = "reminders"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    instrument_id: Mapped[int] = mapped_column(ForeignKey("instruments.id"), index=True)
    rule_code: Mapped[str] = mapped_column(String(48))
    offset_days: Mapped[int]
    channel: Mapped[str] = mapped_column(String(12))
    recipient: Mapped[str] = mapped_column(String(160))
    due_on: Mapped[date] = mapped_column(Date)
    sent_on: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(12), default="sent")


class Escalation(Base):
    __tablename__ = "escalations"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entity_type: Mapped[str] = mapped_column(String(24))
    entity_id: Mapped[int] = mapped_column(Integer, index=True)
    level: Mapped[str] = mapped_column(String(24))
    raised_on: Mapped[date] = mapped_column(Date)
    resolved_on: Mapped[date | None] = mapped_column(Date)


class Complaint(Base):
    __tablename__ = "complaints"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    institution_id: Mapped[int] = mapped_column(ForeignKey("institutions.id"), index=True)
    reference: Mapped[str] = mapped_column(String(40), unique=True)
    cell: Mapped[str] = mapped_column(String(16))
    category: Mapped[str] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(12))  # open | closed
    opened_on: Mapped[date] = mapped_column(Date)
    closed_on: Mapped[date | None] = mapped_column(Date)


class ReleaseCase(Base):
    __tablename__ = "release_cases"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    reference: Mapped[str] = mapped_column(String(40), unique=True)
    institution_id: Mapped[int] = mapped_column(ForeignKey("institutions.id"), index=True)
    kind: Mapped[str] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(
        String(20)
    )  # applied | in_clearance | blocked | cleared | authorised | discharged | closed
    documents: Mapped[list[str]] = mapped_column(JsonB, default=list)
    penalty: Mapped[dict[str, Any]] = mapped_column(JsonB, default=dict)
    applied_on: Mapped[date] = mapped_column(Date)
    authorised_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    authorised_on: Mapped[date | None] = mapped_column(Date)
    closed_on: Mapped[date | None] = mapped_column(Date)


class ReleaseCaseInstrument(Base):
    __tablename__ = "release_case_instruments"
    release_case_id: Mapped[int] = mapped_column(ForeignKey("release_cases.id"), primary_key=True)
    instrument_id: Mapped[int] = mapped_column(ForeignKey("instruments.id"), primary_key=True)


class Clearance(Base):
    __tablename__ = "clearances"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    release_case_id: Mapped[int] = mapped_column(ForeignKey("release_cases.id"), index=True)
    cell: Mapped[str] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(
        String(12), default="pending"
    )  # pending | cleared | blocked
    officer_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    reason: Mapped[str | None] = mapped_column(Text)
    decided_on: Mapped[date | None] = mapped_column(Date)


class Letter(Base):
    __tablename__ = "letters"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    kind: Mapped[str] = mapped_column(String(32))
    reference: Mapped[str] = mapped_column(String(48), unique=True)
    entity_type: Mapped[str] = mapped_column(String(24))
    entity_id: Mapped[int]
    institution_id: Mapped[int | None] = mapped_column(ForeignKey("institutions.id"), index=True)
    recipient: Mapped[str] = mapped_column(String(200))
    fields: Mapped[dict[str, Any]] = mapped_column(JsonB, default=dict)
    storage_key: Mapped[str | None] = mapped_column(String(200))
    token_id: Mapped[str] = mapped_column(String(40), unique=True)
    status: Mapped[str] = mapped_column(
        String(12), default="issued"
    )  # issued | superseded | revoked
    issued_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    issued_on: Mapped[date] = mapped_column(Date)


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text, default="")
    link: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Outbox(Base):
    __tablename__ = "outbox"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    channel: Mapped[str] = mapped_column(String(12))  # email | sms | whatsapp
    recipient: Mapped[str] = mapped_column(String(200))
    subject: Mapped[str] = mapped_column(String(200), default="")
    body: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(12), default="queued")
    simulated: Mapped[bool] = mapped_column(default=False)
    provider_ref: Mapped[str | None] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AuditEntry(Base):
    __tablename__ = "audit_log"
    __table_args__ = (Index("ix_audit_entity", "entity_type", "entity_id"),)
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    actor_label: Mapped[str] = mapped_column(String(160))
    action: Mapped[str] = mapped_column(String(64))
    entity_type: Mapped[str] = mapped_column(String(24))
    entity_id: Mapped[int | None]
    data: Mapped[dict[str, Any]] = mapped_column(JsonB, default=dict)
    prev_hash: Mapped[str] = mapped_column(String(64))
    hash: Mapped[str] = mapped_column(String(64), unique=True)
    note: Mapped[str | None] = mapped_column(Text)
