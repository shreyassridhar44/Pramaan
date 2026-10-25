from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from app.api.deps import CurrentPrincipal, DbSession, Principal, instrument_scope, require_roles
from app.domain.types import Role
from app.models import Bank, BankMessage, BankRequest, Institution, Instrument, User
from app.services import bank as svc

router = APIRouter(tags=["bank"])
Officer = Annotated[
    Principal,
    Depends(require_roles(Role.BUREAU_OFFICER, Role.REGIONAL_OFFICER, Role.SECTION_HEAD)),
]
BankOfficer = Annotated[Principal, Depends(require_roles(Role.BANK_OFFICER))]


class MessageOut(BaseModel):
    id: int
    received_on: str
    received_at: str
    signature_valid: bool
    key_id: str
    signature: str
    payload: dict[str, Any]


class RequestOut(BaseModel):
    id: int
    kind: str
    adapter: str
    status: str
    requested_on: str
    requested_by: str | None
    bank: str
    bank_code: str
    simulated: bool
    messages: list[MessageOut]


class RequestResult(BaseModel):
    request: RequestOut
    answered: bool
    conflicts: list[str]


async def _request_out(db: DbSession, req: BankRequest) -> RequestOut:
    bank = await db.get(Bank, req.bank_id)
    assert bank is not None
    user = await db.get(User, req.requested_by) if req.requested_by else None
    msgs = (
        await db.scalars(
            select(BankMessage).where(BankMessage.request_id == req.id).order_by(BankMessage.id)
        )
    ).all()
    return RequestOut(
        id=req.id,
        kind=req.kind,
        adapter=req.adapter,
        status=req.status,
        requested_on=req.requested_on.isoformat(),
        requested_by=user.name if user else None,
        bank=bank.name,
        bank_code=bank.code,
        simulated=bank.is_simulated,
        messages=[
            MessageOut(
                id=m.id,
                received_on=m.received_on.isoformat(),
                received_at=m.received_at.isoformat(),
                signature_valid=m.signature_valid,
                key_id=m.key_id,
                signature=m.signature_b64,
                payload=m.payload,
            )
            for m in msgs
        ],
    )


async def _instrument(db: DbSession, principal: Principal, instrument_id: int) -> Instrument:
    inst = await db.scalar(
        select(Instrument)
        .join(Institution, Institution.id == Instrument.institution_id)
        .where(Instrument.id == instrument_id, instrument_scope(principal))
    )
    if inst is None:
        raise HTTPException(404, "Instrument not found.")
    return inst


@router.get("/instruments/{instrument_id}/bank", response_model=list[RequestOut])
async def instrument_bank(
    instrument_id: int, principal: CurrentPrincipal, db: DbSession
) -> list[RequestOut]:
    if principal.role == Role.CELL_OFFICER:
        raise HTTPException(403, "Your role does not have access to this.")
    inst = await _instrument(db, principal, instrument_id)
    reqs = (
        await db.scalars(
            select(BankRequest)
            .where(BankRequest.instrument_id == inst.id)
            .order_by(BankRequest.id.desc())
        )
    ).all()
    return [await _request_out(db, r) for r in reqs]


class NewRequest(BaseModel):
    kind: Literal["confirm", "reconfirm"] = "confirm"


@router.post("/instruments/{instrument_id}/bank/request", response_model=RequestResult)
async def request_confirmation(
    instrument_id: int, body: NewRequest, principal: Officer, db: DbSession
) -> RequestResult:
    inst = await _instrument(db, principal, instrument_id)
    pending = await db.scalar(
        select(BankRequest.id).where(
            BankRequest.instrument_id == inst.id, BankRequest.status == "sent"
        )
    )
    if pending:
        raise HTTPException(409, "A request to the bank is already waiting for an answer.")
    outcome = await svc.create_request(db, inst, body.kind, principal.user.id, principal.label)
    await db.commit()
    return RequestResult(
        request=await _request_out(db, outcome.request),
        answered=outcome.answered,
        conflicts=outcome.conflicts,
    )


class DeskItem(BaseModel):
    id: int
    kind: str
    requested_on: str
    number: str
    institution: str
    amount_paise: str
    status: str


class FieldCompare(BaseModel):
    field: str
    label: str
    requested: str | None
    bank_record: str | None
    match: bool


class DeskDetail(BaseModel):
    item: DeskItem
    bank: str
    key_id: str
    record_found: bool
    comparison: list[FieldCompare]
    history: list[MessageOut]


@router.get("/bank/requests", response_model=list[DeskItem])
async def desk_inbox(principal: BankOfficer, db: DbSession, status: str = "sent") -> list[DeskItem]:
    rows = (
        await db.execute(
            select(BankRequest, Instrument.number, Institution.name, Instrument.amount_paise)
            .join(Instrument, Instrument.id == BankRequest.instrument_id)
            .join(Institution, Institution.id == Instrument.institution_id)
            .where(BankRequest.bank_id == principal.user.bank_id, BankRequest.status == status)
            .order_by(BankRequest.id.desc())
            .limit(200)
        )
    ).all()
    return [
        DeskItem(
            id=r.id,
            kind=r.kind,
            requested_on=r.requested_on.isoformat(),
            number=n,
            institution=i,
            amount_paise=str(a),
            status=r.status,
        )
        for r, n, i, a in rows
    ]


async def _desk_request(db: DbSession, principal: Principal, request_id: int) -> BankRequest:
    req = await db.get(BankRequest, request_id)
    if req is None or req.bank_id != principal.user.bank_id:
        raise HTTPException(404, "Request not found.")
    return req


@router.get("/bank/requests/{request_id}", response_model=DeskDetail)
async def desk_detail(request_id: int, principal: BankOfficer, db: DbSession) -> DeskDetail:
    req = await _desk_request(db, principal, request_id)
    inst = await db.get(Instrument, req.instrument_id)
    bank = await db.get(Bank, req.bank_id)
    assert inst is not None
    assert bank is not None
    record = await svc.find_record(db, bank.id, inst.number)
    p = req.payload
    rows = [
        ("number", "Deposit number", p.get("number"), record.number if record else None),
        ("ifsc", "IFSC", p.get("ifsc"), record.ifsc if record else None),
        (
            "amount",
            "Amount (Rs)",
            str(int(p.get("amount_paise", 0)) // 100),
            str(record.amount_paise // 100) if record else None,
        ),
        (
            "issue_date",
            "Issue date",
            p.get("issue_date"),
            record.issue_date.isoformat() if record else None,
        ),
        (
            "maturity_date",
            "Maturity date",
            p.get("maturity_date"),
            record.maturity_date.isoformat() if record else None,
        ),
        (
            "lien",
            "Lien in favour of AICTE",
            "yes",
            ("yes" if record.lien_aicte else "no") if record else None,
        ),
    ]
    out = await _request_out(db, req)
    return DeskDetail(
        item=DeskItem(
            id=req.id,
            kind=req.kind,
            requested_on=req.requested_on.isoformat(),
            number=inst.number,
            institution=(await db.get(Institution, inst.institution_id)).name,  # type: ignore[union-attr]
            amount_paise=str(inst.amount_paise),
            status=req.status,
        ),
        bank=bank.name,
        key_id=bank.key_id,
        record_found=record is not None,
        comparison=[
            FieldCompare(field=f, label=label, requested=a, bank_record=b, match=a == b)
            for f, label, a, b in rows
        ],
        history=out.messages,
    )


class DeskResponse(BaseModel):
    action: Literal["confirm", "discharge"]


@router.post("/bank/requests/{request_id}/respond", response_model=RequestResult)
async def desk_respond(
    request_id: int, body: DeskResponse, principal: BankOfficer, db: DbSession
) -> RequestResult:
    """The bank officer answers from the bank's own record. The message is signed with the bank's
    key, then verified by Pramaan exactly like an automatic response."""
    req = await _desk_request(db, principal, request_id)
    if req.status != "sent":
        raise HTTPException(409, "This request has already been answered.")
    if (body.action == "discharge") != (req.kind == "discharge"):
        raise HTTPException(422, "This action does not match the request.")
    inst = await db.get(Instrument, req.instrument_id)
    bank = await db.get(Bank, req.bank_id)
    assert inst is not None
    assert bank is not None
    record = await svc.find_record(db, bank.id, inst.number)
    payload = svc.response_payload(req, bank, record, {"answered_by": principal.user.name})
    signature = svc.sign(await svc.private_key(db, bank.id), payload)
    outcome = await svc.receive(
        db,
        req,
        bank,
        payload,
        signature,
        bank.key_id,
        actor_label=f"{principal.user.name}, {bank.name} (simulated)",
    )
    await db.commit()
    return RequestResult(
        request=await _request_out(db, req), answered=True, conflicts=outcome.conflicts
    )


class BankKey(BaseModel):
    bank_code: str
    bank: str
    key_id: str
    algorithm: str
    public_key: str
    simulated: bool


@router.get("/public/bank-keys", response_model=list[BankKey])
async def bank_keys(db: DbSession) -> list[BankKey]:
    """Public keys used to verify bank messages. Published so anyone can check a signature."""
    banks = (await db.scalars(select(Bank).order_by(Bank.code))).all()
    return [
        BankKey(
            bank_code=b.code,
            bank=b.name,
            key_id=b.key_id,
            algorithm="Ed25519",
            public_key=b.public_key_b64,
            simulated=b.is_simulated,
        )
        for b in banks
    ]
