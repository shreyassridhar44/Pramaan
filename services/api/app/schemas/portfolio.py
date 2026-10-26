from pydantic import BaseModel


class AssuranceSplit(BaseModel):
    a0: str
    a1: str
    a2: str
    a3: str


class Summary(BaseModel):
    as_of: str
    data_source: str
    held_count: int
    held_paise: str
    by_assurance_paise: AssuranceSplit
    by_assurance_count: dict[str, int]
    by_status_count: dict[str, int]
    maturing_90_count: int
    maturing_90_paise: str
    overdue_count: int
    discrepancy_count: int
    pending_verification_count: int
    escalations: dict[str, int]
    needs_action_count: int
    by_bank_paise: dict[str, str]


class RiverWeek(BaseModel):
    week: str
    count: int
    by_assurance_paise: dict[str, str]


class RegionRow(BaseModel):
    code: str
    name: str
    office_city: str
    camp: bool
    lat: float
    lng: float
    held_paise: str
    held_count: int
    confirmed_paise: str
    overdue: int
    discrepancy: int


class ActionItem(BaseModel):
    kind: str
    severity: str
    title: str
    due: str
    instrument_id: int
    number: str
    institution: str
    amount_paise: str
    owner: str | None
    region: str
    status: str
    escalation: str | None = None


class TimelineEventOut(BaseModel):
    on: str
    kind: str
    instrument_id: int
    region: str
    detail: str


class TimelineStepOut(BaseModel):
    start: str
    end: str
    held_paise: str
    held_count: int
    confirmed_paise: str
    maturing_90_count: int
    overdue_count: int
    escalations: dict[str, int]
    by_region: dict[str, dict[str, int]]
    events: list[TimelineEventOut]
    event_counts: dict[str, int]


class Turnaround(BaseModel):
    median: float | None
    p90: int | None
    sample: int


class TrendPoint(BaseModel):
    month: str
    median_days: float | None
    count: int


class Impact(BaseModel):
    data_source: str
    verification_turnaround_days: Turnaround
    turnaround_trend: list[TrendPoint]
    field_agreement_rate: float | None
    bank_confirmed_share_by_count: float | None
    reminders_on_time_rate: float | None
    reminders_sample: int
    held_without_owner: int
    held_count: int


class Exposure(BaseModel):
    instrument_id: int
    number: str
    institution: str
    bank: str
    amount_paise: str
    assurance: int
    status: str


class RecentSignal(BaseModel):
    id: int
    instrument_id: int
    number: str
    institution: str
    code: str
    severity: str
    title: str
    detail: str | None
    raised_on: str


class PulseDay(BaseModel):
    """Recorded activity on one day, by kind."""

    day: str
    submitted: int
    checked: int
    bank: int
    reminders: int
    released: int
