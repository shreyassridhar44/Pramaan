from datetime import date
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, or_, select

from app.api.deps import CurrentPrincipal, DbSession, institution_scope
from app.domain.asof import HELD_STATUSES
from app.domain.rules.demand import ProgrammeLevel, compute_demand
from app.domain.types import Ownership, Premises, Role
from app.models import Complaint, Institution, Instrument, Programme, Region, ReleaseCase
from app.services import portfolio as psvc
from app.services.facts import load_rules

router = APIRouter(prefix="/institutions", tags=["institutions"])


class InstitutionRow(BaseModel):
    id: int
    aicte_id: str
    name: str
    city: str
    state: str
    region: str
    ownership: str
    premises: str
    held_paise: str
    held_count: int
    by_assurance_paise: dict[str, str]
    open_items: int
    flags: dict[str, bool]


class InstitutionPage(BaseModel):
    total: int
    offset: int
    limit: int
    items: list[InstitutionRow]


class ProgrammeOut(BaseModel):
    discipline: str
    level: str
    intake: int
    approved_from: str


class DemandPreviewLine(BaseModel):
    discipline: str
    level: str
    base_paise: str
    multiplier: int
    amount_paise: str
    note: str


class DemandPreview(BaseModel):
    exempt: bool
    exemption_reason: str | None
    total_paise: str
    aph_ref: str
    rule_version: int
    lines: list[DemandPreviewLine]


class ComplaintOut(BaseModel):
    reference: str
    cell: str
    category: str
    status: str
    opened_on: str
    closed_on: str | None


class ReleaseCaseBrief(BaseModel):
    id: int
    reference: str
    status: str
    applied_on: str


class InstitutionDetail(BaseModel):
    id: int
    aicte_id: str
    name: str
    trust_name: str
    city: str
    state: str
    region: str
    region_name: str
    ownership: str
    premises: str
    established_year: int
    flags: dict[str, bool]
    programmes: list[ProgrammeOut]
    demand_preview: DemandPreview
    complaints: list[ComplaintOut]
    release_cases: list[ReleaseCaseBrief]
    held_paise: str
    held_count: int


def _deny_cells(principal: CurrentPrincipal) -> None:
    if principal.role in (Role.CELL_OFFICER, Role.BANK_OFFICER):
        raise HTTPException(403, "Your role does not have access to this.")


@router.get("", response_model=InstitutionPage)
async def list_institutions(
    principal: CurrentPrincipal,
    db: DbSession,
    q: str | None = None,
    region: Annotated[list[str] | None, Query()] = None,
    as_of: date | None = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> InstitutionPage:
    _deny_cells(principal)
    d = as_of or date.today()
    query = (
        select(Institution, Region.code)
        .join(Region, Region.id == Institution.region_id)
        .where(institution_scope(principal))
    )
    if q:
        like = f"%{q.strip()}%"
        query = query.where(
            or_(
                Institution.name.ilike(like),
                Institution.aicte_id.ilike(like),
                Institution.city.ilike(like),
            )
        )
    if region:
        query = query.where(Region.code.in_(region))
    rows = list((await db.execute(query)).all())

    scope = await psvc.scope_for(db, principal.user)
    states = await psvc.states(db, scope, d)
    inst_of = dict((await db.execute(select(Instrument.id, Instrument.institution_id))).all())
    amounts = dict((await db.execute(select(Instrument.id, Instrument.amount_paise))).all())
    agg: dict[int, dict[str, int]] = {}
    for iid, st in states.items():
        if st.status not in HELD_STATUSES:
            continue
        a = agg.setdefault(
            inst_of[iid], {"paise": 0, "count": 0, "open": 0, "a0": 0, "a1": 0, "a2": 0, "a3": 0}
        )
        a["paise"] += amounts[iid]
        a["count"] += 1
        a[f"a{st.assurance.value}"] += amounts[iid]
        if st.status in ("matured", "discrepancy", "submitted", "under_scrutiny"):
            a["open"] += 1

    rows.sort(key=lambda r: (-agg.get(r[0].id, {}).get("paise", 0), r[0].name))
    page = rows[offset : offset + limit]
    items = []
    for inst, region_code in page:
        a = agg.get(
            inst.id, {"paise": 0, "count": 0, "open": 0, "a0": 0, "a1": 0, "a2": 0, "a3": 0}
        )
        items.append(
            InstitutionRow(
                id=inst.id,
                aicte_id=inst.aicte_id,
                name=inst.name,
                city=inst.city,
                state=inst.state,
                region=region_code,
                ownership=inst.ownership,
                premises=inst.premises,
                held_paise=str(a["paise"]),
                held_count=a["count"],
                by_assurance_paise={k: str(a[k]) for k in ("a0", "a1", "a2", "a3")},
                open_items=a["open"],
                flags={k: bool(v) for k, v in inst.flags.items()},
            )
        )
    return InstitutionPage(total=len(rows), offset=offset, limit=limit, items=items)


@router.get("/{institution_id}", response_model=InstitutionDetail)
async def get_institution(
    institution_id: int, principal: CurrentPrincipal, db: DbSession, as_of: date | None = None
) -> InstitutionDetail:
    _deny_cells(principal)
    d = as_of or date.today()
    inst = await db.scalar(
        select(Institution).where(Institution.id == institution_id, institution_scope(principal))
    )
    if inst is None:
        raise HTTPException(404, "Institution not found.")
    programmes = (
        await db.scalars(select(Programme).where(Programme.institution_id == inst.id))
    ).all()
    rules = await load_rules(db)
    preview = compute_demand(
        [ProgrammeLevel(p.discipline, p.level) for p in programmes],  # type: ignore[arg-type]
        Premises(inst.premises),
        Ownership(inst.ownership),
        0,
        True,
        rules.demand,
    )
    complaints = (
        await db.scalars(
            select(Complaint)
            .where(Complaint.institution_id == inst.id)
            .order_by(Complaint.opened_on.desc())
        )
    ).all()
    cases = (
        await db.scalars(
            select(ReleaseCase)
            .where(ReleaseCase.institution_id == inst.id)
            .order_by(ReleaseCase.applied_on.desc())
        )
    ).all()
    scope = await psvc.scope_for(db, principal.user)
    states = await psvc.states(db, scope, d)
    held = (
        await db.execute(
            select(Instrument.id, Instrument.amount_paise).where(
                Instrument.institution_id == inst.id
            )
        )
    ).all()
    held_rows = [(i, a) for i, a in held if (st := states.get(i)) and st.status in HELD_STATUSES]
    _ = func
    return InstitutionDetail(
        id=inst.id,
        aicte_id=inst.aicte_id,
        name=inst.name,
        trust_name=inst.trust_name,
        city=inst.city,
        state=inst.state,
        region=inst.region.code,
        region_name=inst.region.name,
        ownership=inst.ownership,
        premises=inst.premises,
        established_year=inst.established_year,
        flags={k: bool(v) for k, v in inst.flags.items()},
        programmes=[
            ProgrammeOut(
                discipline=p.discipline,
                level=p.level,
                intake=p.intake,
                approved_from=p.approved_from.isoformat(),
            )
            for p in programmes
        ],
        demand_preview=DemandPreview(
            exempt=preview.exempt,
            exemption_reason=preview.exemption_reason,
            total_paise=str(preview.total_paise),
            aph_ref=preview.aph_ref,
            rule_version=rules.demand.ref.version,
            lines=[
                DemandPreviewLine(
                    discipline=line.discipline,
                    level=line.level,
                    base_paise=str(line.base_paise),
                    multiplier=line.multiplier,
                    amount_paise=str(line.amount_paise),
                    note=line.note,
                )
                for line in preview.lines
            ],
        ),
        complaints=[
            ComplaintOut(
                reference=c.reference,
                cell=c.cell,
                category=c.category,
                status=c.status,
                opened_on=c.opened_on.isoformat(),
                closed_on=c.closed_on.isoformat() if c.closed_on else None,
            )
            for c in complaints
        ],
        release_cases=[
            ReleaseCaseBrief(
                id=c.id, reference=c.reference, status=c.status, applied_on=c.applied_on.isoformat()
            )
            for c in cases
        ],
        held_paise=str(sum(a for _, a in held_rows)),
        held_count=len(held_rows),
    )
