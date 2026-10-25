"""Bank confirmation (R6) and monitoring (R7): signed responses, conflicts, the desk, reminders."""

from httpx import AsyncClient
from sqlalchemy import select

from app.db import SessionLocal
from app.models import Bank, BankRequest, Institution, Instrument, Signal, SimBankDeposit, User
from app.services import bank as svc
from tests.conftest import sign_in

LIVE = ("active", "maturing")


async def _instrument_at(integration: str, bank_id: int | None = None) -> Instrument:
    """A live instrument held at a bank of the given kind, with a record in the simulated bank
    and no request already waiting."""
    async with SessionLocal() as db:
        q = (
            select(Instrument)
            .join(Bank, Bank.id == Instrument.bank_id)
            .join(
                SimBankDeposit,
                (SimBankDeposit.bank_id == Bank.id) & (SimBankDeposit.number == Instrument.number),
            )
            .where(Bank.integration == integration, Instrument.status.in_(LIVE))
            .where(
                ~select(BankRequest.id)
                .where(BankRequest.instrument_id == Instrument.id, BankRequest.status == "sent")
                .exists()
            )
            .order_by(Instrument.id)
        )
        if bank_id is not None:
            q = q.where(Bank.id == bank_id)
        inst = await db.scalar(q.limit(1))
        assert inst is not None
        return inst


async def _bank_persona_bank() -> int:
    async with SessionLocal() as db:
        bank_id = await db.scalar(
            select(User.bank_id).where(User.bank_id.is_not(None)).order_by(User.id).limit(1)
        )
        assert bank_id is not None
        return bank_id


def test_signature_round_trip_and_tamper() -> None:
    from base64 import b64encode

    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    from cryptography.hazmat.primitives.serialization import (
        Encoding,
        NoEncryption,
        PrivateFormat,
        PublicFormat,
    )

    key = Ed25519PrivateKey.generate()
    priv = b64encode(key.private_bytes(Encoding.Raw, PrivateFormat.Raw, NoEncryption())).decode()
    pub = b64encode(key.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw)).decode()
    payload = {"number": "123", "amount": "1500000.00"}
    sig = svc.sign(priv, payload)
    assert svc.verify(pub, {"amount": "1500000.00", "number": "123"}, sig)
    assert not svc.verify(pub, {**payload, "amount": "3500000.00"}, sig)
    assert not svc.verify(pub, payload, "not-base64!")


async def test_network_bank_answers_automatically(client: AsyncClient) -> None:
    inst = await _instrument_at("network")
    await sign_in(client, "bureau")
    r = await client.post(f"/api/v1/instruments/{inst.id}/bank/request", json={"kind": "confirm"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["answered"] is True
    assert body["conflicts"] == []
    [msg] = body["request"]["messages"]
    assert msg["signature_valid"] is True
    assert msg["payload"]["number"] == inst.number


async def test_bank_record_that_differs_raises_a_conflict(client: AsyncClient) -> None:
    inst = await _instrument_at("network")
    async with SessionLocal() as db:
        rec = await db.scalar(
            select(SimBankDeposit).where(
                SimBankDeposit.bank_id == inst.bank_id, SimBankDeposit.number == inst.number
            )
        )
        assert rec is not None
        rec.amount_paise = inst.amount_paise // 2
        await db.commit()
    await sign_in(client, "bureau")
    r = await client.post(f"/api/v1/instruments/{inst.id}/bank/request", json={"kind": "confirm"})
    assert r.status_code == 200, r.text
    assert "amount" in r.json()["conflicts"]
    detail = (await client.get(f"/api/v1/instruments/{inst.id}")).json()
    amount = next(p for p in detail["provenance"] if p["field"] == "amount")
    assert amount["state"] == "conflict"


async def test_desk_bank_waits_for_the_officer(client: AsyncClient) -> None:
    inst = await _instrument_at("desk", await _bank_persona_bank())
    await sign_in(client, "bureau")
    r = await client.post(f"/api/v1/instruments/{inst.id}/bank/request", json={"kind": "confirm"})
    assert r.status_code == 200, r.text
    assert r.json()["answered"] is False
    request_id = r.json()["request"]["id"]
    again = await client.post(
        f"/api/v1/instruments/{inst.id}/bank/request", json={"kind": "confirm"}
    )
    assert again.status_code == 409

    client.cookies.clear()
    await sign_in(client, "bank")
    inbox = (await client.get("/api/v1/bank/requests")).json()
    assert request_id in {i["id"] for i in inbox}
    wrong = await client.post(
        f"/api/v1/bank/requests/{request_id}/respond", json={"action": "discharge"}
    )
    assert wrong.status_code == 422
    done = await client.post(
        f"/api/v1/bank/requests/{request_id}/respond", json={"action": "confirm"}
    )
    assert done.status_code == 200, done.text
    [msg] = done.json()["request"]["messages"]
    assert msg["signature_valid"] is True
    assert msg["payload"]["answered_by"]
    twice = await client.post(
        f"/api/v1/bank/requests/{request_id}/respond", json={"action": "confirm"}
    )
    assert twice.status_code == 409


async def test_desk_cannot_see_another_banks_requests(client: AsyncClient) -> None:
    own = await _bank_persona_bank()
    async with SessionLocal() as db:
        other = await db.scalar(select(BankRequest.id).where(BankRequest.bank_id != own).limit(1))
    assert other is not None
    await sign_in(client, "bank")
    r = await client.get(f"/api/v1/bank/requests/{other}")
    assert r.status_code == 404


async def test_tampered_response_is_rejected(seeded: None) -> None:
    inst = await _instrument_at("network")
    async with SessionLocal() as db:
        inst = await db.get(Instrument, inst.id)
        assert inst is not None
        bank = await db.get(Bank, inst.bank_id)
        assert bank is not None
        outcome = await svc.create_request(db, inst, "reconfirm", None, "test")
        assert outcome.message is not None
        req = BankRequest(
            instrument_id=inst.id,
            bank_id=bank.id,
            kind="reconfirm",
            adapter="simulated_network",
            status="sent",
            requested_on=outcome.request.requested_on,
            payload=outcome.request.payload,
        )
        db.add(req)
        await db.flush()
        forged = {**outcome.message.payload, "request_id": req.id, "amount": "99.00"}
        bad = await svc.receive(
            db, req, bank, forged, outcome.message.signature_b64, bank.key_id, "test"
        )
        assert bad.message is not None
        assert bad.message.signature_valid is False
        assert req.status == "failed"
        signal = await db.scalar(
            select(Signal).where(
                Signal.entity_id == inst.id, Signal.code == "invalid_bank_signature"
            )
        )
        assert signal is not None
        await db.rollback()


async def test_public_keys_are_published(client: AsyncClient) -> None:
    r = await client.get("/api/v1/public/bank-keys")
    assert r.status_code == 200
    keys = r.json()
    assert keys and all(k["algorithm"] == "Ed25519" for k in keys)


async def test_monitoring_is_idempotent(client: AsyncClient) -> None:
    await sign_in(client, "section_head")
    first = await client.post("/api/v1/monitoring/run")
    assert first.status_code == 200, first.text
    second = (await client.post("/api/v1/monitoring/run")).json()
    assert second["reminders"] == 0
    assert second["escalations"] == 0
    assert second["notifications"] == 0


async def test_institution_cannot_run_monitoring(client: AsyncClient) -> None:
    await sign_in(client, "institution")
    r = await client.post("/api/v1/monitoring/run")
    assert r.status_code == 403
    inbox = await client.get("/api/v1/notifications")
    assert inbox.status_code == 200


async def test_institution_scope_on_bank_history(client: AsyncClient) -> None:
    async with SessionLocal() as db:
        foreign = await db.scalar(
            select(Instrument.id)
            .join(Institution, Institution.id == Instrument.institution_id)
            .where(Institution.id != 1)
            .limit(1)
        )
    await sign_in(client, "institution")
    r = await client.get(f"/api/v1/instruments/{foreign}/bank")
    assert r.status_code in (403, 404)
