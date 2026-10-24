from datetime import date
from typing import Annotated, Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, or_, select

from app.api.deps import CurrentPrincipal, DbSession, instrument_scope
from app.domain.asof import state_on
from app.domain.provenance import Observation, char_diff, compare_field, display
from app.domain.rules.maturity import reminder_schedule
from app.domain.types import FieldName, MatchState, Role, Source
from app.models import (
    Analysis,
    Bank,
    Demand,
    Document,
    Event,
    FieldObservation,
    Institution,
    Instrument,
    Region,
    Reminder,
    Signal,
    User,
)
from app.schemas.instruments import (
    ChainLink,
    DemandLineOut,
    DemandOut,
    DiffRun,
    DocumentBrief,
    EvidenceOut,
    InstrumentDetail,
    InstrumentPage,
    InstrumentRow,
    ProvenanceRow,
    ReminderOut,
    SignalOut,
    SourceValue,
    TimelineItem,
)
from app.services import portfolio as psvc

router = APIRouter(prefix="/instruments", tags=["instruments"])
IST = ZoneInfo("Asia/Kolkata")

FIELD_LABELS = {
    FieldName.NUMBER: "Instrument number",
    FieldName.BANK: "Bank",
    FieldName.IFSC: "IFSC",
    FieldName.AMOUNT: "Amount",
    FieldName.ISSUE_DATE: "Issue date",
    FieldName.MATURITY_DATE: "Maturity date",
    FieldName.HOLDERS: "Holders",
    FieldName.LIEN: "Lien in favour of AICTE",
}

SortKey = Literal[
    "maturity", "-maturity", "amount", "-amount", "institution", "status", "assurance"
]


def _iso(d: date | None) -> str | None:
    return d.isoformat() if d else None


@router.get("", response_model=InstrumentPage)
async def list_instruments(
    principal: CurrentPrincipal,
    db: DbSession,
    as_of: date | None = None,
    q: str | None = None,
    region: Annotated[list[str] | None, Query()] = None,
    bank: Annotated[list[str] | None, Query()] = None,
    kind: Annotated[list[str] | None, Query()] = None,
    status: Annotated[list[str] | None, Query()] = None,
    assurance: Annotated[list[int] | None, Query()] = None,
    maturity_from: date | None = None,
    maturity_to: date | None = None,
    institution_id: int | None = None,
    has_signals: bool | None = None,
    include_closed: bool = False,
    sort: SortKey = "maturity",
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> InstrumentPage:
    """Statuses and assurance are computed by the as-of engine for `as_of`, so the registry always
    agrees with the command view and the forecast."""
    if principal.role == Role.CELL_OFFICER:
        raise HTTPException(403, "Your role does not have access to this.")
    d = as_of or date.today()
    scope = await psvc.scope_for(db, principal.user)
    states = await psvc.states(db, scope, d)

    query = (
        select(
            Instrument.id,
            Instrument.institution_id,
            Instrument.amount_paise,
            Instrument.maturity_date,
            Institution.name,
            Region.code,
            Bank.code,
            Instrument.kind,
        )
        .join(Institution, Institution.id == Instrument.institution_id)
        .join(Region, Region.id == Institution.region_id)
        .join(Bank, Bank.id == Instrument.bank_id)
        .where(instrument_scope(principal))
    )
    if q:
        like = f"%{q.strip()}%"
        query = query.where(
            or_(
                Instrument.number.ilike(like),
                Institution.name.ilike(like),
                Institution.aicte_id.ilike(like),
            )
        )
    if region:
        query = query.where(Region.code.in_(region))
    if bank:
        query = query.where(Bank.code.in_(bank))
    if kind:
        query = query.where(Instrument.kind.in_(kind))
    if maturity_from:
        query = query.where(Instrument.maturity_date >= maturity_from)
    if maturity_to:
        query = query.where(Instrument.maturity_date <= maturity_to)
    if institution_id:
        query = query.where(Instrument.institution_id == institution_id)
    rows = (await db.execute(query)).all()

    signal_counts = dict(
        (
            await db.execute(
                select(Signal.entity_id, func.count())
                .where(Signal.entity_type == "instrument", Signal.status == "open")
                .group_by(Signal.entity_id)
            )
        ).all()
    )

    closed = {"released", "renewed", "encashed_prematurely", "forfeited"}
    matches = []
    for r in rows:
        st = states.get(r[0])
        if st is None:
            continue
        if not include_closed and not status and st.status in closed:
            continue
        if status and st.status not in status:
            continue
        if assurance is not None and st.assurance.value not in assurance:
            continue
        if has_signals is not None and bool(signal_counts.get(r[0])) != has_signals:
            continue
        matches.append((r, st))

    keyfuncs = {
        "maturity": lambda m: m[0][3],
        "-maturity": lambda m: m[0][3],
        "amount": lambda m: m[0][2],
        "-amount": lambda m: m[0][2],
        "institution": lambda m: m[0][4],
        "status": lambda m: m[1].status,
        "assurance": lambda m: m[1].assurance,
    }
    matches.sort(key=keyfuncs[sort], reverse=sort.startswith("-"))
    total_paise = sum(m[0][2] for m in matches)
    page = matches[offset : offset + limit]
    ids = [m[0][0] for m in page]
    details = {
        i.id: i
        for i in (await db.scalars(select(Instrument).where(Instrument.id.in_(ids)))).unique().all()
    }
    owner_ids = {i.owner_id for i in details.values() if i.owner_id}
    owners = dict(
        (await db.execute(select(User.id, User.name).where(User.id.in_(owner_ids)))).all()
    )

    items = []
    for r, st in page:
        inst = details[r[0]]
        items.append(
            InstrumentRow(
                id=inst.id,
                number=inst.number,
                kind=inst.kind,
                institution_id=inst.institution_id,
                institution=r[4],
                region=r[5],
                bank_code=r[6],
                bank=inst.bank.name,
                amount_paise=str(inst.amount_paise),
                issue_date=inst.issue_date.isoformat(),
                maturity_date=inst.maturity_date.isoformat(),
                days_to_maturity=st.days_to_maturity,
                status=st.status.value,
                assurance=st.assurance.value,
                escalation=st.escalation,
                open_signals=signal_counts.get(inst.id, 0),
                owner=owners.get(inst.owner_id) if inst.owner_id else None,
            )
        )
    return InstrumentPage(
        as_of=d.isoformat(),
        total=len(matches),
        total_paise=str(total_paise),
        offset=offset,
        limit=limit,
        items=items,
    )


async def _load_visible(
    db: DbSession, principal: CurrentPrincipal, instrument_id: int
) -> Instrument:
    inst = await db.scalar(
        select(Instrument)
        .join(Institution, Institution.id == Instrument.institution_id)
        .where(Instrument.id == instrument_id, instrument_scope(principal))
    )
    if inst is None:
        raise HTTPException(404, "Instrument not found.")
    return inst


def _display(obs: FieldObservation) -> str:
    try:
        return display(FieldName(obs.field), obs.value_norm)
    except ValueError:
        return obs.value_raw


def _source_value(obs: FieldObservation | None) -> SourceValue | None:
    if obs is None:
        return None
    return SourceValue(
        raw=obs.value_raw,
        norm=obs.value_norm,
        display=_display(obs),
        observed_on=obs.observed_on.isoformat(),
        confidence=obs.confidence,
        evidence_type=obs.evidence_type,
    )


@router.get("/{instrument_id}", response_model=InstrumentDetail)
async def get_instrument(
    instrument_id: int, principal: CurrentPrincipal, db: DbSession, as_of: date | None = None
) -> InstrumentDetail:
    if principal.role == Role.CELL_OFFICER:
        raise HTTPException(403, "Your role does not have access to this.")
    d = as_of or date.today()
    inst = await _load_visible(db, principal, instrument_id)
    facts, rules = await psvc.scoped_facts(db, psvc.Scope("all"))
    fact = next(f for f in facts if f.id == inst.id)
    st = state_on(fact, d, rules)
    if st is None:
        raise HTTPException(404, "This instrument did not exist on the selected date.")

    obs_rows = (
        await db.scalars(
            select(FieldObservation)
            .where(FieldObservation.instrument_id == inst.id)
            .order_by(FieldObservation.observed_on, FieldObservation.id)
        )
    ).all()
    observations = [
        Observation(FieldName(o.field), Source(o.source), o.value_norm, o.observed_on)
        for o in obs_rows
    ]
    provenance = []
    for fld in FieldName:
        cmp = compare_field(fld, observations, d)
        latest: dict[str, FieldObservation] = {}
        for o in obs_rows:
            if o.field == fld.value and o.observed_on <= d:
                latest[o.source] = o
        declared = latest.get("declared")
        extracted = latest.get("extracted")
        confirmed = latest.get("confirmed")

        def diff(
            other: FieldObservation | None,
            base: FieldObservation | None = declared,
            conflict: bool = cmp.state == MatchState.CONFLICT,
        ) -> list[DiffRun] | None:
            if not conflict or other is None or base is None:
                return None
            if other.value_norm == base.value_norm:
                return None
            return [
                DiffRun(text=t, changed=c) for t, c in char_diff(_display(base), _display(other))
            ]

        provenance.append(
            ProvenanceRow(
                field=fld.value,
                label=FIELD_LABELS[fld],
                state=cmp.state.value,
                declared=_source_value(declared),
                extracted=_source_value(extracted),
                confirmed=_source_value(confirmed),
                diff_extracted=diff(extracted),
                diff_confirmed=diff(confirmed),
            )
        )

    chain: list[Instrument] = [inst]
    prev_id = inst.predecessor_id
    while prev_id:
        prev = await db.get(Instrument, prev_id)
        if prev is None:
            break
        chain.insert(0, prev)
        prev_id = prev.predecessor_id
    nxt = await db.scalar(select(Instrument).where(Instrument.predecessor_id == inst.id))
    while nxt is not None:
        chain.append(nxt)
        nxt = await db.scalar(select(Instrument).where(Instrument.predecessor_id == nxt.id))

    signals = (
        await db.scalars(
            select(Signal)
            .where(Signal.entity_type == "instrument", Signal.entity_id == inst.id)
            .order_by(Signal.raised_on.desc())
        )
    ).all()
    events = (
        await db.scalars(
            select(Event)
            .where(
                Event.entity_type == "instrument",
                Event.entity_id == inst.id,
                Event.occurred_on <= d,
            )
            .order_by(Event.occurred_on, Event.id)
        )
    ).all()
    actor_names = dict(
        (
            await db.execute(
                select(User.id, User.name).where(
                    User.id.in_({e.actor_id for e in events if e.actor_id})
                )
            )
        ).all()
    )
    sent = {
        r.offset_days
        for r in (await db.scalars(select(Reminder).where(Reminder.instrument_id == inst.id))).all()
    }
    schedule = reminder_schedule(inst.maturity_date, max(d, inst.maturity_date), rules.maturity)
    docs = (
        await db.scalars(
            select(Document)
            .where(Document.entity_type == "instrument", Document.entity_id == inst.id)
            .order_by(Document.uploaded_at)
        )
    ).all()
    analysed_ids = set(
        (
            await db.scalars(
                select(Analysis.document_id).where(Analysis.document_id.in_([x.id for x in docs]))
            )
        ).all()
    )
    demand = await db.get(Demand, inst.demand_id) if inst.demand_id else None
    region = await db.get(Region, inst.institution.region_id)
    owner = await db.get(User, inst.owner_id) if inst.owner_id else None

    return InstrumentDetail(
        as_of=d.isoformat(),
        id=inst.id,
        number=inst.number,
        kind=inst.kind,
        status=st.status.value,
        stored_status=inst.status,
        assurance=st.assurance.value,
        escalation=st.escalation,
        days_to_maturity=st.days_to_maturity,
        amount_paise=str(inst.amount_paise),
        interest_rate=inst.interest_rate,
        issue_date=inst.issue_date.isoformat(),
        maturity_date=inst.maturity_date.isoformat(),
        tenure_months=inst.tenure_months,
        auto_renew=inst.auto_renew,
        branch=inst.branch,
        ifsc=inst.ifsc,
        bank_id=inst.bank_id,
        bank_code=inst.bank.code,
        bank=inst.bank.name,
        bank_integration=inst.bank.integration,
        bank_simulated=inst.bank.is_simulated,
        institution_id=inst.institution_id,
        institution=inst.institution.name,
        institution_aicte_id=inst.institution.aicte_id,
        trust_name=inst.institution.trust_name,
        region=region.code if region else "",
        region_name=region.name if region else "",
        owner=owner.name if owner else None,
        next_action=inst.next_action,
        next_action_due=_iso(inst.next_action_due),
        submitted_on=inst.submitted_on.isoformat(),
        verified_on=_iso(inst.verified_on),
        evidence=EvidenceOut(
            document_checked_on=_iso(inst.document_checked_on),
            bank_confirmed_on=_iso(inst.bank_confirmed_on),
            last_confirmed_on=_iso(inst.last_confirmed_on),
            conflict_since=_iso(inst.conflict_since),
            conflict_resolved_on=_iso(inst.conflict_resolved_on),
        ),
        provenance=provenance,
        chain=[
            ChainLink(
                id=c.id,
                number=c.number,
                issue_date=c.issue_date.isoformat(),
                maturity_date=c.maturity_date.isoformat(),
                amount_paise=str(c.amount_paise),
                status=c.status,
            )
            for c in chain
        ],
        signals=[
            SignalOut(
                id=s.id,
                code=s.code,
                severity=s.severity,
                title=s.title,
                status=s.status,
                source=s.source,
                source_version=s.source_version,
                raised_on=s.raised_on.isoformat(),
                evidence=s.evidence,
                resolution_note=s.resolution_note,
            )
            for s in signals
        ],
        reminders=[
            ReminderOut(
                offset_days=r.offset_days,
                due_on=r.due_on.isoformat(),
                status="sent"
                if r.offset_days in sent
                else "scheduled"
                if r.due_on > d
                else "not_recorded",
                overdue=r.overdue,
            )
            for r in schedule[:10]
        ],
        demand=DemandOut(
            id=demand.id,
            reason=demand.reason,
            amount_paise=str(demand.amount_paise),
            intimated_on=demand.intimated_on.isoformat(),
            due_on=demand.due_on.isoformat(),
            furnished_on=_iso(demand.furnished_on),
            aph_ref=rules.demand.ref.aph_ref,
            lines=[
                DemandLineOut(
                    discipline=line["discipline"],
                    level=line["level"],
                    base_paise=str(line["base_paise"]),
                    multiplier=line["multiplier"],
                    amount_paise=str(line["amount_paise"]),
                    note=line["note"],
                )
                for line in demand.lines
            ],
        )
        if demand
        else None,
        timeline=[
            TimelineItem(
                on=e.occurred_on.isoformat(),
                type=e.type,
                actor=actor_names.get(e.actor_id) if e.actor_id else None,
                payload=e.payload,
            )
            for e in events
        ],
        documents=[
            DocumentBrief(
                id=x.id,
                kind=x.kind,
                filename=x.filename,
                uploaded_on=x.uploaded_at.astimezone(IST).date().isoformat(),
                analysed=x.id in analysed_ids,
            )
            for x in docs
        ],
    )
