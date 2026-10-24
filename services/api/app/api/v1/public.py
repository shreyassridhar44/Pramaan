from datetime import date

from fastapi import APIRouter
from pydantic import BaseModel

from app.api.deps import DbSession
from app.config import get_settings
from app.services import portfolio as svc

router = APIRouter(prefix="/public", tags=["public"])


class PublicSummary(BaseModel):
    as_of: str
    held_paise: str
    held_count: int
    bank_confirmed_share: float
    data_source: str
    demo_mode: bool


@router.get("/summary", response_model=PublicSummary)
async def public_summary(db: DbSession) -> PublicSummary:
    """Aggregate figures for the sign-in page. No institution-level data."""
    s = await svc.summary(db, svc.Scope("all"), date.today())
    confirmed = s.by_assurance_paise[2] + s.by_assurance_paise[3]
    return PublicSummary(
        as_of=s.as_of.isoformat(),
        held_paise=str(s.held_paise),
        held_count=s.held_count,
        bank_confirmed_share=confirmed / s.held_paise if s.held_paise else 0.0,
        data_source="synthetic",
        demo_mode=get_settings().demo_mode,
    )
