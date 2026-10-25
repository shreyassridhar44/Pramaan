"""Release of security deposits (R8, APH 2024-27 Clause 6.46): applications, clearances by PGRC,
Vigilance and Grants, authorisation by the competent authority and discharge by the bank."""

from collections import defaultdict
from datetime import date
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from app.api.deps import DbSession, Principal, institution_scope, require_roles
from app.domain.asof import state_on
from app.domain.rules.release import CELL_LABELS, DOC_LABELS, Eligibility, evaluate_release
from app.domain.types import Role, Status
from app.models import (
    BankRequest,
    Clearance,
    Complaint,
    Document,
    Event,
    Institution,
    Instrument,
    Letter,
    ReleaseCase,
    ReleaseCaseInstrument,
    User,
)
from app.services import audit, letters
from app.services import bank as bank_svc
from app.services import portfolio as psvc
from app.services import release as svc
from app.services.facts import load_rules

router = APIRouter(tags=["releases"])

Viewer = Annotated[
    Principal,
    Depends(
        require_roles(
            Role.BUREAU_OFFICER,
            Role.REGIONAL_OFFICER,
            Role.SECTION_HEAD,
            Role.CELL_OFFICER,
            Role.APPROVING_AUTHORITY,
            Role.AUDITOR,
            Role.ADMIN,
        )
    ),
]
CellOfficer = Annotated[Principal, Depends(require_roles(Role.CELL_OFFICER))]
Authority = Annotated[Principal, Depends(require_roles(Role.APPROVING_AUTHORITY))]
Institutional = Annotated[Principal, Depends(require_roles(Role.INSTITUTION_USER))]


# Shapes


class CheckOut(BaseModel):
    code: str
    label: str
    state: str
    detail: str
    aph_ref: str


class ClearanceOut(BaseModel):
    cell: str
    label: str
    status: str
    officer: str | None
    reason: str | None
    decided_on: str | None


class ReleaseRow(BaseModel):
    id: int
    reference: str
    institution_id: int
    institution: str
    region: str
    kind: str
    amount_paise: str
    instruments: int
    applied_on: str
    days_open: int
    status: str
    clearances: dict[str, str]
    checks_passed: int
    checks_total: int
    blocked: bool
    ready: bool


class InstrumentLine(BaseModel):
    id: int
    number: str
    kind: str
    bank: str
    branch: str
    amount_paise: str
    maturity_date: str
    status: str
    released_on: str | None
    discharge_status: str | None
    discharge_adapter: str | None


class DocumentLine(BaseModel):
    kind: str
    label: str
    submitted: bool
    document_id: int | None
    filename: str | None


class ComplaintOut(BaseModel):
    id: int
    reference: str
    category: str
    opened_on: str
    status: str


class LetterRef(BaseModel):
    id: int
    kind: str
    reference: str
    status: str
    issued_on: str
    verify_url: str


class EventOut(BaseModel):
    type: str
    occurred_on: str
    actor: str | None
    detail: str | None


class ReleaseDetail(BaseModel):
    row: ReleaseRow
    trust: str
    aicte_id: str
    city: str
    authority: str
    checks: list[CheckOut]
    clearance_lanes: list[ClearanceOut]
    instruments_detail: list[InstrumentLine]
    documents: list[DocumentLine]
    complaints: list[ComplaintOut]
    penalty_due_paise: str
    penalty: dict[str, Any]
    can_settle_penalty: bool
    letters: list[LetterRef]
    events: list[EventOut]
    can_authorise: bool
    my_cell: str | None


# Helpers


def _checks(e: Eligibility) -> list[CheckOut]:
    return [
        CheckOut(
            code=c.code, label=c.label, state=c.state.value, detail=c.detail, aph_ref=c.aph_ref
        )
        for c in e.checks
    ]


def _row(b: svc.CaseBundle, e: Eligibility, today: date) -> ReleaseRow:
    passed = sum(1 for c in e.checks if c.state.value == "pass")
    return ReleaseRow(
        id=b.case.id,
        reference=b.case.reference,
        institution_id=b.institution.id,
        institution=b.institution.name,
        region=b.institution.region.name,
        kind=b.case.kind,
        amount_paise=str(sum(i.amount_paise for i in b.instruments)),
        instruments=len(b.instruments),
        applied_on=b.case.applied_on.isoformat(),
        days_open=((b.case.closed_on or today) - b.case.applied_on).days,
        status=b.case.status,
        clearances={c.cell: c.status for c in b.clearances},
        checks_passed=passed,
        checks_total=len(e.checks),
        blocked=e.blocked,
        ready=e.ready_for_authorisation and b.case.status in ("cleared", "in_clearance"),
    )


async def _bundles(db: DbSession, principal: Principal, *where: object) -> list[svc.CaseBundle]:
    """All visible cases with their instruments and clearances, in three queries."""
    cases = (
        (
            await db.scalars(
                select(ReleaseCase)
                .join(Institution, Institution.id == ReleaseCase.institution_id)
                .where(institution_scope(principal), *where)  # type: ignore[arg-type]
                .order_by(ReleaseCase.applied_on.desc())
            )
        )
        .unique()
        .all()
    )
    if not cases:
        return []
    ids = [c.id for c in cases]
    links = (
        await db.execute(
            select(ReleaseCaseInstrument.release_case_id, Instrument)
            .join(Instrument, Instrument.id == ReleaseCaseInstrument.instrument_id)
            .where(ReleaseCaseInstrument.release_case_id.in_(ids))
        )
    ).all()
    by_case: dict[int, list[Instrument]] = defaultdict(list)
    for cid, inst in links:
        by_case[cid].append(inst)
    clear: dict[int, list[Clearance]] = defaultdict(list)
    for c in (
        await db.scalars(
            select(Clearance).where(Clearance.release_case_id.in_(ids)).order_by(Clearance.id)
        )
    ).all():
        clear[c.release_case_id].append(c)
    insts = {
        i.id: i
        for i in (
            await db.scalars(
                select(Institution).where(Institution.id.in_({c.institution_id for c in cases}))
            )
        )
        .unique()
        .all()
    }
    return [
        svc.CaseBundle(c, insts[c.institution_id], by_case[c.id], clear[c.id])
        for c in cases
        if by_case[c.id]
    ]


async def _complaint_counts(db: DbSession, institution_ids: set[int]) -> dict[int, int]:
    rows = (
        await db.execute(
            select(Complaint.institution_id, func.count())
            .where(
                Complaint.institution_id.in_(institution_ids),
                Complaint.status == "open",
                Complaint.cell == "pgrc",
            )
            .group_by(Complaint.institution_id)
        )
    ).all()
    return {i: n for i, n in rows}


async def _rows(db: DbSession, bundles: list[svc.CaseBundle]) -> list[ReleaseRow]:
    today = date.today()
    rules = await load_rules(db)
    counts = await _complaint_counts(db, {b.institution.id for b in bundles})
    return [
        _row(
            b,
            evaluate_release(svc.context(b, today, counts.get(b.institution.id, 0)), rules.release),
            today,
        )
        for b in bundles
    ]


async def _visible_case(db: DbSession, principal: Principal, case_id: int) -> svc.CaseBundle:
    found = await _bundles(db, principal, ReleaseCase.id == case_id)
    if not found:
        raise HTTPException(404, "Release case not found.")
    return found[0]


async def _detail(db: DbSession, principal: Principal, b: svc.CaseBundle) -> ReleaseDetail:
    today = date.today()
    e = await svc.eligibility(db, b, today)
    users = {
        u.id: u
        for u in (
            await db.scalars(
                select(User).where(
                    User.id.in_(
                        {c.officer_id for c in b.clearances if c.officer_id}
                        | {b.case.authorised_by or 0}
                    )
                )
            )
        ).all()
    }
    requests = {
        r.instrument_id: r
        for r in (
            await db.scalars(
                select(BankRequest)
                .where(
                    BankRequest.instrument_id.in_([i.id for i in b.instruments]),
                    BankRequest.kind == "discharge",
                )
                .order_by(BankRequest.id)
            )
        ).all()
    }
    docs = (
        await db.scalars(
            select(Document).where(
                Document.entity_type == "release_case", Document.entity_id == b.case.id
            )
        )
    ).all()
    doc_by_kind = {d.kind: d for d in docs}
    rules = await load_rules(db)
    letters_rows = (
        await db.scalars(
            select(Letter)
            .where(Letter.entity_type == "release_case", Letter.entity_id == b.case.id)
            .order_by(Letter.id.desc())
        )
    ).all()
    events = (
        await db.execute(
            select(Event, User.name)
            .outerjoin(User, User.id == Event.actor_id)
            .where(Event.entity_type == "release_case", Event.entity_id == b.case.id)
            .order_by(Event.occurred_on, Event.id)
        )
    ).all()
    complaints = (
        await db.scalars(
            select(Complaint)
            .where(Complaint.institution_id == b.institution.id, Complaint.cell == "pgrc")
            .order_by(Complaint.status.desc(), Complaint.opened_on.desc())
            .limit(10)
        )
    ).all()
    u = principal.user
    my_cell = (
        u.cell
        if principal.role == Role.CELL_OFFICER and any(c.cell == u.cell for c in b.clearances)
        else None
    )
    penalty = b.case.penalty or {}
    return ReleaseDetail(
        row=_row(b, e, today),
        trust=b.institution.trust_name,
        aicte_id=b.institution.aicte_id,
        city=f"{b.institution.city}, {b.institution.state}",
        authority=e.authority,
        checks=_checks(e),
        clearance_lanes=[
            ClearanceOut(
                cell=c.cell,
                label=CELL_LABELS.get(c.cell, c.cell),
                status=c.status,
                officer=users[c.officer_id].name if c.officer_id in users else None,
                reason=c.reason,
                decided_on=c.decided_on.isoformat() if c.decided_on else None,
            )
            for c in b.clearances
        ],
        instruments_detail=[
            InstrumentLine(
                id=i.id,
                number=i.number,
                kind=i.kind,
                bank=i.bank.name,
                branch=i.branch,
                amount_paise=str(i.amount_paise),
                maturity_date=i.maturity_date.isoformat(),
                status=i.status,
                released_on=i.released_on.isoformat() if i.released_on else None,
                discharge_status=requests[i.id].status if i.id in requests else None,
                discharge_adapter=requests[i.id].adapter if i.id in requests else None,
            )
            for i in b.instruments
        ],
        documents=[
            DocumentLine(
                kind=k,
                label=DOC_LABELS[k],
                submitted=k in b.case.documents,
                document_id=doc_by_kind[k].id if k in doc_by_kind else None,
                filename=doc_by_kind[k].filename if k in doc_by_kind else None,
            )
            for k in rules.release.required_documents
        ],
        complaints=[
            ComplaintOut(
                id=c.id,
                reference=c.reference,
                category=c.category,
                opened_on=c.opened_on.isoformat(),
                status=c.status,
            )
            for c in complaints
        ],
        penalty_due_paise=str(0 if penalty.get("settled_on") else penalty.get("due_paise", 0)),
        penalty=penalty,
        can_settle_penalty=principal.role in (Role.SECTION_HEAD, Role.APPROVING_AUTHORITY)
        and bool(penalty.get("due_paise"))
        and not penalty.get("settled_on"),
        letters=[_letter_ref(lt) for lt in letters_rows],
        events=[
            EventOut(
                type=ev.type,
                occurred_on=ev.occurred_on.isoformat(),
                actor=name,
                detail=(ev.payload or {}).get("reason") or (ev.payload or {}).get("letter"),
            )
            for ev, name in events
        ],
        can_authorise=principal.role == Role.APPROVING_AUTHORITY
        and e.ready_for_authorisation
        and b.case.status in ("cleared", "in_clearance"),
        my_cell=my_cell,
    )


def _letter_ref(lt: Letter) -> LetterRef:
    return LetterRef(
        id=lt.id,
        kind=lt.kind,
        reference=lt.reference,
        status=lt.status,
        issued_on=lt.issued_on.isoformat(),
        verify_url=letters.verify_url(letters.make_token(lt.token_id)),
    )


# Officer views


OPEN_STATES = ("applied", "in_clearance", "blocked", "cleared", "authorised")


@router.get("/releases", response_model=list[ReleaseRow])
async def list_releases(
    principal: Viewer, db: DbSession, state: Literal["open", "closed", "all"] = "open"
) -> list[ReleaseRow]:
    where = {
        "open": [ReleaseCase.status.in_(OPEN_STATES)],
        "closed": [ReleaseCase.status.not_in(OPEN_STATES)],
        "all": [],
    }[state]
    return await _rows(db, await _bundles(db, principal, *where))


@router.get("/releases/{case_id}", response_model=ReleaseDetail)
async def release_detail(case_id: int, principal: Viewer, db: DbSession) -> ReleaseDetail:
    return await _detail(db, principal, await _visible_case(db, principal, case_id))


class ClearanceBody(BaseModel):
    decision: Literal["clear", "block"]
    reason: str = Field(min_length=3, max_length=2000)


@router.post("/releases/{case_id}/clearances/{cell}", response_model=ReleaseDetail)
async def decide(
    case_id: int, cell: str, body: ClearanceBody, principal: CellOfficer, db: DbSession
) -> ReleaseDetail:
    if principal.user.cell != cell:
        raise HTTPException(403, "Only your own cell can decide this clearance.")
    b = await _visible_case(db, principal, case_id)
    if b.case.status not in ("in_clearance", "blocked", "cleared"):
        raise HTTPException(409, "This case is no longer collecting clearances.")
    if (
        body.decision == "clear"
        and cell == "pgrc"
        and await svc.open_complaints(db, b.institution.id)
    ):
        raise HTTPException(409, "Resolve the open complaints before clearing.")
    await svc.decide_clearance(
        db, b, cell, body.decision, body.reason.strip(), principal.user, date.today()
    )
    await db.commit()
    return await _detail(db, principal, await _visible_case(db, principal, case_id))


class ResolveBody(BaseModel):
    note: str = Field(min_length=3, max_length=2000)


@router.post("/complaints/{complaint_id}/resolve", status_code=204)
async def resolve_complaint(
    complaint_id: int, body: ResolveBody, principal: CellOfficer, db: DbSession
) -> None:
    c = await db.get(Complaint, complaint_id)
    if c is None or c.cell != principal.user.cell:
        raise HTTPException(404, "Complaint not found.")
    if c.status != "open":
        raise HTTPException(409, "This complaint is already closed.")
    c.status, c.closed_on = "closed", date.today()
    await audit.append(
        db,
        actor_id=principal.user.id,
        actor_label=principal.label,
        action="complaint.resolved",
        entity_type="institution",
        entity_id=c.institution_id,
        data={"complaint": c.reference},
        note=body.note,
    )
    await db.commit()


class AuthoriseBody(BaseModel):
    note: str | None = Field(default=None, max_length=2000)


class AuthoriseResult(BaseModel):
    detail: ReleaseDetail
    letter: LetterRef
    discharged: int
    awaiting_bank: int


@router.post("/releases/{case_id}/authorise", response_model=AuthoriseResult)
async def authorise(
    case_id: int, body: AuthoriseBody, principal: Authority, db: DbSession
) -> AuthoriseResult:
    b = await _visible_case(db, principal, case_id)
    if b.case.status not in ("cleared", "in_clearance"):
        raise HTTPException(409, "This case cannot be authorised in its current state.")
    today = date.today()
    e = await svc.eligibility(db, b, today)
    if not e.ready_for_authorisation:
        open_items = [c.label for c in e.checks if c.state.value != "pass"]
        raise HTTPException(409, "Not every condition is met: " + ", ".join(open_items) + ".")
    letter, outcomes = await svc.authorise(
        db, b, e, principal.user, principal.label, body.note, today
    )
    await db.commit()
    detail = await _detail(db, principal, await _visible_case(db, principal, case_id))
    return AuthoriseResult(
        detail=detail,
        letter=_letter_ref(letter),
        discharged=sum(1 for o in outcomes if o.answered),
        awaiting_bank=sum(1 for o in outcomes if not o.answered),
    )


DischargeSender = Annotated[
    Principal,
    Depends(
        require_roles(
            Role.BUREAU_OFFICER,
            Role.REGIONAL_OFFICER,
            Role.SECTION_HEAD,
            Role.APPROVING_AUTHORITY,
        )
    ),
]


@router.post("/releases/{case_id}/discharge", response_model=ReleaseDetail)
async def request_discharge(
    case_id: int, principal: DischargeSender, db: DbSession
) -> ReleaseDetail:
    """Asks the bank to discharge the lien on any instrument of an authorised case that has no
    discharge request waiting or answered."""
    b = await _visible_case(db, principal, case_id)
    if b.case.status != "authorised":
        raise HTTPException(409, "Only an authorised case can be sent to the bank for discharge.")
    sent = set(
        (
            await db.scalars(
                select(BankRequest.instrument_id).where(
                    BankRequest.instrument_id.in_([i.id for i in b.instruments]),
                    BankRequest.kind == "discharge",
                    BankRequest.status.in_(("sent", "answered")),
                )
            )
        ).all()
    )
    todo = [i for i in b.instruments if i.id not in sent and not i.released_on]
    if not todo:
        raise HTTPException(409, "Every instrument already has a discharge request.")
    for i in todo:
        await bank_svc.create_request(db, i, "discharge", principal.user.id, principal.label)
    await db.commit()
    return await _detail(db, principal, await _visible_case(db, principal, case_id))


class SettleBody(BaseModel):
    reference: str = Field(min_length=3, max_length=120)


Settler = Annotated[Principal, Depends(require_roles(Role.SECTION_HEAD, Role.APPROVING_AUTHORITY))]


@router.post("/releases/{case_id}/penalty/settle", response_model=ReleaseDetail)
async def settle_penalty(
    case_id: int, body: SettleBody, principal: Settler, db: DbSession
) -> ReleaseDetail:
    """Records that the penalty was paid, with the payment reference. The rules engine then
    treats the penalty condition as met."""
    b = await _visible_case(db, principal, case_id)
    penalty = dict(b.case.penalty or {})
    if not penalty.get("due_paise"):
        raise HTTPException(409, "No penalty is due on this case.")
    if penalty.get("settled_on"):
        raise HTTPException(409, "The penalty is already recorded as settled.")
    today = date.today()
    penalty.update(
        settled_on=today.isoformat(),
        reference=body.reference.strip(),
        settled_by=principal.user.name,
    )
    b.case.penalty = penalty
    db.add(
        Event(
            entity_type="release_case",
            entity_id=b.case.id,
            type="release.penalty_settled",
            payload={"reference": body.reference.strip()},
            actor_id=principal.user.id,
            occurred_on=today,
        )
    )
    await audit.append(
        db,
        actor_id=principal.user.id,
        actor_label=principal.label,
        action="release.penalty_settled",
        entity_type="release_case",
        entity_id=b.case.id,
        data={"due_paise": penalty["due_paise"], "reference": body.reference.strip()},
    )
    await db.commit()
    return await _detail(db, principal, await _visible_case(db, principal, case_id))


# Cell queue


class QueueItem(BaseModel):
    row: ReleaseRow
    my_status: str
    open_complaints: int


@router.get("/clearances", response_model=list[QueueItem])
async def cell_queue(
    principal: CellOfficer, db: DbSession, state: Literal["pending", "decided"] = "pending"
) -> list[QueueItem]:
    cell = principal.user.cell
    status_filter = (
        Clearance.status == "pending" if state == "pending" else Clearance.status != "pending"
    )
    ids = select(Clearance.release_case_id).where(Clearance.cell == cell, status_filter)
    bundles = await _bundles(
        db,
        principal,
        ReleaseCase.id.in_(ids),
        ReleaseCase.status.in_(("in_clearance", "blocked", "cleared"))
        if state == "pending"
        else ReleaseCase.id.is_not(None),
    )
    rows = await _rows(db, bundles)
    counts = await _complaint_counts(db, {b.institution.id for b in bundles})
    items = [
        QueueItem(
            row=r,
            my_status=r.clearances.get(cell or "", "pending"),
            open_complaints=counts.get(r.institution_id, 0) if cell == "pgrc" else 0,
        )
        for r in rows
    ]
    # Oldest applications first: they have waited longest for this cell.
    items.sort(key=lambda q: q.row.applied_on, reverse=state != "pending")
    return items[:300]


# Institution portal


class Releasable(BaseModel):
    id: int
    number: str
    kind: str
    bank: str
    amount_paise: str
    maturity_date: str
    status: str
    can_apply: bool
    reason: str | None


class PortalReleases(BaseModel):
    cases: list[ReleaseRow]
    instruments: list[Releasable]
    required_documents: list[DocumentLine]


@router.get("/portal/releases", response_model=PortalReleases)
async def portal_releases(principal: Institutional, db: DbSession) -> PortalReleases:
    today = date.today()
    rules = await load_rules(db)
    cases = await _rows(db, await _bundles(db, principal))
    scope = await psvc.scope_for(db, principal.user)
    facts, _ = await psvc.scoped_facts(db, scope)
    in_case = set(
        (
            await db.scalars(
                select(ReleaseCaseInstrument.instrument_id)
                .join(ReleaseCase, ReleaseCase.id == ReleaseCaseInstrument.release_case_id)
                .where(ReleaseCase.institution_id == principal.user.institution_id)
            )
        ).all()
    )
    items = []
    rows = (
        (
            await db.scalars(
                select(Instrument)
                .where(Instrument.institution_id == principal.user.institution_id)
                .order_by(Instrument.maturity_date)
            )
        )
        .unique()
        .all()
    )
    by_id = {f.id: f for f in facts}
    for i in rows:
        f = by_id.get(i.id)
        st = state_on(f, today, rules) if f else None
        if st is None or st.status in (Status.RELEASED, Status.RENEWED, Status.FORFEITED):
            continue
        held = st.status in (Status.MATURED, Status.RENEWAL_PENDING, Status.ACTIVE, Status.MATURING)
        reason = None
        if i.id in in_case:
            reason = "A release application is already open"
        elif not held:
            reason = "Not available while the deposit is " + st.status.value.replace("_", " ")
        elif i.maturity_date > today:
            reason = f"Completes its term on {i.maturity_date:%d %b %Y}"
        items.append(
            Releasable(
                id=i.id,
                number=i.number,
                kind=i.kind,
                bank=i.bank.name,
                amount_paise=str(i.amount_paise),
                maturity_date=i.maturity_date.isoformat(),
                status=st.status.value,
                can_apply=reason is None,
                reason=reason,
            )
        )
    return PortalReleases(
        cases=cases,
        instruments=items,
        required_documents=[
            DocumentLine(
                kind=k, label=DOC_LABELS[k], submitted=False, document_id=None, filename=None
            )
            for k in rules.release.required_documents
        ],
    )


class ApplyBody(BaseModel):
    instrument_ids: list[int] = Field(min_length=1, max_length=20)
    document_ids: list[int] = Field(default_factory=list, max_length=10)
    declaration_accepted: bool


class Preview(BaseModel):
    checks: list[CheckOut]
    authority: str


async def _own_instruments(db: DbSession, principal: Principal, ids: list[int]) -> list[Instrument]:
    rows = list(
        (
            await db.scalars(
                select(Instrument).where(
                    Instrument.id.in_(ids),
                    Instrument.institution_id == principal.user.institution_id,
                )
            )
        )
        .unique()
        .all()
    )
    if len(rows) != len(set(ids)):
        raise HTTPException(404, "Instrument not found.")
    return rows


async def _own_documents(db: DbSession, principal: Principal, ids: list[int]) -> list[Document]:
    docs = list(
        (
            await db.scalars(
                select(Document).where(
                    Document.id.in_(ids),
                    Document.entity_type == "pending",
                    Document.uploaded_by == principal.user.id,
                )
            )
        ).all()
    )
    if len(docs) != len(set(ids)):
        raise HTTPException(404, "Document not found.")
    return docs


@router.post("/portal/releases/preview", response_model=Preview)
async def preview(body: ApplyBody, principal: Institutional, db: DbSession) -> Preview:
    """Live eligibility hints for the application form, before anything is submitted."""
    instruments = await _own_instruments(db, principal, body.instrument_ids)
    docs = await _own_documents(db, principal, body.document_ids)
    inst = await db.get(Institution, principal.user.institution_id)
    assert inst is not None
    case = ReleaseCase(
        reference="",
        institution_id=inst.id,
        kind=instruments[0].kind,
        status="applied",
        documents=[d.kind for d in docs],
        penalty={},
        applied_on=date.today(),
    )
    b = svc.CaseBundle(case, inst, instruments, [])
    e = await svc.eligibility(db, b, date.today())
    return Preview(checks=_checks(e), authority=e.authority)


class ApplyResult(BaseModel):
    case_id: int
    reference: str


@router.post("/portal/releases", response_model=ApplyResult)
async def apply(body: ApplyBody, principal: Institutional, db: DbSession) -> ApplyResult:
    if not body.declaration_accepted:
        raise HTTPException(422, "Accept the declaration to apply.")
    instruments = await _own_instruments(db, principal, body.instrument_ids)
    today = date.today()
    for i in instruments:
        if i.maturity_date > today:
            raise HTTPException(
                409, f"{i.number} completes its term on {i.maturity_date:%d %b %Y}."
            )
        if i.release_requested_on or i.released_on:
            raise HTTPException(409, f"{i.number} already has a release application.")
    docs = await _own_documents(db, principal, body.document_ids)
    inst = await db.get(Institution, principal.user.institution_id)
    assert inst is not None
    try:
        case = await svc.apply(
            db,
            institution=inst,
            instruments=instruments,
            documents=[d.kind for d in docs],
            actor=principal.user,
            on=today,
        )
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    for d in docs:
        d.entity_type, d.entity_id = "release_case", case.id
    await db.commit()
    return ApplyResult(case_id=case.id, reference=case.reference)


@router.get("/portal/releases/{case_id}", response_model=ReleaseDetail)
async def portal_release_detail(
    case_id: int, principal: Institutional, db: DbSession
) -> ReleaseDetail:
    return await _detail(db, principal, await _visible_case(db, principal, case_id))
