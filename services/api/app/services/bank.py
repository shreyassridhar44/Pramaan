"""Bank confirmation network (simulated in the prototype, D11).

A request goes to the issuing bank through an adapter. Banks marked "network" answer automatically
from their own (simulated) records; banks marked "desk" are answered by a bank officer in the bank
desk. Every answer is a structured message signed with the bank's Ed25519 key. Pramaan verifies the
signature against the public key registry before using any value, stores the raw message, and
records confirmed values as a separate source; it never copies declared values into that source.
"""

import base64
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Any

import orjson
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.provenance import normalise
from app.domain.types import FieldName, Status
from app.models import (
    Bank,
    BankMessage,
    BankRequest,
    Event,
    FieldObservation,
    Instrument,
    Signal,
    SimBankDeposit,
    SimBankKey,
)
from app.services import audit
from app.services import portfolio as psvc

FIELD_FROM_PAYLOAD = {
    FieldName.NUMBER: "number",
    FieldName.IFSC: "ifsc",
    FieldName.HOLDERS: "holders",
    FieldName.AMOUNT: "amount",
    FieldName.ISSUE_DATE: "issue_date",
    FieldName.MATURITY_DATE: "maturity_date",
    FieldName.LIEN: "lien_in_favour_of_aicte",
}


def canonical_json(payload: dict[str, Any]) -> bytes:
    return orjson.dumps(payload, option=orjson.OPT_SORT_KEYS)


def sign(private_b64: str, payload: dict[str, Any]) -> str:
    key = Ed25519PrivateKey.from_private_bytes(base64.b64decode(private_b64))
    return base64.b64encode(key.sign(canonical_json(payload))).decode()


def verify(public_b64: str, payload: dict[str, Any], signature_b64: str) -> bool:
    try:
        key = Ed25519PublicKey.from_public_bytes(base64.b64decode(public_b64))
        key.verify(base64.b64decode(signature_b64), canonical_json(payload))
        return True
    except (InvalidSignature, ValueError):
        return False


def response_payload(
    req: BankRequest,
    bank: Bank,
    record: SimBankDeposit | None,
    overrides: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """What a bank returns: its own record of the deposit, or "not found"."""
    now = datetime.now(UTC).isoformat(timespec="seconds")
    if record is None:
        return {
            "message_type": "deposit_confirmation",
            "request_id": req.id,
            "bank_code": bank.code,
            "number": req.payload.get("number"),
            "result": "not_found",
            "responded_at": now,
        }
    body = {
        "message_type": "discharge_confirmation"
        if req.kind == "discharge"
        else "deposit_confirmation",
        "request_id": req.id,
        "bank_code": bank.code,
        "result": "found",
        "number": record.number,
        "branch": record.branch,
        "ifsc": record.ifsc,
        "holders": record.holders,
        "amount": f"{record.amount_paise // 100}.{record.amount_paise % 100:02d}",
        "issue_date": record.issue_date.isoformat(),
        "maturity_date": record.maturity_date.isoformat(),
        "lien_in_favour_of_aicte": "yes" if record.lien_aicte else "no",
        "encumbrance": record.encumbrance or "none",
        "deposit_status": record.status,
        "responded_at": now,
    }
    if req.kind == "discharge":
        body["lien_discharged"] = "yes"
    body.update(overrides or {})
    return body


async def private_key(db: AsyncSession, bank_id: int) -> str:
    key = await db.get(SimBankKey, bank_id)
    if key is None:
        raise RuntimeError("Simulated bank has no signing key")
    return key.private_key_b64


async def find_record(db: AsyncSession, bank_id: int, number: str) -> SimBankDeposit | None:
    return await db.scalar(
        select(SimBankDeposit).where(
            SimBankDeposit.bank_id == bank_id, SimBankDeposit.number == number
        )
    )


@dataclass
class Outcome:
    request: BankRequest
    message: BankMessage | None
    conflicts: list[str]
    answered: bool


async def create_request(
    db: AsyncSession, inst: Instrument, kind: str, actor_id: int | None, actor_label: str
) -> Outcome:
    bank = await db.get(Bank, inst.bank_id)
    assert bank is not None
    today = date.today()
    req = BankRequest(
        instrument_id=inst.id,
        bank_id=bank.id,
        kind=kind,
        adapter="simulated_network" if bank.integration == "network" else "bank_desk",
        status="sent",
        requested_by=actor_id,
        requested_on=today,
        payload={
            "number": inst.number,
            "ifsc": inst.ifsc,
            "amount_paise": inst.amount_paise,
            "issue_date": inst.issue_date.isoformat(),
            "maturity_date": inst.maturity_date.isoformat(),
            "kind": kind,
        },
    )
    db.add(req)
    await db.flush()
    db.add(
        Event(
            entity_type="instrument",
            entity_id=inst.id,
            type=f"bank.{kind}_requested",
            payload={"bank": bank.name, "adapter": req.adapter},
            actor_id=actor_id,
            occurred_on=today,
        )
    )
    await audit.append(
        db,
        actor_id=actor_id,
        actor_label=actor_label,
        action=f"bank.{kind}_requested",
        entity_type="instrument",
        entity_id=inst.id,
        data={"request_id": req.id},
    )
    if bank.integration == "network":
        record = await find_record(db, bank.id, inst.number)
        payload = response_payload(req, bank, record)
        signature = sign(await private_key(db, bank.id), payload)
        return await receive(
            db, req, bank, payload, signature, bank.key_id, actor_label="Simulated bank network"
        )
    return Outcome(req, None, [], False)


async def receive(
    db: AsyncSession,
    req: BankRequest,
    bank: Bank,
    payload: dict[str, Any],
    signature_b64: str,
    key_id: str,
    actor_label: str,
) -> Outcome:
    """Verifies a bank response and applies it to the instrument."""
    today = date.today()
    valid = key_id == bank.key_id and verify(bank.public_key_b64, payload, signature_b64)
    msg = BankMessage(
        request_id=req.id,
        bank_id=bank.id,
        payload=payload,
        canonical=canonical_json(payload).decode(),
        signature_b64=signature_b64,
        key_id=key_id,
        signature_valid=valid,
        received_on=today,
    )
    db.add(msg)
    req.status = "answered" if valid else "failed"
    await db.flush()
    inst = await db.get(Instrument, req.instrument_id)
    assert inst is not None
    conflicts: list[str] = []
    if not valid:
        db.add(
            Signal(
                entity_type="instrument",
                entity_id=inst.id,
                code="invalid_bank_signature",
                severity="high",
                title="A bank response failed signature verification",
                evidence={"message_id": msg.id, "key_id": key_id},
                source="bank.verify",
                source_version="1",
                status="open",
                raised_on=today,
            )
        )
    elif payload.get("result") == "not_found":
        conflicts.append("number")
        db.add(
            Signal(
                entity_type="instrument",
                entity_id=inst.id,
                code="bank_not_found",
                severity="high",
                title="The bank has no deposit with this number",
                evidence={
                    "message_id": msg.id,
                    "detail": "The issuing bank reports no matching deposit.",
                },
                source="bank.verify",
                source_version="1",
                status="open",
                raised_on=today,
            )
        )
        inst.conflict_since = inst.conflict_since or today
        inst.conflict_resolved_on = None
    elif req.kind == "discharge":
        inst.released_on = today
        inst.status = Status.RELEASED.value
        inst.next_action, inst.next_action_due = None, None
    else:
        declared = {
            o.field: o.value_norm
            for o in (
                await db.scalars(
                    select(FieldObservation)
                    .where(
                        FieldObservation.instrument_id == inst.id,
                        FieldObservation.source == "declared",
                    )
                    .order_by(FieldObservation.observed_on)
                )
            ).all()
        }
        for fld, key in FIELD_FROM_PAYLOAD.items():
            raw = str(payload.get(key, ""))
            if not raw:
                continue
            try:
                norm = normalise(fld, raw)
            except ValueError:
                continue
            db.add(
                FieldObservation(
                    instrument_id=inst.id,
                    field=fld.value,
                    source="confirmed",
                    value_raw=raw,
                    value_norm=norm,
                    evidence_type="bank_message",
                    evidence_id=msg.id,
                    observed_on=today,
                )
            )
            if fld.value in declared and declared[fld.value] != norm:
                conflicts.append(fld.value)
        db.add(
            FieldObservation(
                instrument_id=inst.id,
                field=FieldName.BANK.value,
                source="confirmed",
                value_raw=bank.name,
                value_norm=normalise(FieldName.BANK, bank.name),
                evidence_type="bank_message",
                evidence_id=msg.id,
                observed_on=today,
            )
        )
        if conflicts:
            inst.conflict_since = today
            inst.conflict_resolved_on = None
            inst.status = Status.DISCREPANCY.value
            inst.next_action, inst.next_action_due = (
                "Resolve discrepancy with institution and bank",
                today + timedelta(days=7),
            )
            for name in conflicts:
                db.add(
                    Signal(
                        entity_type="instrument",
                        entity_id=inst.id,
                        code="field_conflict",
                        severity="high",
                        title=f"Bank record does not match on {name.replace('_', ' ')}",
                        evidence={
                            "field": name,
                            "message_id": msg.id,
                            "detail": "The bank's signed record differs from the declared value.",
                        },
                        source="provenance.compare",
                        source_version="1",
                        status="open",
                        raised_on=today,
                    )
                )
        else:
            if inst.bank_confirmed_on is None:
                inst.bank_confirmed_on = today
            inst.last_confirmed_on = today
            if inst.conflict_since and not inst.conflict_resolved_on:
                inst.conflict_resolved_on = today
    db.add(
        Event(
            entity_type="instrument",
            entity_id=inst.id,
            type="bank.discharged"
            if req.kind == "discharge"
            else (
                "bank.mismatch" if conflicts else ("bank.confirmed" if valid else "bank.invalid")
            ),
            payload={"bank": bank.name, "signature_valid": valid, "conflicts": conflicts},
            occurred_on=today,
        )
    )
    await audit.append(
        db,
        actor_id=None,
        actor_label=actor_label,
        action="bank.response_received",
        entity_type="instrument",
        entity_id=inst.id,
        data={"request_id": req.id, "signature_valid": valid, "conflicts": conflicts},
    )
    await psvc.bump_data_version(db)
    return Outcome(req, msg, conflicts, True)
