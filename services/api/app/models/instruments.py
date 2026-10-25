"""Deposits and their evidence: demands, instruments, observations, documents, signals, bank."""

from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.core import Bank, Institution, JsonB


class Demand(Base):
    __tablename__ = "demands"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    institution_id: Mapped[int] = mapped_column(ForeignKey("institutions.id"), index=True)
    reason: Mapped[str] = mapped_column(String(40))  # new_institution | new_programme | top_up
    lines: Mapped[list[dict[str, Any]]] = mapped_column(JsonB)
    amount_paise: Mapped[int] = mapped_column(BigInteger)
    leased_multiplier: Mapped[int] = mapped_column(Integer, default=1)
    rule_code: Mapped[str] = mapped_column(String(48))
    rule_version: Mapped[int]
    intimated_on: Mapped[date] = mapped_column(Date)
    due_on: Mapped[date] = mapped_column(Date)
    furnished_on: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(16), default="open")  # open | furnished | cancelled


class Instrument(Base):
    __tablename__ = "instruments"
    __table_args__ = (
        UniqueConstraint("bank_id", "number", name="uq_instruments_bank_number"),
        Index("ix_instruments_maturity", "maturity_date"),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    number: Mapped[str] = mapped_column(String(40))
    kind: Mapped[str] = mapped_column(String(16))
    institution_id: Mapped[int] = mapped_column(ForeignKey("institutions.id"), index=True)
    demand_id: Mapped[int | None] = mapped_column(ForeignKey("demands.id"))
    bank_id: Mapped[int] = mapped_column(ForeignKey("banks.id"), index=True)
    branch: Mapped[str] = mapped_column(String(120))
    ifsc: Mapped[str] = mapped_column(String(16))
    amount_paise: Mapped[int] = mapped_column(BigInteger)
    interest_rate: Mapped[float | None] = mapped_column(Float)
    issue_date: Mapped[date] = mapped_column(Date)
    maturity_date: Mapped[date] = mapped_column(Date)
    tenure_months: Mapped[int]
    auto_renew: Mapped[bool] = mapped_column(Boolean, default=False)
    predecessor_id: Mapped[int | None] = mapped_column(ForeignKey("instruments.id"))
    status: Mapped[str] = mapped_column(String(24), index=True)
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    next_action: Mapped[str | None] = mapped_column(String(160))
    next_action_due: Mapped[date | None] = mapped_column(Date)

    # Dated lifecycle facts used by the as-of engine.
    submitted_on: Mapped[date] = mapped_column(Date)
    verified_on: Mapped[date | None] = mapped_column(Date)
    returned_on: Mapped[date | None] = mapped_column(Date)
    resubmitted_on: Mapped[date | None] = mapped_column(Date)
    release_requested_on: Mapped[date | None] = mapped_column(Date)
    release_cleared_on: Mapped[date | None] = mapped_column(Date)
    released_on: Mapped[date | None] = mapped_column(Date)
    renewed_on: Mapped[date | None] = mapped_column(Date)
    encashed_on: Mapped[date | None] = mapped_column(Date)
    forfeited_on: Mapped[date | None] = mapped_column(Date)
    lien_hold_since: Mapped[date | None] = mapped_column(Date)
    lien_lifted_on: Mapped[date | None] = mapped_column(Date)

    # Evidence dates maintained by services (see app.domain.assurance.EvidenceDates).
    document_checked_on: Mapped[date | None] = mapped_column(Date)
    bank_confirmed_on: Mapped[date | None] = mapped_column(Date)
    last_confirmed_on: Mapped[date | None] = mapped_column(Date)
    conflict_since: Mapped[date | None] = mapped_column(Date)
    conflict_resolved_on: Mapped[date | None] = mapped_column(Date)
    high_signal_since: Mapped[date | None] = mapped_column(Date)
    high_signal_resolved_on: Mapped[date | None] = mapped_column(Date)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    institution: Mapped[Institution] = relationship(lazy="joined")
    bank: Mapped[Bank] = relationship(lazy="joined")


class FieldObservation(Base):
    __tablename__ = "field_observations"
    __table_args__ = (Index("ix_obs_instrument_field", "instrument_id", "field"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    instrument_id: Mapped[int] = mapped_column(ForeignKey("instruments.id", ondelete="CASCADE"))
    field: Mapped[str] = mapped_column(String(24))
    source: Mapped[str] = mapped_column(String(12))
    value_raw: Mapped[str] = mapped_column(String(400))
    value_norm: Mapped[str] = mapped_column(String(400))
    confidence: Mapped[float | None] = mapped_column(Float)
    evidence_type: Mapped[str | None] = mapped_column(String(24))  # document | bank_message | user
    evidence_id: Mapped[int | None] = mapped_column(Integer)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    observed_on: Mapped[date] = mapped_column(Date)
    observed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    note: Mapped[str | None] = mapped_column(Text)


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (Index("ix_documents_entity", "entity_type", "entity_id"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entity_type: Mapped[str] = mapped_column(String(24))
    entity_id: Mapped[int]
    kind: Mapped[str] = mapped_column(String(32))
    filename: Mapped[str] = mapped_column(String(200))
    storage_key: Mapped[str] = mapped_column(String(200))
    sha256: Mapped[str] = mapped_column(String(64), index=True)
    phash: Mapped[str | None] = mapped_column(String(32), index=True)
    mime: Mapped[str] = mapped_column(String(64))
    size_bytes: Mapped[int]
    pages: Mapped[int] = mapped_column(Integer, default=1)
    uploaded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Analysis(Base):
    __tablename__ = "analyses"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    document_id: Mapped[int] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[str] = mapped_column(String(16), default="queued")
    ocr: Mapped[dict[str, Any] | None] = mapped_column(JsonB)
    extraction: Mapped[dict[str, Any] | None] = mapped_column(JsonB)
    forensics: Mapped[dict[str, Any] | None] = mapped_column(JsonB)
    model_versions: Mapped[dict[str, Any] | None] = mapped_column(JsonB)
    duration_ms: Mapped[int | None]
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Signal(Base):
    __tablename__ = "signals"
    __table_args__ = (
        Index("ix_signals_entity", "entity_type", "entity_id"),
        Index("ix_signals_status_severity", "status", "severity"),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entity_type: Mapped[str] = mapped_column(String(24))
    entity_id: Mapped[int]
    code: Mapped[str] = mapped_column(String(48))
    severity: Mapped[str] = mapped_column(String(8))
    title: Mapped[str] = mapped_column(String(200))
    evidence: Mapped[dict[str, Any]] = mapped_column(JsonB, default=dict)
    source: Mapped[str] = mapped_column(String(48))
    source_version: Mapped[str] = mapped_column(String(48))
    status: Mapped[str] = mapped_column(String(12), default="open")
    raised_on: Mapped[date] = mapped_column(Date)
    resolution_note: Mapped[str | None] = mapped_column(Text)
    resolved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    resolved_on: Mapped[date | None] = mapped_column(Date)


class BankRequest(Base):
    __tablename__ = "bank_requests"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    instrument_id: Mapped[int] = mapped_column(ForeignKey("instruments.id"), index=True)
    bank_id: Mapped[int] = mapped_column(ForeignKey("banks.id"), index=True)
    kind: Mapped[str] = mapped_column(String(12))  # confirm | reconfirm | discharge
    adapter: Mapped[str] = mapped_column(String(24))
    status: Mapped[str] = mapped_column(String(16), default="sent")  # sent | answered | failed
    payload: Mapped[dict[str, Any]] = mapped_column(JsonB)
    requested_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    requested_on: Mapped[date] = mapped_column(Date)
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class BankMessage(Base):
    __tablename__ = "bank_messages"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("bank_requests.id"), index=True)
    bank_id: Mapped[int] = mapped_column(ForeignKey("banks.id"))
    payload: Mapped[dict[str, Any]] = mapped_column(JsonB)
    canonical: Mapped[str] = mapped_column(Text)
    signature_b64: Mapped[str] = mapped_column(String(120))
    key_id: Mapped[str] = mapped_column(String(40))
    signature_valid: Mapped[bool]
    received_on: Mapped[date] = mapped_column(Date)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
