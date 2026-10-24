"""Records held by the simulated banks. Only the bank simulator reads these tables; the rest of
Pramaan learns about them solely through signed bank messages, as it would with a real bank."""

from datetime import date

from sqlalchemy import BigInteger, Boolean, Date, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class SimBankDeposit(Base):
    __tablename__ = "sim_bank_deposits"
    __table_args__ = (
        UniqueConstraint("bank_id", "number", name="uq_sim_bank_deposits_bank_number"),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    bank_id: Mapped[int] = mapped_column(ForeignKey("banks.id"), index=True)
    number: Mapped[str] = mapped_column(String(40))
    branch: Mapped[str] = mapped_column(String(120))
    ifsc: Mapped[str] = mapped_column(String(16))
    holders: Mapped[str] = mapped_column(String(400))
    amount_paise: Mapped[int] = mapped_column(BigInteger)
    issue_date: Mapped[date] = mapped_column(Date)
    maturity_date: Mapped[date] = mapped_column(Date)
    lien_aicte: Mapped[bool] = mapped_column(Boolean, default=True)
    encumbrance: Mapped[str | None] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(
        String(16), default="live"
    )  # live | matured | encashed | closed


class SimBankKey(Base):
    """Private signing keys of simulated banks, kept apart from the public key registry."""

    __tablename__ = "sim_bank_keys"
    bank_id: Mapped[int] = mapped_column(ForeignKey("banks.id"), primary_key=True)
    key_id: Mapped[str] = mapped_column(String(40))
    private_key_b64: Mapped[str] = mapped_column(String(120))
