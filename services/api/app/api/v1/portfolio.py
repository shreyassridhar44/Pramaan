from collections import Counter
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import DbSession, OfficerReader
from app.schemas.portfolio import (
    ActionItem,
    AssuranceSplit,
    Impact,
    RegionRow,
    RiverWeek,
    Summary,
    TimelineEventOut,
    TimelineStepOut,
)
from app.services import portfolio as svc

router = APIRouter(prefix="/portfolio", tags=["portfolio"])

AsOf = Annotated[date | None, Query(description="Compute figures as of this date (default today)")]


def _as_of(value: date | None) -> date:
    return value or date.today()


@router.get("/summary", response_model=Summary)
async def summary(principal: OfficerReader, db: DbSession, as_of: AsOf = None) -> Summary:
    d = _as_of(as_of)
    scope = await svc.scope_for(db, principal.user)
    s = await svc.summary(db, scope, d)
    a = s.by_assurance_paise
    return Summary(
        as_of=d.isoformat(),
        data_source="synthetic",
        held_count=s.held_count,
        held_paise=str(s.held_paise),
        by_assurance_paise=AssuranceSplit(a0=str(a[0]), a1=str(a[1]), a2=str(a[2]), a3=str(a[3])),
        by_assurance_count={str(k): v for k, v in s.by_assurance_count.items()},
        by_status_count=s.by_status_count,
        maturing_90_count=s.maturing_90_count,
        maturing_90_paise=str(s.maturing_90_paise),
        overdue_count=s.overdue_count,
        discrepancy_count=s.discrepancy_count,
        pending_verification_count=s.pending_verification_count,
        escalations=s.escalations,
        needs_action_count=s.overdue_count + s.discrepancy_count + s.pending_verification_count,
        by_bank_paise={
            k: str(v) for k, v in sorted(s.by_bank_paise.items(), key=lambda kv: -kv[1])
        },
    )


@router.get("/river", response_model=list[RiverWeek])
async def river(
    principal: OfficerReader,
    db: DbSession,
    as_of: AsOf = None,
    months: Annotated[int, Query(ge=1, le=36)] = 24,
) -> list[RiverWeek]:
    scope = await svc.scope_for(db, principal.user)
    return [RiverWeek(**w) for w in await svc.river(db, scope, _as_of(as_of), months)]


@router.get("/regions", response_model=list[RegionRow])
async def regions(principal: OfficerReader, db: DbSession, as_of: AsOf = None) -> list[RegionRow]:
    scope = await svc.scope_for(db, principal.user)
    return [RegionRow(**r) for r in await svc.region_rows(db, scope, _as_of(as_of))]


@router.get("/action-queue", response_model=list[ActionItem])
async def action_queue(
    principal: OfficerReader,
    db: DbSession,
    as_of: AsOf = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 10,
) -> list[ActionItem]:
    scope = await svc.scope_for(db, principal.user)
    return [ActionItem(**i) for i in await svc.action_queue(db, scope, _as_of(as_of), limit)]


@router.get("/timeline", response_model=list[TimelineStepOut])
async def portfolio_timeline(
    principal: OfficerReader,
    db: DbSession,
    start: date | None = None,
    weeks: Annotated[int, Query(ge=1, le=104)] = 52,
    events_per_step: Annotated[int, Query(ge=0, le=500)] = 40,
) -> list[TimelineStepOut]:
    """Weekly forecast from current rules and data. Read-only."""
    scope = await svc.scope_for(db, principal.user)
    steps = await svc.timeline_steps(db, scope, start or date.today(), weeks)
    out = []
    for step in steps:
        s = step.summary
        out.append(
            TimelineStepOut(
                start=step.start.isoformat(),
                end=step.end.isoformat(),
                held_paise=str(s.held_paise),
                held_count=s.held_count,
                confirmed_paise=str(s.by_assurance_paise[2] + s.by_assurance_paise[3]),
                maturing_90_count=s.maturing_90_count,
                overdue_count=s.overdue_count,
                escalations=s.escalations,
                by_region=s.by_region,
                events=[
                    TimelineEventOut(
                        on=e.on.isoformat(),
                        kind=e.kind,
                        instrument_id=e.instrument_id,
                        region=e.region,
                        detail=e.detail,
                    )
                    for e in step.events[:events_per_step]
                ],
                event_counts=dict(Counter(e.kind for e in step.events)),
            )
        )
    return out


@router.get("/impact", response_model=Impact)
async def impact(principal: OfficerReader, db: DbSession, as_of: AsOf = None) -> Impact:
    scope = await svc.scope_for(db, principal.user)
    return Impact(**await svc.impact(db, scope, _as_of(as_of)))
