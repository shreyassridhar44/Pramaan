from pydantic import BaseModel


class InstrumentRow(BaseModel):
    id: int
    number: str
    kind: str
    institution_id: int
    institution: str
    region: str
    bank_code: str
    bank: str
    amount_paise: str
    issue_date: str
    maturity_date: str
    days_to_maturity: int
    status: str
    assurance: int
    escalation: str | None
    open_signals: int
    owner: str | None


class InstrumentPage(BaseModel):
    as_of: str
    total: int
    total_paise: str
    offset: int
    limit: int
    items: list[InstrumentRow]


class DiffRun(BaseModel):
    text: str
    changed: bool


class SourceValue(BaseModel):
    raw: str
    norm: str
    observed_on: str
    confidence: float | None
    evidence_type: str | None


class ProvenanceRow(BaseModel):
    field: str
    label: str
    state: str
    declared: SourceValue | None
    extracted: SourceValue | None
    confirmed: SourceValue | None
    diff_extracted: list[DiffRun] | None
    diff_confirmed: list[DiffRun] | None


class EvidenceOut(BaseModel):
    document_checked_on: str | None
    bank_confirmed_on: str | None
    last_confirmed_on: str | None
    conflict_since: str | None
    conflict_resolved_on: str | None


class ChainLink(BaseModel):
    id: int
    number: str
    issue_date: str
    maturity_date: str
    amount_paise: str
    status: str


class SignalOut(BaseModel):
    id: int
    code: str
    severity: str
    title: str
    status: str
    source: str
    source_version: str
    raised_on: str
    evidence: dict[str, object]
    resolution_note: str | None


class TimelineItem(BaseModel):
    on: str
    type: str
    actor: str | None
    payload: dict[str, object]


class ReminderOut(BaseModel):
    offset_days: int
    due_on: str
    status: str  # sent | scheduled | not_recorded
    overdue: bool


class DemandLineOut(BaseModel):
    discipline: str
    level: str
    base_paise: str
    multiplier: int
    amount_paise: str
    note: str


class DemandOut(BaseModel):
    id: int
    reason: str
    amount_paise: str
    intimated_on: str
    due_on: str
    furnished_on: str | None
    aph_ref: str
    lines: list[DemandLineOut]


class InstrumentDetail(BaseModel):
    as_of: str
    id: int
    number: str
    kind: str
    status: str
    stored_status: str
    assurance: int
    escalation: str | None
    days_to_maturity: int
    amount_paise: str
    interest_rate: float | None
    issue_date: str
    maturity_date: str
    tenure_months: int
    auto_renew: bool
    branch: str
    ifsc: str
    bank_id: int
    bank_code: str
    bank: str
    bank_integration: str
    bank_simulated: bool
    institution_id: int
    institution: str
    institution_aicte_id: str
    trust_name: str
    region: str
    region_name: str
    owner: str | None
    next_action: str | None
    next_action_due: str | None
    submitted_on: str
    verified_on: str | None
    evidence: EvidenceOut
    provenance: list[ProvenanceRow]
    chain: list[ChainLink]
    signals: list[SignalOut]
    reminders: list[ReminderOut]
    demand: DemandOut | None
    timeline: list[TimelineItem]
