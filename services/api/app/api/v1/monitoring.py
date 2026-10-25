from datetime import UTC, date, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select

from app.api.deps import (
    CurrentPrincipal,
    DbSession,
    OfficerReader,
    Principal,
    instrument_scope,
    require_roles,
)
from app.domain.types import Role
from app.models import Institution, Instrument, Notification, Region, Reminder
from app.services import portfolio as psvc
from app.services.monitoring import run_monitoring

router = APIRouter(tags=["monitoring"])
Runner = Annotated[Principal, Depends(require_roles(Role.SECTION_HEAD, Role.ADMIN))]
AlertReader = OfficerReader


class RunOut(BaseModel):
    run_on: str
    reminders: int
    escalations: int
    notifications: int
    emails_sent: int
    simulated_messages: int
    reconfirmations: int
    auto_renewals: int
    penalty_notices: int


@router.post("/monitoring/run", response_model=RunOut)
async def run(principal: Runner, db: DbSession) -> RunOut:
    """Runs today's monitoring now. The scheduler also runs it every morning at 06:00 IST."""
    s = await run_monitoring(db, actor_label=principal.label)
    return RunOut(
        run_on=s.run_on,
        reminders=s.reminders,
        escalations=s.escalations,
        notifications=s.notifications,
        emails_sent=s.emails_sent,
        simulated_messages=s.simulated_messages,
        reconfirmations=s.reconfirmations,
        auto_renewals=s.auto_renewals,
        penalty_notices=s.penalty_notices,
    )


class NotificationOut(BaseModel):
    id: int
    title: str
    body: str
    link: str | None
    created_at: str
    read: bool


class Inbox(BaseModel):
    unread: int
    items: list[NotificationOut]


@router.get("/notifications", response_model=Inbox)
async def notifications(principal: CurrentPrincipal, db: DbSession) -> Inbox:
    uid = principal.user.id
    rows = (
        await db.scalars(
            select(Notification)
            .where(Notification.user_id == uid)
            .order_by(Notification.id.desc())
            .limit(50)
        )
    ).all()
    unread = (
        await db.scalar(
            select(func.count())
            .select_from(Notification)
            .where(Notification.user_id == uid, Notification.read_at.is_(None))
        )
        or 0
    )
    return Inbox(
        unread=unread,
        items=[
            NotificationOut(
                id=n.id,
                title=n.title,
                body=n.body,
                link=n.link,
                created_at=n.created_at.isoformat(),
                read=n.read_at is not None,
            )
            for n in rows
        ],
    )


@router.post("/notifications/read-all", status_code=204)
async def read_all(principal: CurrentPrincipal, db: DbSession) -> None:
    rows = (
        await db.scalars(
            select(Notification).where(
                Notification.user_id == principal.user.id, Notification.read_at.is_(None)
            )
        )
    ).all()
    for n in rows:
        n.read_at = datetime.now(UTC)
    await db.commit()


# Alerts (PROTOTYPE.md 5.8): reminders sent and escalations open.


class AlertReminderOut(BaseModel):
    id: int
    instrument_id: int
    number: str
    institution: str
    region: str
    rule: str
    offset_days: int
    channel: str
    due_on: str
    sent_on: str | None


class EscalationOut(BaseModel):
    instrument_id: int
    number: str
    institution: str
    region: str
    amount_paise: str
    level: str
    raised_on: str
    days_overdue: int
    next_level: str | None
    next_level_on: str | None


RULE_LABEL = {
    "monitoring.reminders": "Maturity reminder",
    "monitoring.reconfirm": "Re-confirmation due",
    "monitoring.auto_renew": "Automatic renewal notice",
}


@router.get("/alerts/reminders", response_model=list[AlertReminderOut])
async def alert_reminders(
    principal: AlertReader,
    db: DbSession,
    rule: str | None = None,
    channel: str | None = None,
    region: str | None = None,
    limit: Annotated[int, Query(ge=1, le=1000)] = 300,
) -> list[AlertReminderOut]:
    q = (
        select(Reminder, Instrument.number, Institution.name, Region.name)
        .join(Instrument, Instrument.id == Reminder.instrument_id)
        .join(Institution, Institution.id == Instrument.institution_id)
        .join(Region, Region.id == Institution.region_id)
        .where(instrument_scope(principal))
        .order_by(Reminder.due_on.desc(), Reminder.id.desc())
        .limit(limit)
    )
    if rule:
        q = q.where(Reminder.rule_code == rule)
    if channel:
        q = q.where(Reminder.channel == channel)
    if region:
        q = q.where(Region.code == region)
    return [
        AlertReminderOut(
            id=r.id,
            instrument_id=r.instrument_id,
            number=number,
            institution=inst,
            region=reg,
            rule=RULE_LABEL.get(r.rule_code, r.rule_code),
            offset_days=r.offset_days,
            channel=r.channel,
            due_on=r.due_on.isoformat(),
            sent_on=r.sent_on.isoformat() if r.sent_on else None,
        )
        for r, number, inst, reg in (await db.execute(q)).all()
    ]


@router.get("/alerts/escalations", response_model=list[EscalationOut])
async def alert_escalations(
    principal: AlertReader, db: DbSession, region: str | None = None
) -> list[EscalationOut]:
    """Open escalations computed for today by the same rules as the command view."""
    today = date.today()
    scope = await psvc.scope_for(db, principal.user)
    facts, rules = await psvc.scoped_facts(db, scope)
    states = await psvc.states(db, scope, today)
    index = {r.id: r for r in await psvc.registry_index(db)}
    regions = dict((await db.execute(select(Region.code, Region.name))).all())
    ladder = rules.escalation.ladder
    out = []
    for f in facts:
        st = states.get(f.id)
        if st is None or not st.escalation or (region and f.region != region):
            continue
        overdue = -st.days_to_maturity
        nxt = next(((d, name) for d, name in ladder if d > overdue), None)
        meta = index[f.id]
        out.append(
            EscalationOut(
                instrument_id=f.id,
                number=meta.number,
                institution=meta.institution,
                region=regions.get(f.region, f.region),
                amount_paise=str(f.amount_paise),
                level=st.escalation,
                raised_on=(
                    f.maturity_date
                    + timedelta(days=max(d for d, name in ladder if name == st.escalation))
                ).isoformat(),
                days_overdue=overdue,
                next_level=nxt[1] if nxt else None,
                next_level_on=(f.maturity_date + timedelta(days=nxt[0])).isoformat()
                if nxt
                else None,
            )
        )
    out.sort(key=lambda e: -e.days_overdue)
    return out
