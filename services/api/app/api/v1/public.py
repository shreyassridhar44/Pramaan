from datetime import date, timedelta

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import func, select

from app.api.deps import DbSession
from app.config import get_settings
from app.models import Bank, Institution, Letter, Region, Reminder, Signal
from app.services import portfolio as svc

router = APIRouter(prefix="/public", tags=["public"])


class PublicRegion(BaseModel):
    code: str
    name: str
    held_paise: str
    held_count: int
    confirmed_share: float


class PublicSummary(BaseModel):
    as_of: str
    held_paise: str
    held_count: int
    bank_confirmed_share: float
    institutions: int
    banks: int
    maturing_90_paise: str
    maturing_90_count: int
    pending_verification_count: int
    reminders_7d: int
    open_signals: int
    letters_issued: int
    regions: list[PublicRegion]
    data_source: str
    demo_mode: bool


@router.get("/summary", response_model=PublicSummary)
async def public_summary(db: DbSession) -> PublicSummary:
    """Aggregate figures for the public home and sign-in pages. No institution-level data."""
    today = date.today()
    s = await svc.summary(db, svc.Scope("all"), today)
    confirmed = s.by_assurance_paise[2] + s.by_assurance_paise[3]
    institutions = await db.scalar(select(func.count()).select_from(Institution))
    banks = await db.scalar(select(func.count()).select_from(Bank))
    reminders = await db.scalar(
        select(func.count())
        .select_from(Reminder)
        .where(Reminder.sent_on.is_not(None), Reminder.sent_on >= today - timedelta(days=7))
    )
    signals = await db.scalar(
        select(func.count()).select_from(Signal).where(Signal.status == "open")
    )
    letters = await db.scalar(
        select(func.count()).select_from(Letter).where(Letter.status == "issued")
    )
    names = dict((await db.execute(select(Region.code, Region.name))).tuples().all())
    regions = [
        PublicRegion(
            code=code,
            name=names.get(code, code),
            held_paise=str(r["held_paise"]),
            held_count=r["held_count"],
            confirmed_share=r["confirmed_paise"] / r["held_paise"] if r["held_paise"] else 0.0,
        )
        for code, r in sorted(s.by_region.items())
    ]
    return PublicSummary(
        as_of=s.as_of.isoformat(),
        held_paise=str(s.held_paise),
        held_count=s.held_count,
        bank_confirmed_share=confirmed / s.held_paise if s.held_paise else 0.0,
        institutions=institutions or 0,
        banks=banks or 0,
        maturing_90_paise=str(s.maturing_90_paise),
        maturing_90_count=s.maturing_90_count,
        pending_verification_count=s.pending_verification_count,
        reminders_7d=reminders or 0,
        open_signals=signals or 0,
        letters_issued=letters or 0,
        regions=regions,
        data_source="synthetic",
        demo_mode=get_settings().demo_mode,
    )
