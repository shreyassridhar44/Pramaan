"""Monitoring alerts beyond maturity reminders, the alerts views, bulk actions and penalties."""

from datetime import date, timedelta

from httpx import AsyncClient
from sqlalchemy import select

from app.db import SessionLocal
from app.models import Demand, Event, Instrument, ReleaseCase, Reminder
from app.services import portfolio as psvc
from app.services.monitoring import AUTO_RENEW, RECONFIRM, run_monitoring
from tests.conftest import sign_in


async def _as(client: AsyncClient, persona: str) -> AsyncClient:
    client.cookies.clear()
    client.headers.pop("x-csrf-token", None)
    return await sign_in(client, persona)


async def test_reconfirmation_auto_renewal_and_penalty_alerts_fire_once(seeded: None) -> None:
    today = date.today()
    async with SessionLocal() as db:
        base = await db.scalar(
            select(Instrument).where(Instrument.institution_id == 1).order_by(Instrument.id)
        )
        assert base is not None
        stale = Instrument(
            number=f"RC{today:%m%d}0000001",
            kind=base.kind,
            institution_id=1,
            bank_id=base.bank_id,
            branch=base.branch,
            ifsc=base.ifsc,
            amount_paise=base.amount_paise,
            issue_date=today - timedelta(days=900),
            maturity_date=today + timedelta(days=2000),
            tenure_months=120,
            status="active",
            submitted_on=today - timedelta(days=900),
            verified_on=today - timedelta(days=890),
            document_checked_on=today - timedelta(days=890),
            bank_confirmed_on=today - timedelta(days=800),
            last_confirmed_on=today - timedelta(days=500),
        )
        renewing = Instrument(
            number=f"AR{today:%m%d}0000001",
            kind=base.kind,
            institution_id=1,
            bank_id=base.bank_id,
            branch=base.branch,
            ifsc=base.ifsc,
            amount_paise=base.amount_paise,
            issue_date=today - timedelta(days=3630),
            maturity_date=today + timedelta(days=20),
            tenure_months=120,
            auto_renew=True,
            status="maturing",
            submitted_on=today - timedelta(days=3630),
            verified_on=today - timedelta(days=3620),
        )
        demand = Demand(
            institution_id=1,
            reason="new_programme",
            lines=[],
            amount_paise=15_00_000_00,
            rule_code="demand.rate_card",
            rule_version=1,
            intimated_on=today - timedelta(days=60),
            due_on=today - timedelta(days=45),
            status="open",
        )
        db.add_all([stale, renewing, demand])
        await psvc.bump_data_version(db)
        await db.commit()
        ids = (stale.id, renewing.id, demand.id)

    async with SessionLocal() as db:
        first = await run_monitoring(db, today=today, actor_label="test")
        assert first.reconfirmations >= 1
        assert first.auto_renewals >= 1
        assert first.penalty_notices >= 1
        reminders = (
            await db.execute(
                select(Reminder.instrument_id, Reminder.rule_code).where(
                    Reminder.instrument_id.in_(ids[:2])
                )
            )
        ).all()
        assert (ids[0], RECONFIRM) in reminders
        assert (ids[1], AUTO_RENEW) in reminders
        notice = await db.scalar(
            select(Event).where(
                Event.entity_type == "demand",
                Event.entity_id == ids[2],
                Event.type == "demand.penalty_window",
            )
        )
        assert notice is not None
        second = await run_monitoring(db, today=today, actor_label="test")
        assert (second.reconfirmations, second.auto_renewals, second.penalty_notices) == (0, 0, 0)


async def test_alert_views(client: AsyncClient) -> None:
    await _as(client, "bureau")
    reminders = await client.get("/api/v1/alerts/reminders", params={"limit": 50})
    assert reminders.status_code == 200
    escalations = (await client.get("/api/v1/alerts/escalations")).json()
    assert escalations
    days = [e["days_overdue"] for e in escalations]
    assert days == sorted(days, reverse=True)
    top = escalations[0]
    assert top["level"] in ("dealing_officer", "section_head", "deputy_director", "director")
    await _as(client, "institution")
    assert (await client.get("/api/v1/alerts/escalations")).status_code == 403


async def test_bulk_actions_report_what_they_skipped(client: AsyncClient) -> None:
    async with SessionLocal() as db:
        ids = list(
            (
                await db.scalars(
                    select(Instrument.id)
                    .where(Instrument.status.in_(("active", "maturing")))
                    .order_by(Instrument.id)
                    .limit(3)
                )
            ).all()
        )
    await _as(client, "bureau")
    me = (await client.get("/api/v1/auth/me")).json()
    r = await client.post(
        "/api/v1/instruments/bulk",
        json={"ids": ids, "action": "assign", "owner_id": me["id"]},
    )
    assert r.status_code == 200, r.text
    assert r.json()["done"] == len(ids)
    again = (
        await client.post(
            "/api/v1/instruments/bulk",
            json={"ids": ids, "action": "assign", "owner_id": me["id"]},
        )
    ).json()
    assert again["done"] == 0
    assert again["reasons"] == {"already assigned to this officer": len(ids)}
    remind = (
        await client.post("/api/v1/instruments/bulk", json={"ids": ids, "action": "remind"})
    ).json()
    assert remind["done"] == len(ids)
    confirm = (
        await client.post(
            "/api/v1/instruments/bulk",
            json={"ids": [*ids, 999999], "action": "request_confirmation"},
        )
    ).json()
    assert confirm["reasons"].get("not found or outside your scope") == 1
    await _as(client, "institution")
    denied = await client.post("/api/v1/instruments/bulk", json={"ids": ids, "action": "remind"})
    assert denied.status_code == 403


async def test_penalty_must_be_settled_before_release(client: AsyncClient) -> None:
    async with SessionLocal() as db:
        cases = (await db.scalars(select(ReleaseCase).order_by(ReleaseCase.id))).all()
        case = next((c for c in cases if (c.penalty or {}).get("due_paise")), None)
        assert case is not None
        case_id = case.id
    await _as(client, "authority")
    detail = (await client.get(f"/api/v1/releases/{case_id}")).json()
    check = next(c for c in detail["checks"] if c["code"] == "penalties_settled")
    assert check["state"] != "pass"
    assert detail["can_settle_penalty"] is True
    assert detail["penalty"]["items"][0]["aph_ref"].startswith("APH 2024-27 Clause 2.21")
    r = await client.post(
        f"/api/v1/releases/{case_id}/penalty/settle", json={"reference": "UTR 2026102500123"}
    )
    assert r.status_code == 200, r.text
    after = r.json()
    assert next(c for c in after["checks"] if c["code"] == "penalties_settled")["state"] == "pass"
    assert after["penalty"]["reference"] == "UTR 2026102500123"
    twice = await client.post(
        f"/api/v1/releases/{case_id}/penalty/settle", json={"reference": "again"}
    )
    assert twice.status_code == 409


async def test_reminder_preview_matches_sent_wording(client: AsyncClient) -> None:
    await sign_in(client, "bureau")
    rows = (await client.get("/api/v1/alerts/reminders", params={"limit": 1})).json()
    assert rows, "seed has reminders"
    p = (await client.get(f"/api/v1/alerts/reminders/{rows[0]['id']}/preview")).json()
    assert rows[0]["number"] in p["subject_en"] and rows[0]["number"] in p["subject_hi"]
    assert "Pramaan" in p["body_en"] and "सुरक्षा जमा" in p["body_hi"]
    assert p["simulated_channels"] == ["sms", "whatsapp"]
