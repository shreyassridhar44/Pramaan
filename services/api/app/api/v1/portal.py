"""Institution portal: home, demand status and submission of a new instrument."""

from datetime import date, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.api.deps import DbSession, Principal, require_roles
from app.domain.asof import state_on
from app.domain.provenance import normalise, rupees
from app.domain.rules.deadlines import furnishing_status, slab_date
from app.domain.types import FieldName, Role, Status
from app.models import (
    Analysis,
    Bank,
    Demand,
    Document,
    Event,
    FieldObservation,
    Institution,
    Instrument,
    Signal,
)
from app.services import audit
from app.services import portfolio as psvc
from app.services.facts import load_rules

router = APIRouter(prefix="/portal", tags=["portal"])
Institutional = Annotated[Principal, Depends(require_roles(Role.INSTITUTION_USER))]


class Slab(BaseModel):
    until: str
    penalty_percent: int


class DemandCard(BaseModel):
    id: int
    reason: str
    amount_paise: str
    intimated_on: str
    due_on: str
    days_left: int
    furnished_on: str | None
    status: str
    explanation: str
    slabs: list[Slab]
    lines: list[dict[str, Any]]
    aph_ref: str


class PortalInstrument(BaseModel):
    id: int
    number: str
    bank: str
    amount_paise: str
    maturity_date: str
    days_to_maturity: int
    status: str
    assurance: int
    next_step: str


class PortalHome(BaseModel):
    institution_id: int
    institution: str
    trust_name: str
    aicte_id: str
    demands: list[DemandCard]
    instruments: list[PortalInstrument]
    tasks: list[str]


_NEXT = {
    "submitted": "Waiting for scrutiny by the Regulation Bureau",
    "under_scrutiny": "Under scrutiny",
    "returned": "Returned: correct and resubmit",
    "discrepancy": "A value differs from the bank's record. AICTE will contact you.",
    "active": "No action needed",
    "maturing": "Plan renewal or apply for release before maturity",
    "matured": "Matured: apply for release or renew",
    "release_requested": "Release application under clearance",
    "release_cleared": "Cleared: awaiting the bank's lien discharge",
    "lien_hold": "On hold by AICTE",
}


@router.get("/home", response_model=PortalHome)
async def home(principal: Institutional, db: DbSession) -> PortalHome:
    inst = await db.get(Institution, principal.user.institution_id)
    if inst is None:
        raise HTTPException(404, "Institution not found.")
    today = date.today()
    rules = await load_rules(db)
    demands = (
        await db.scalars(
            select(Demand)
            .where(Demand.institution_id == inst.id)
            .order_by(Demand.intimated_on.desc())
        )
    ).all()
    cards = []
    tasks = []
    for d in demands:
        fs = furnishing_status(
            d.intimated_on, d.furnished_on, today, d.amount_paise, rules.deadline
        )
        cards.append(
            DemandCard(
                id=d.id,
                reason=d.reason,
                amount_paise=str(d.amount_paise),
                intimated_on=d.intimated_on.isoformat(),
                due_on=fs.due_on.isoformat(),
                days_left=fs.days_left,
                furnished_on=d.furnished_on.isoformat() if d.furnished_on else None,
                status=d.status,
                explanation=fs.explanation,
                slabs=[
                    Slab(
                        until=slab_date(fs.due_on, m, dd).isoformat(),
                        penalty_percent=round(p * 100),
                    )
                    for (m, dd), p in rules.deadline.slabs
                ],
                lines=d.lines,
                aph_ref=rules.demand.ref.aph_ref,
            )
        )
        if d.status == "open":
            tasks.append(
                f"Furnish the security deposit of {rupees(d.amount_paise // 100)}"
                f" by {fs.due_on:%d %b %Y}"
            )
    scope = await psvc.scope_for(db, principal.user)
    facts, _ = await psvc.scoped_facts(db, scope)
    rows = (
        (
            await db.scalars(
                select(Instrument)
                .where(Instrument.institution_id == inst.id)
                .order_by(Instrument.maturity_date)
            )
        )
        .unique()
        .all()
    )
    by_id = {f.id: f for f in facts}
    items = []
    for i in rows:
        f = by_id.get(i.id)
        st = state_on(f, today, rules) if f else None
        if st is None or st.status in (Status.RELEASED, Status.RENEWED):
            continue
        items.append(
            PortalInstrument(
                id=i.id,
                number=i.number,
                bank=i.bank.name,
                amount_paise=str(i.amount_paise),
                maturity_date=i.maturity_date.isoformat(),
                days_to_maturity=st.days_to_maturity,
                status=st.status.value,
                assurance=st.assurance.value,
                next_step=_NEXT.get(st.status.value, ""),
            )
        )
        if st.status == Status.MATURING:
            tasks.append(
                f"Instrument {i.number} matures in {st.days_to_maturity} days:"
                " plan renewal or release"
            )
    return PortalHome(
        institution_id=inst.id,
        institution=inst.name,
        trust_name=inst.trust_name,
        aicte_id=inst.aicte_id,
        demands=cards,
        instruments=items,
        tasks=tasks,
    )


class Declared(BaseModel):
    kind: str = "joint_fdr"
    bank_code: str
    branch: str = Field(min_length=2, max_length=120)
    ifsc: str
    number: str = Field(min_length=6, max_length=40)
    amount_rupees: int = Field(gt=0)
    issue_date: date
    maturity_date: date
    holders: str = Field(min_length=3, max_length=400)
    lien: bool = True


class Submission(BaseModel):
    demand_id: int
    declared: Declared
    fdr_document_id: int
    affidavit_document_id: int
    declaration_accepted: bool


class SubmissionResult(BaseModel):
    instrument_id: int
    status: str
    signals: int


@router.post("/submissions", response_model=SubmissionResult)
async def submit(body: Submission, principal: Institutional, db: DbSession) -> SubmissionResult:
    if not body.declaration_accepted:
        raise HTTPException(422, "Accept the declaration to submit.")
    inst_id = principal.user.institution_id
    demand = await db.get(Demand, body.demand_id)
    if demand is None or demand.institution_id != inst_id:
        raise HTTPException(404, "Demand not found.")
    if demand.status != "open":
        raise HTTPException(409, "This demand has already been furnished.")
    d = body.declared
    if d.maturity_date <= d.issue_date:
        raise HTTPException(422, "The maturity date must be after the issue date.")
    bank = await db.scalar(select(Bank).where(Bank.code == d.bank_code))
    if bank is None:
        raise HTTPException(422, "Unknown bank.")
    number = normalise(FieldName.NUMBER, d.number)
    if await db.scalar(
        select(Instrument.id).where(Instrument.bank_id == bank.id, Instrument.number == number)
    ):
        raise HTTPException(
            409, "This instrument number is already registered with Pramaan for this bank."
        )
    docs = {}
    for key, doc_id, kind in (
        ("fdr", body.fdr_document_id, "fdr_scan"),
        ("aff", body.affidavit_document_id, "affidavit_3"),
    ):
        doc = await db.get(Document, doc_id)
        if (
            doc is None
            or doc.uploaded_by != principal.user.id
            or doc.entity_type != "pending"
            or doc.kind != kind
        ):
            raise HTTPException(422, "Upload the receipt and Affidavit 3 before submitting.")
        docs[key] = doc
    analysis = await db.scalar(select(Analysis).where(Analysis.document_id == docs["fdr"].id))
    checks = (analysis.forensics or {}).get("checks", []) if analysis else []
    extracted = (analysis.extraction or {}).get("fields", []) if analysis else []

    today = date.today()
    has_high = any(c["severity"] == "high" for c in checks)
    mismatch = any(c["code"] == "declared_mismatch" for c in checks)
    inst = Instrument(
        number=number,
        kind=d.kind,
        institution_id=inst_id,
        demand_id=demand.id,
        bank_id=bank.id,
        branch=d.branch,
        ifsc=d.ifsc.upper(),
        amount_paise=d.amount_rupees * 100,
        issue_date=d.issue_date,
        maturity_date=d.maturity_date,
        tenure_months=(d.maturity_date.year - d.issue_date.year) * 12
        + d.maturity_date.month
        - d.issue_date.month,
        status=Status.SUBMITTED.value,
        submitted_on=today,
        next_action="Scrutinise submission",
        next_action_due=today + timedelta(days=7),
        document_checked_on=None if (has_high or mismatch) else today,
        high_signal_since=today if has_high else None,
    )
    db.add(inst)
    await db.flush()
    declared_raw = {
        FieldName.NUMBER: d.number,
        FieldName.BANK: bank.name,
        FieldName.IFSC: d.ifsc,
        FieldName.AMOUNT: str(d.amount_rupees),
        FieldName.ISSUE_DATE: d.issue_date.isoformat(),
        FieldName.MATURITY_DATE: d.maturity_date.isoformat(),
        FieldName.HOLDERS: d.holders,
        FieldName.LIEN: "yes" if d.lien else "no",
    }
    for fld, raw in declared_raw.items():
        db.add(
            FieldObservation(
                instrument_id=inst.id,
                field=fld.value,
                source="declared",
                value_raw=raw,
                value_norm=normalise(fld, raw),
                evidence_type="user",
                actor_id=principal.user.id,
                observed_on=today,
            )
        )
    for f in extracted:
        if f["field"] in {x.value for x in FieldName} and f.get("norm"):
            db.add(
                FieldObservation(
                    instrument_id=inst.id,
                    field=f["field"],
                    source="extracted",
                    value_raw=f["value"],
                    value_norm=f["norm"],
                    confidence=f["confidence"],
                    evidence_type="document",
                    evidence_id=docs["fdr"].id,
                    observed_on=today,
                )
            )
    for doc in docs.values():
        doc.entity_type, doc.entity_id = "instrument", inst.id
    if d.amount_rupees * 100 < demand.amount_paise:
        checks.append(
            {
                "code": "shortfall",
                "severity": "high",
                "title": "Amount is less than the demand",
                "detail": f"Demand {rupees(demand.amount_paise // 100)},"
                f" instrument {rupees(d.amount_rupees)}.",
                "field": "amount",
                "evidence": {},
            }
        )
    for c in checks:
        db.add(
            Signal(
                entity_type="instrument",
                entity_id=inst.id,
                code=c["code"],
                severity=c["severity"],
                title=c["title"],
                evidence={
                    **c.get("evidence", {}),
                    "detail": c["detail"],
                    "field": c.get("field"),
                    "document_id": docs["fdr"].id,
                },
                source="document.checks",
                source_version=(analysis.model_versions or {}).get("forensics", "1")
                if analysis
                else "1",
                status="open",
                raised_on=today,
            )
        )
    demand.status, demand.furnished_on = "furnished", today
    db.add(
        Event(
            entity_type="instrument",
            entity_id=inst.id,
            type="instrument.submitted",
            payload={"institution": (await db.get(Institution, inst_id)).name},  # type: ignore[union-attr]
            actor_id=principal.user.id,
            occurred_on=today,
        )
    )
    if inst.document_checked_on:
        db.add(
            Event(
                entity_type="instrument",
                entity_id=inst.id,
                type="instrument.document_checked",
                payload={},
                occurred_on=today,
            )
        )
    await audit.append(
        db,
        actor_id=principal.user.id,
        actor_label=principal.label,
        action="instrument.submitted",
        entity_type="instrument",
        entity_id=inst.id,
        data={"demand_id": demand.id, "signals": len(checks)},
    )
    await psvc.bump_data_version(db)
    await db.commit()
    return SubmissionResult(instrument_id=inst.id, status=inst.status, signals=len(checks))
