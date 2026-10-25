from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select

from app.api.deps import CurrentPrincipal, DbSession, Principal, require_roles
from app.domain.types import Role
from app.models import Notification
from app.services.monitoring import run_monitoring

router = APIRouter(tags=["monitoring"])
Runner = Annotated[Principal, Depends(require_roles(Role.SECTION_HEAD, Role.ADMIN))]


class RunOut(BaseModel):
    run_on: str
    reminders: int
    escalations: int
    notifications: int
    emails_sent: int
    simulated_messages: int


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
