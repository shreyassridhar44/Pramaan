"""Daily monitoring: reminders on the configured ladder, escalations, notifications and outbox.

Idempotent: a reminder is created once per instrument and ladder offset, and an escalation level
is recorded once per instrument and level, so running twice on the same day changes nothing.
"""

import logging
import smtplib
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from email.message import EmailMessage
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.domain.asof import state_on
from app.domain.messages import maturity_reminder
from app.domain.provenance import rupees
from app.domain.rules.deadlines import furnishing_status
from app.domain.rules.maturity import reminders_between
from app.domain.types import Role, Status
from app.models import (
    Demand,
    Escalation,
    Event,
    Instrument,
    Notification,
    Outbox,
    Reminder,
    User,
)
from app.services import audit
from app.services import portfolio as psvc

log = logging.getLogger("pramaan.monitoring")
WATCHED = {Status.ACTIVE, Status.MATURING, Status.MATURED}


RECONFIRM = "monitoring.reconfirm"
AUTO_RENEW = "monitoring.auto_renew"
AUTO_RENEW_NOTICE_DAYS = 30
HELD_LIVE = {Status.ACTIVE, Status.MATURING}


@dataclass
class RunSummary:
    run_on: str
    reminders: int = 0
    escalations: int = 0
    notifications: int = 0
    emails_sent: int = 0
    simulated_messages: int = 0
    reconfirmations: int = 0
    auto_renewals: int = 0
    penalty_notices: int = 0
    details: list[str] = field(default_factory=list)


def _tell_institution(
    db: AsyncSession, recipient: str, subject: str, body: str, summary: RunSummary
) -> None:
    """Email (Mailpit locally, SES in AWS) plus the simulated SMS and WhatsApp channels."""
    db.add(
        Outbox(channel="email", recipient=recipient, subject=subject, body=body, status="queued")
    )
    for channel, to in (("sms", "+91 98XXXXXX10"), ("whatsapp", "+91 98XXXXXX10")):
        db.add(
            Outbox(
                channel=channel,
                recipient=to,
                subject="",
                body=subject,
                status="sent",
                simulated=True,
                sent_at=datetime.now(UTC),
            )
        )
        summary.simulated_messages += 1


async def run_monitoring(
    db: AsyncSession, today: date | None = None, actor_label: str = "Pramaan scheduler"
) -> RunSummary:
    today = today or date.today()
    summary = RunSummary(today.isoformat())
    facts, rules = await psvc.scoped_facts(db, psvc.Scope("all"))
    existing_rem: set[tuple[int, int]] = set(
        (
            await db.execute(
                select(Reminder.instrument_id, Reminder.offset_days).where(
                    Reminder.rule_code == rules.maturity.ref.code
                )
            )
        ).all()
    )
    # Other alerts are keyed by rule and due date, so each fires once per occurrence.
    other_rem: set[tuple[int, str, date]] = set(
        (
            await db.execute(
                select(Reminder.instrument_id, Reminder.rule_code, Reminder.due_on).where(
                    Reminder.rule_code != rules.maturity.ref.code
                )
            )
        ).all()
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
            msg = maturity_reminder(
                inst.number, inst.amount_paise, inst.maturity_date, r.offset_days
            )
            subject, body = msg.subject_en, msg.body_en
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
            _tell_institution(db, recipient, subject, body, summary)
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

    await _reconfirmations(db, facts, rules, today, other_rem, section_head, summary)
    await _auto_renewals(db, facts, rules, today, other_rem, institution_users, summary)
    await _penalty_windows(db, rules, today, institution_users, section_head, summary)

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
            "reconfirmations": summary.reconfirmations,
            "auto_renewals": summary.auto_renewals,
            "penalty_notices": summary.penalty_notices,
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


async def _reconfirmations(
    db: AsyncSession,
    facts: list[Any],
    rules: Any,
    today: date,
    seen: set[tuple[int, str, date]],
    section_head: User | None,
    summary: RunSummary,
) -> None:
    """Held deposits whose last bank confirmation is older than the re-confirmation window."""
    window = rules.maturity.reconfirm_window_days
    for f in facts:
        st = state_on(f, today, rules)
        last = f.evidence.last_confirmed_on or f.evidence.bank_confirmed_on
        if st is None or st.status not in HELD_LIVE or last is None:
            continue
        due = last + timedelta(days=window)
        if due > today or (f.id, RECONFIRM, due) in seen:
            continue
        officer = f.owner_id or (section_head.id if section_head else None)
        db.add(
            Reminder(
                instrument_id=f.id,
                rule_code=RECONFIRM,
                offset_days=(today - last).days,
                channel="in_app",
                recipient=f"user:{officer}" if officer else "unassigned",
                due_on=due,
                sent_on=today,
                status="sent",
            )
        )
        if officer:
            db.add(
                Notification(
                    user_id=officer,
                    title="Re-confirm a deposit with the bank",
                    body=f"Last confirmed on {last:%d %b %Y}; re-confirmation is due every "
                    f"{window} days.",
                    link=f"/instruments/{f.id}",
                )
            )
            summary.notifications += 1
        seen.add((f.id, RECONFIRM, due))
        summary.reconfirmations += 1


async def _auto_renewals(
    db: AsyncSession,
    facts: list[Any],
    rules: Any,
    today: date,
    seen: set[tuple[int, str, date]],
    institution_users: dict[int | None, User],
    summary: RunSummary,
) -> None:
    """Deposits set to renew automatically: ask the institution for the renewed receipt."""
    horizon = today + timedelta(days=AUTO_RENEW_NOTICE_DAYS)
    candidates = {f.id: f for f in facts if today <= f.maturity_date <= horizon}
    if not candidates:
        return
    rows = (
        (
            await db.scalars(
                select(Instrument).where(
                    Instrument.id.in_(list(candidates)), Instrument.auto_renew.is_(True)
                )
            )
        )
        .unique()
        .all()
    )
    for inst in rows:
        f = candidates[inst.id]
        st = state_on(f, today, rules)
        due = inst.maturity_date - timedelta(days=AUTO_RENEW_NOTICE_DAYS)
        if st is None or st.status not in HELD_LIVE or (inst.id, AUTO_RENEW, due) in seen:
            continue
        user = institution_users.get(inst.institution_id)
        recipient = user.email if user else f"accounts+{inst.institution_id}@institution.demo"
        subject = f"Deposit {inst.number} renews automatically on {inst.maturity_date:%d %b %Y}"
        body = (
            f"Your security deposit {inst.number} is marked for automatic renewal. After the bank "
            "renews it, upload the renewed receipt on the Pramaan portal so AICTE can verify the "
            "new deposit and release the lien on the old one."
        )
        db.add(
            Reminder(
                instrument_id=inst.id,
                rule_code=AUTO_RENEW,
                offset_days=AUTO_RENEW_NOTICE_DAYS,
                channel="email",
                recipient=recipient,
                due_on=due,
                sent_on=today,
                status="sent",
            )
        )
        _tell_institution(db, recipient, subject, body, summary)
        if user:
            db.add(Notification(user_id=user.id, title=subject, body=body, link="/portal"))
            summary.notifications += 1
        seen.add((inst.id, AUTO_RENEW, due))
        summary.auto_renewals += 1


async def _penalty_windows(
    db: AsyncSession,
    rules: Any,
    today: date,
    institution_users: dict[int | None, User],
    section_head: User | None,
    summary: RunSummary,
) -> None:
    """Open demands past their deadline: tell the institution which penalty slab now applies.
    After the last slab the section head is told a decision on approval is needed; the system
    never withdraws approval itself."""
    sent = {
        (e.entity_id, str((e.payload or {}).get("slab")))
        for e in (
            await db.scalars(
                select(Event).where(
                    Event.entity_type == "demand", Event.type == "demand.penalty_window"
                )
            )
        ).all()
    }
    demands = (await db.scalars(select(Demand).where(Demand.status == "open"))).all()
    for d in demands:
        fs = furnishing_status(d.intimated_on, None, today, d.amount_paise, rules.deadline)
        if fs.penalty_fraction == 0 and not fs.withdrawn:
            continue
        slab = "withdrawal" if fs.withdrawn else f"{round(fs.penalty_fraction * 100)}"
        if (d.id, slab) in sent:
            continue
        user = institution_users.get(d.institution_id)
        recipient = user.email if user else f"accounts+{d.institution_id}@institution.demo"
        if fs.withdrawn:
            subject = "Security deposit not furnished after the last penalty date"
            body = (
                f"The deposit of {rupees(d.amount_paise // 100)} demanded on "
                f"{d.intimated_on:%d %b %Y} has not been furnished. Under {fs.aph_ref} the "
                "approval is liable to be withdrawn. AICTE will decide; furnish it immediately."
            )
            if section_head:
                db.add(
                    Notification(
                        user_id=section_head.id,
                        title="Decision needed: deposit not furnished after the last slab",
                        body=f"Demand {d.id}: approval withdrawal is for the competent authority "
                        "to decide.",
                        link=f"/institutions/{d.institution_id}",
                    )
                )
                summary.notifications += 1
        else:
            subject = f"Security deposit overdue: {slab}% penalty now applies"
            body = (
                f"The deposit of {rupees(d.amount_paise // 100)} was due on {fs.due_on:%d %b %Y}. "
                f"{fs.explanation} ({rupees(fs.penalty_paise // 100)}). Furnish it on the Pramaan "
                "portal to avoid the next slab."
            )
        _tell_institution(db, recipient, subject, body, summary)
        if user:
            db.add(Notification(user_id=user.id, title=subject, body=body, link="/portal"))
            summary.notifications += 1
        db.add(
            Event(
                entity_type="demand",
                entity_id=d.id,
                type="demand.penalty_window",
                payload={"slab": slab, "penalty_paise": fs.penalty_paise},
                occurred_on=today,
            )
        )
        summary.penalty_notices += 1
