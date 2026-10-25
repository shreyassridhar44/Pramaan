"""Daily monitoring: reminders on the configured ladder, escalations, notifications and outbox.

Idempotent: a reminder is created once per instrument and ladder offset, and an escalation level
is recorded once per instrument and level, so running twice on the same day changes nothing.
"""

import logging
import smtplib
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from email.message import EmailMessage

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.domain.asof import state_on
from app.domain.provenance import rupees
from app.domain.rules.maturity import reminders_between
from app.domain.types import Role, Status
from app.models import Escalation, Instrument, Notification, Outbox, Reminder, User
from app.services import audit
from app.services import portfolio as psvc

log = logging.getLogger("pramaan.monitoring")
WATCHED = {Status.ACTIVE, Status.MATURING, Status.MATURED}


@dataclass
class RunSummary:
    run_on: str
    reminders: int = 0
    escalations: int = 0
    notifications: int = 0
    emails_sent: int = 0
    simulated_messages: int = 0
    details: list[str] = field(default_factory=list)


async def run_monitoring(
    db: AsyncSession, today: date | None = None, actor_label: str = "Pramaan scheduler"
) -> RunSummary:
    today = today or date.today()
    summary = RunSummary(today.isoformat())
    facts, rules = await psvc.scoped_facts(db, psvc.Scope("all"))
    existing_rem: set[tuple[int, int]] = set(
        (await db.execute(select(Reminder.instrument_id, Reminder.offset_days))).all()
    )
    open_esc = {
        e.entity_id: e
        for e in (
            await db.scalars(select(Escalation).where(Escalation.resolved_on.is_(None)))
        ).all()
    }
    institution_users = {
        u.institution_id: u
        for u in (await db.scalars(select(User).where(User.role == Role.INSTITUTION_USER))).all()
    }
    section_head = await db.scalar(select(User).where(User.role == Role.SECTION_HEAD))
    window_start = today - timedelta(days=6)

    for f in facts:
        st = state_on(f, today, rules)
        if st is None or st.status not in WATCHED:
            continue
        inst: Instrument | None = None
        for r in reminders_between(f.maturity_date, window_start, today, rules.maturity):
            if (f.id, r.offset_days) in existing_rem:
                continue
            inst = inst or await db.get(Instrument, f.id)
            assert inst is not None
            when = (
                "today"
                if r.offset_days == 0
                else (
                    f"in {r.offset_days} days"
                    if r.offset_days > 0
                    else f"{-r.offset_days} days ago"
                )
            )
            subject = f"Security deposit {inst.number} matures {when}"
            body = (
                f"Your security deposit {inst.number} of {rupees(inst.amount_paise // 100)}"
                f" with AICTE matures on "
                f"{inst.maturity_date:%d %b %Y}. Submit a renewal or apply for release"
                " on the Pramaan portal."
            )
            user = institution_users.get(inst.institution_id)
            recipient = user.email if user else f"accounts+{inst.institution_id}@institution.demo"
            db.add(
                Reminder(
                    instrument_id=inst.id,
                    rule_code=rules.maturity.ref.code,
                    offset_days=r.offset_days,
                    channel="email",
                    recipient=recipient,
                    due_on=r.due_on,
                    sent_on=today,
                    status="sent",
                )
            )
            db.add(
                Outbox(
                    channel="email",
                    recipient=recipient,
                    subject=subject,
                    body=body,
                    status="queued",
                )
            )
            db.add(
                Outbox(
                    channel="sms",
                    recipient="+91 98XXXXXX10",
                    subject="",
                    body=subject,
                    status="sent",
                    simulated=True,
                    sent_at=datetime.now(UTC),
                )
            )
            summary.simulated_messages += 1
            if inst.owner_id:
                db.add(
                    Notification(
                        user_id=inst.owner_id,
                        title=subject,
                        body=f"Reminder T-{r.offset_days} sent to the institution."
                        if r.offset_days >= 0
                        else "Overdue reminder sent to the institution.",
                        link=f"/instruments/{inst.id}",
                    )
                )
                summary.notifications += 1
            if user:
                db.add(Notification(user_id=user.id, title=subject, body=body, link="/portal"))
                summary.notifications += 1
            existing_rem.add((f.id, r.offset_days))
            summary.reminders += 1

        if st.escalation:
            current = open_esc.get(f.id)
            if current is None or current.level != st.escalation:
                if current is not None:
                    current.resolved_on = today
                db.add(
                    Escalation(
                        entity_type="instrument",
                        entity_id=f.id,
                        level=st.escalation,
                        raised_on=today,
                    )
                )
                summary.escalations += 1
                if section_head and st.escalation in (
                    "section_head",
                    "deputy_director",
                    "director",
                ):
                    db.add(
                        Notification(
                            user_id=section_head.id,
                            title=f"Escalated to {st.escalation.replace('_', ' ')}",
                            body=f"Instrument {f.id} matured {-st.days_to_maturity} days ago"
                            " with no action.",
                            link=f"/instruments/{f.id}",
                        )
                    )
                    summary.notifications += 1

    await db.flush()
    summary.emails_sent = await send_outbox(db)
    await audit.append(
        db,
        actor_id=None,
        actor_label=actor_label,
        action="monitoring.run",
        entity_type="system",
        entity_id=None,
        data={
            "run_on": summary.run_on,
            "reminders": summary.reminders,
            "escalations": summary.escalations,
        },
    )
    await db.commit()
    return summary


async def send_outbox(db: AsyncSession, limit: int = 200) -> int:
    """Sends queued emails through SMTP (Mailpit locally) or SES. Failures stay queued."""
    s = get_settings()
    rows = (
        await db.scalars(
            select(Outbox).where(Outbox.channel == "email", Outbox.status == "queued").limit(limit)
        )
    ).all()
    if not rows:
        return 0
    sent = 0
    try:
        if s.email_backend == "ses":
            import boto3

            ses = boto3.client("sesv2", region_name=s.aws_region)
            for o in rows:
                ses.send_email(
                    FromEmailAddress=s.email_from,
                    Destination={"ToAddresses": [o.recipient]},
                    Content={
                        "Simple": {
                            "Subject": {"Data": o.subject},
                            "Body": {"Text": {"Data": o.body}},
                        }
                    },
                )
                o.status, o.sent_at = "sent", datetime.now(UTC)
                sent += 1
        else:
            with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=5) as smtp:
                for o in rows:
                    msg = EmailMessage()
                    msg["From"], msg["To"], msg["Subject"] = s.email_from, o.recipient, o.subject
                    msg.set_content(
                        o.body + "\n\nPramaan, AICTE Regulation Bureau (synthetic demo data)."
                    )
                    smtp.send_message(msg)
                    o.status, o.sent_at = "sent", datetime.now(UTC)
                    sent += 1
    except (OSError, smtplib.SMTPException) as exc:
        log.warning("email delivery failed", extra={"fields": {"error": str(exc)}})
    return sent
