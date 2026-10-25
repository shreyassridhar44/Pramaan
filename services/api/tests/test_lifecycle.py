"""Corrections, resubmission, escalation over time and the renewal chain (R7, R10, FR9, FR13)."""

from datetime import date, timedelta

from httpx import AsyncClient
from sqlalchemy import select

from app.db import SessionLocal
from app.models import Escalation, FieldObservation, Instrument
from app.services import portfolio as psvc
from app.services.monitoring import run_monitoring
from tests.conftest import ANCHOR, sign_in

LIVE = ("active", "maturing")


async def _as(client: AsyncClient, persona: str) -> AsyncClient:
    client.cookies.clear()
    client.headers.pop("x-csrf-token", None)
    return await sign_in(client, persona)


async def _new_instrument(status: str, verified: bool, tag: str) -> Instrument:
    """A fresh deposit for the demo institution, so tests do not consume seeded ones."""
    async with SessionLocal() as db:
        base = await db.scalar(
            select(Instrument).where(Instrument.institution_id == 1).order_by(Instrument.id)
        )
        assert base is not None
        inst = Instrument(
            number=f"{tag}{base.id:010d}{date.today():%m%d}",
            kind=base.kind,
            institution_id=1,
            demand_id=base.demand_id,
            bank_id=base.bank_id,
            branch=base.branch,
            ifsc=base.ifsc,
            amount_paise=base.amount_paise,
            issue_date=date(2016, 10, 20),
            maturity_date=date.today() + timedelta(days=40),
            tenure_months=120,
            status=status,
            submitted_on=date(2016, 10, 21),
            verified_on=date(2016, 11, 1) if verified else None,
        )
        db.add(inst)
        # Endpoints bump the data version on every write; direct inserts must too, or cached
        # portfolio facts would not include the new deposit.
        await psvc.bump_data_version(db)
        await db.commit()
        return inst


async def _unverified_with_declared_amount() -> Instrument:
    """A submission awaiting scrutiny, given a declared amount that disagrees with its receipt."""
    async with SessionLocal() as db:
        inst = await db.scalar(
            select(Instrument)
            .where(
                Instrument.verified_on.is_(None),
                Instrument.returned_on.is_(None),
                Instrument.status == "submitted",
                Instrument.conflict_since.is_(None),
            )
            .order_by(Instrument.id)
            .limit(1)
        )
        assert inst is not None
        wrong = inst.amount_paise * 2
        for source, norm in (("declared", wrong), ("extracted", inst.amount_paise)):
            db.add(
                FieldObservation(
                    instrument_id=inst.id,
                    field="amount",
                    source=source,
                    value_raw=str(norm // 100),
                    value_norm=str(norm),
                    evidence_type="user" if source == "declared" else "document",
                    observed_on=ANCHOR,
                )
            )
        inst.conflict_since = ANCHOR
        await db.commit()
        return inst


async def test_correction_keeps_the_original_and_resolves_the_conflict(
    client: AsyncClient,
) -> None:
    inst = await _unverified_with_declared_amount()
    await _as(client, "institution")
    denied = await client.post(
        f"/api/v1/instruments/{inst.id}/corrections",
        json={"field": "amount", "value": "1", "reason": "Not allowed"},
    )
    assert denied.status_code == 403

    await _as(client, "bureau")
    number = await client.post(
        f"/api/v1/instruments/{inst.id}/corrections",
        json={"field": "number", "value": "123", "reason": "Typo"},
    )
    assert number.status_code == 422
    unreadable = await client.post(
        f"/api/v1/instruments/{inst.id}/corrections",
        json={"field": "issue_date", "value": "not a date", "reason": "Typo"},
    )
    assert unreadable.status_code == 422

    rupees = str(inst.amount_paise // 100)
    r = await client.post(
        f"/api/v1/instruments/{inst.id}/corrections",
        json={"field": "amount", "value": rupees, "reason": "Typing error confirmed by phone"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["corrected_from"] is not None
    assert body["conflict_remaining"] is False
    same = await client.post(
        f"/api/v1/instruments/{inst.id}/corrections",
        json={"field": "amount", "value": rupees, "reason": "Again"},
    )
    assert same.status_code == 409

    detail = (await client.get(f"/api/v1/instruments/{inst.id}")).json()
    amount = next(p for p in detail["provenance"] if p["field"] == "amount")
    assert amount["state"] == "match"
    assert amount["declared"]["evidence_type"] == "correction"
    assert amount["declared"]["corrected_from"] == body["corrected_from"]
    assert amount["declared"]["corrected_by"] == "Ananya Iyer"
    assert amount["declared"]["note"] == "Typing error confirmed by phone"
    assert amount["correctable"] is True
    assert next(p for p in detail["provenance"] if p["field"] == "number")["correctable"] is False

    async with SessionLocal() as db:
        history = (
            await db.scalars(
                select(FieldObservation.value_norm).where(
                    FieldObservation.instrument_id == inst.id,
                    FieldObservation.field == "amount",
                    FieldObservation.source == "declared",
                )
            )
        ).all()
    assert str(inst.amount_paise * 2) in history


async def test_correction_cannot_hide_a_bank_disagreement(client: AsyncClient) -> None:
    async with SessionLocal() as db:
        inst = await db.scalar(
            select(Instrument)
            .where(Instrument.status == "active", Instrument.conflict_since.is_(None))
            .order_by(Instrument.id.desc())
            .limit(1)
        )
        assert inst is not None
        db.add(
            FieldObservation(
                instrument_id=inst.id,
                field="maturity_date",
                source="confirmed",
                value_raw="2040-01-01",
                value_norm="2040-01-01",
                evidence_type="bank_message",
                observed_on=ANCHOR,
            )
        )
        db.add(
            FieldObservation(
                instrument_id=inst.id,
                field="maturity_date",
                source="extracted",
                value_raw=inst.maturity_date.isoformat(),
                value_norm=inst.maturity_date.isoformat(),
                evidence_type="document",
                observed_on=ANCHOR,
            )
        )
        await db.commit()
    await _as(client, "bureau")
    r = await client.post(
        f"/api/v1/instruments/{inst.id}/corrections",
        json={"field": "maturity_date", "value": "2040-01-01", "reason": "Match the bank"},
    )
    assert r.status_code == 200, r.text
    # The receipt still says otherwise, so the conflict stays for the officer to resolve.
    assert r.json()["conflict_remaining"] is True


async def test_returned_submission_is_corrected_and_resubmitted(client: AsyncClient) -> None:
    inst_id = (await _new_instrument("submitted", verified=False, tag="RS")).id

    await _as(client, "bureau")
    r = await client.post(
        f"/api/v1/instruments/{inst_id}/actions/return",
        json={"reason": "Issue date on the receipt differs from the form"},
    )
    assert r.status_code == 200, r.text
    assert "deficiency letter AICTE/RB/SD/DEF/" in r.json()["message"]

    await _as(client, "institution")
    letters = (await client.get("/api/v1/letters")).json()
    deficiency = next(lt for lt in letters if lt["kind"] == "deficiency")
    pdf = await client.get(f"/api/v1/letters/{deficiency['id']}/pdf")
    assert pdf.content.startswith(b"%PDF")
    token = deficiency["verify_url"].rsplit("/", 1)[1]
    verified = (await client.get(f"/api/v1/public/verify/{token}")).json()
    assert verified["result"] == "genuine"
    assert verified["letter"]["title"] == "Deficiency letter"
    home = (await client.get("/api/v1/portal/home")).json()
    item = next(i for i in home["instruments"] if i["id"] == inst_id)
    assert item["status"] == "returned"
    assert "Issue date" in item["return_reason"]
    empty = await client.post(
        f"/api/v1/portal/instruments/{inst_id}/resubmit", json={"note": "Nothing"}
    )
    assert empty.status_code == 422
    sent = await client.post(
        f"/api/v1/portal/instruments/{inst_id}/resubmit",
        json={"changes": {"issue_date": "2016-10-20"}, "note": "Corrected the issue date"},
    )
    assert sent.status_code == 200, sent.text
    assert sent.json()["status"] == "submitted"
    assert sent.json()["changed"] == ["issue_date"]
    again = await client.post(
        f"/api/v1/portal/instruments/{inst_id}/resubmit",
        json={"changes": {"issue_date": "2016-10-21"}, "note": "Twice"},
    )
    assert again.status_code == 409

    await _as(client, "bureau")
    today = date.today()
    now = (await client.get(f"/api/v1/instruments/{inst_id}")).json()
    assert now["status"] in ("submitted", "discrepancy")
    yesterday = (
        await client.get(
            f"/api/v1/instruments/{inst_id}",
            params={"as_of": (today - timedelta(days=1)).isoformat()},
        )
    ).json()
    assert yesterday.get("status") != "returned"


async def test_escalation_climbs_the_ladder_over_simulated_days(seeded: None) -> None:
    async with SessionLocal() as db:
        inst = await db.scalar(
            select(Instrument)
            .where(
                Instrument.status.in_(LIVE),
                Instrument.maturity_date > ANCHOR + timedelta(days=200),
                Instrument.maturity_date < ANCHOR + timedelta(days=400),
                Instrument.release_requested_on.is_(None),
                Instrument.lien_hold_since.is_(None),
            )
            .order_by(Instrument.maturity_date)
            .limit(1)
        )
        assert inst is not None
        maturity = inst.maturity_date
        levels = []
        for days in (1, 16, 31, 61):
            await run_monitoring(db, today=maturity + timedelta(days=days), actor_label="test")
            open_esc = await db.scalar(
                select(Escalation).where(
                    Escalation.entity_id == inst.id, Escalation.resolved_on.is_(None)
                )
            )
            assert open_esc is not None
            levels.append(open_esc.level)
        assert levels == ["dealing_officer", "section_head", "deputy_director", "director"]
        before = len(
            (await db.scalars(select(Escalation).where(Escalation.entity_id == inst.id))).all()
        )
        await run_monitoring(db, today=maturity + timedelta(days=61), actor_label="test")
        after = len(
            (await db.scalars(select(Escalation).where(Escalation.entity_id == inst.id))).all()
        )
        assert after == before


async def test_renewal_chain_links_and_closes_the_predecessor(client: AsyncClient) -> None:
    pred = await _new_instrument("active", verified=True, tag="PR")
    async with SessionLocal() as db:
        succ = Instrument(
            number=f"RN{pred.id:012d}",
            kind=pred.kind,
            institution_id=pred.institution_id,
            demand_id=pred.demand_id,
            predecessor_id=pred.id,
            bank_id=pred.bank_id,
            branch=pred.branch,
            ifsc=pred.ifsc,
            amount_paise=pred.amount_paise,
            issue_date=pred.maturity_date,
            maturity_date=pred.maturity_date + timedelta(days=3652),
            tenure_months=120,
            status="submitted",
            submitted_on=date.today(),
        )
        db.add(succ)
        await db.commit()
        pred_id, succ_id = pred.id, succ.id

    await _as(client, "bureau")
    ok = await client.post(f"/api/v1/instruments/{succ_id}/actions/verify", json={})
    assert ok.status_code == 200, ok.text
    detail = (await client.get(f"/api/v1/instruments/{succ_id}")).json()
    chain_ids = [c["id"] for c in detail["chain"]]
    assert chain_ids.index(pred_id) < chain_ids.index(succ_id)
    pred_detail = (await client.get(f"/api/v1/instruments/{pred_id}")).json()
    assert pred_detail["status"] == "renewed"

    await _as(client, "institution")
    home = (await client.get("/api/v1/portal/home")).json()
    assert all(i["id"] != pred_id for i in home["instruments"])
    twice = await client.post(
        "/api/v1/portal/submissions",
        json={
            "predecessor_id": pred_id,
            "declared": {
                "kind": "joint_fdr",
                "bank_code": "BHNX",
                "branch": "Pune",
                "ifsc": "BHNX0411002",
                "number": "1111222233334444",
                "amount_rupees": 1500000,
                "issue_date": "2027-01-01",
                "maturity_date": "2037-01-01",
                "holders": "Member Secretary, AICTE",
                "lien": True,
            },
            "fdr_document_id": 1,
            "affidavit_document_id": 1,
            "declaration_accepted": True,
        },
    )
    assert twice.status_code == 409


async def test_reminders_go_out_once_at_each_offset(seeded: None) -> None:
    """S3: a deposit approaching maturity gets T-90, T-60, T-30, T-15, T-7 and T-0 reminders,
    each exactly once, however often the daily run executes."""
    from app.models import Reminder

    pred = await _new_instrument("active", verified=True, tag="RM")
    async with SessionLocal() as db:
        inst = await db.get(Instrument, pred.id)
        assert inst is not None
        maturity = date.today() + timedelta(days=500)
        inst.maturity_date = maturity
        await psvc.bump_data_version(db)
        await db.commit()
        for back in range(95, -1, -4):
            await run_monitoring(db, today=maturity - timedelta(days=back), actor_label="test")
        await run_monitoring(db, today=maturity, actor_label="test")
        offsets = (
            await db.scalars(
                select(Reminder.offset_days)
                .where(Reminder.instrument_id == inst.id)
                .order_by(Reminder.offset_days.desc())
            )
        ).all()
    assert offsets == [90, 60, 30, 15, 7, 0]
