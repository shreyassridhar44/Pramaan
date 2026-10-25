"""Operational reports (R11). Every figure is computed by the as-of engine from the same cached
states as the registry and the command view, so totals reconcile across screens."""

import io
import statistics
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.asof import HELD_STATUSES, NEEDS_ACTION_AT_MATURITY
from app.domain.types import Status
from app.models import Bank, Document, Region, ReleaseCase, ReleaseCaseInstrument
from app.services import portfolio as psvc
from app.services.letters import register_fonts


@dataclass(frozen=True)
class Column:
    key: str
    label: str
    kind: str = "text"  # text | money | count | date | days | percent


@dataclass(frozen=True)
class ReportDef:
    name: str
    title: str
    description: str
    params: tuple[str, ...] = ()


CATALOGUE: tuple[ReportDef, ...] = (
    ReportDef(
        "pending-verifications",
        "Pending verifications",
        "Submissions waiting for scrutiny, oldest first, with open signals.",
    ),
    ReportDef(
        "upcoming-maturities",
        "Upcoming maturities",
        "Deposits maturing within the chosen window, with their proof level.",
        ("days",),
    ),
    ReportDef(
        "missing-documents",
        "Missing documents",
        "Held deposits without a receipt scan, and open release cases missing documents.",
    ),
    ReportDef(
        "cases-needing-intervention",
        "Cases needing intervention",
        "Escalated maturities, discrepancies and blocked release cases.",
    ),
    ReportDef(
        "ageing-by-stage",
        "Ageing by stage",
        "How long items have waited at each stage, in age bands.",
    ),
    ReportDef(
        "region-exposure",
        "Region exposure",
        "Value held, proof and overdue items by AICTE region.",
    ),
    ReportDef(
        "bank-exposure",
        "Bank exposure",
        "Value held and proof by issuing bank.",
    ),
    ReportDef(
        "release-pipeline",
        "Release pipeline",
        "Release cases by stage, with value and time open.",
    ),
)
BY_NAME = {r.name: r for r in CATALOGUE}


@dataclass
class Report:
    definition: ReportDef
    as_of: date
    columns: list[Column]
    rows: list[dict[str, Any]]
    totals: dict[str, Any]
    params: dict[str, Any]


def _days(a: date, b: date) -> int:
    return (b - a).days


async def build(
    session: AsyncSession, scope: psvc.Scope, name: str, as_of: date, days: int = 90
) -> Report:
    definition = BY_NAME[name]
    facts, _ = await psvc.scoped_facts(session, scope)
    states = await psvc.states(session, scope, as_of)
    index = {r.id: r for r in await psvc.registry_index(session)}
    signals = await psvc.open_signal_counts(session)
    held = [
        (f, states[f.id]) for f in facts if f.id in states and states[f.id].status in HELD_STATUSES
    ]
    banks = dict((await session.execute(select(Bank.code, Bank.name))).all())
    regions = dict((await session.execute(select(Region.code, Region.name))).all())

    def base(f: Any) -> dict[str, Any]:
        r = index[f.id]
        return {
            "instrument_id": f.id,
            "number": r.number,
            "institution": r.institution,
            "region": regions.get(r.region, r.region),
            "bank": banks.get(r.bank, r.bank),
            "amount_paise": f.amount_paise,
        }

    rows: list[dict[str, Any]]
    params: dict[str, Any] = {}
    if name == "pending-verifications":
        rows = sorted(
            (
                {
                    **base(f),
                    "submitted_on": f.submitted_on,
                    "age_days": _days(f.submitted_on, as_of),
                    "signals": signals.get(f.id, 0),
                    "status": st.status.value,
                }
                for f, st in held
                if st.status in (Status.SUBMITTED, Status.UNDER_SCRUTINY)
            ),
            key=lambda r: -r["age_days"],
        )
        columns = [
            Column("number", "Instrument"),
            Column("institution", "Institution"),
            Column("region", "Region"),
            Column("amount_paise", "Amount", "money"),
            Column("submitted_on", "Submitted", "date"),
            Column("age_days", "Waiting", "days"),
            Column("signals", "Open signals", "count"),
        ]
    elif name == "upcoming-maturities":
        params = {"days": days}
        end = as_of + timedelta(days=days)
        rows = sorted(
            (
                {
                    **base(f),
                    "maturity_date": f.maturity_date,
                    "days_left": _days(as_of, f.maturity_date),
                    "assurance": f"A{st.assurance.value}",
                    "status": st.status.value,
                }
                for f, st in held
                if as_of <= f.maturity_date <= end
                and st.status not in (Status.RELEASE_REQUESTED, Status.RELEASE_CLEARED)
            ),
            key=lambda r: r["maturity_date"],
        )
        columns = [
            Column("number", "Instrument"),
            Column("institution", "Institution"),
            Column("bank", "Bank"),
            Column("amount_paise", "Amount", "money"),
            Column("maturity_date", "Matures", "date"),
            Column("days_left", "Days left", "days"),
            Column("assurance", "Proof"),
        ]
    elif name == "missing-documents":
        with_scan = set(
            (
                await session.scalars(
                    select(Document.entity_id).where(
                        Document.entity_type == "instrument", Document.kind == "fdr_scan"
                    )
                )
            ).all()
        )
        rows = [
            {**base(f), "missing": "Receipt scan", "stage": st.status.value}
            for f, st in held
            if f.id not in with_scan
            and st.status in (Status.SUBMITTED, Status.UNDER_SCRUTINY, Status.DISCREPANCY)
        ]
        required = {"application_letter", "affidavit_6", "instrument_copy", "latest_loa_eoa"}
        for case, inst_id in (
            await session.execute(
                select(ReleaseCase, ReleaseCaseInstrument.instrument_id)
                .join(
                    ReleaseCaseInstrument, ReleaseCaseInstrument.release_case_id == ReleaseCase.id
                )
                .where(ReleaseCase.status.in_(("in_clearance", "blocked", "cleared")))
            )
        ).all():
            missing = required - set(case.documents)
            if missing and inst_id in index and inst_id in states:
                f = next(x for x in facts if x.id == inst_id)
                rows.append(
                    {
                        **base(f),
                        "missing": ", ".join(sorted(m.replace("_", " ") for m in missing)),
                        "stage": f"release {case.reference}",
                    }
                )
        columns = [
            Column("number", "Instrument"),
            Column("institution", "Institution"),
            Column("region", "Region"),
            Column("amount_paise", "Amount", "money"),
            Column("missing", "Missing"),
            Column("stage", "Stage"),
        ]
    elif name == "cases-needing-intervention":
        rows = []
        for f, st in held:
            if st.status in NEEDS_ACTION_AT_MATURITY and st.escalation in (
                "section_head",
                "deputy_director",
                "director",
            ):
                reason = f"Matured {-st.days_to_maturity} days ago, escalated"
                level = st.escalation.replace("_", " ")
            elif st.status == Status.DISCREPANCY:
                reason, level = "Discrepancy with the bank or document", "officer"
            else:
                continue
            rows.append({**base(f), "reason": reason, "level": level})
        blocked = (
            await session.execute(
                select(ReleaseCase, ReleaseCaseInstrument.instrument_id)
                .join(
                    ReleaseCaseInstrument, ReleaseCaseInstrument.release_case_id == ReleaseCase.id
                )
                .where(ReleaseCase.status == "blocked")
            )
        ).all()
        for case, inst_id in blocked:
            if inst_id in states:
                f = next(x for x in facts if x.id == inst_id)
                rows.append(
                    {
                        **base(f),
                        "reason": f"Release {case.reference} blocked by a cell",
                        "level": "cell",
                    }
                )
        rows.sort(key=lambda r: -r["amount_paise"])
        columns = [
            Column("number", "Instrument"),
            Column("institution", "Institution"),
            Column("region", "Region"),
            Column("amount_paise", "Amount", "money"),
            Column("reason", "Why"),
            Column("level", "With"),
        ]
    elif name == "ageing-by-stage":
        bands = (
            ("0 to 7 days", 7),
            ("8 to 30 days", 30),
            ("31 to 90 days", 90),
            ("Over 90 days", 10**6),
        )
        stages: dict[str, list[int]] = defaultdict(list)
        for f, st in held:
            if st.status in (Status.SUBMITTED, Status.UNDER_SCRUTINY):
                stages["Awaiting scrutiny"].append(_days(f.submitted_on, as_of))
            elif st.status == Status.DISCREPANCY:
                since = f.evidence.conflict_since or f.submitted_on
                stages["Discrepancy open"].append(_days(since, as_of))
            elif st.status in NEEDS_ACTION_AT_MATURITY:
                stages["Matured without action"].append(-st.days_to_maturity)
            elif st.status == Status.RELEASE_REQUESTED and f.release_requested_on:
                stages["Release in clearance"].append(_days(f.release_requested_on, as_of))
            elif st.status == Status.RELEASE_CLEARED and f.release_cleared_on:
                stages["Awaiting bank discharge"].append(_days(f.release_cleared_on, as_of))
        rows = []
        for stage, ages in stages.items():
            row: dict[str, Any] = {"stage": stage, "count": len(ages)}
            lo = 0
            for label, hi in bands:
                row[label] = sum(1 for a in ages if lo <= a <= hi)
                lo = hi + 1
            row["median_days"] = statistics.median(ages) if ages else 0
            rows.append(row)
        columns = [Column("stage", "Stage"), Column("count", "Items", "count")]
        columns += [Column(label, label, "count") for label, _ in bands]
        columns.append(Column("median_days", "Median wait", "days"))
    elif name in ("region-exposure", "bank-exposure"):
        key = "region" if name == "region-exposure" else "bank"
        names = regions if key == "region" else banks
        agg: dict[str, dict[str, int]] = defaultdict(
            lambda: {"count": 0, "held": 0, "confirmed": 0, "overdue": 0, "discrepancy": 0}
        )
        for f, st in held:
            a = agg[getattr(f, key)]
            a["count"] += 1
            a["held"] += f.amount_paise
            a["confirmed"] += f.amount_paise if st.assurance.value >= 2 else 0
            a["overdue"] += st.status in NEEDS_ACTION_AT_MATURITY
            a["discrepancy"] += st.status == Status.DISCREPANCY
        rows = sorted(
            (
                {
                    key: names.get(code, code),
                    "count": a["count"],
                    "amount_paise": a["held"],
                    "confirmed_share": a["confirmed"] / a["held"] if a["held"] else 0,
                    "overdue": a["overdue"],
                    "discrepancy": a["discrepancy"],
                }
                for code, a in agg.items()
            ),
            key=lambda r: -r["amount_paise"],
        )
        columns = [
            Column(key, "Region" if key == "region" else "Bank"),
            Column("count", "Deposits", "count"),
            Column("amount_paise", "Value held", "money"),
            Column("confirmed_share", "Bank-confirmed", "percent"),
            Column("overdue", "Matured without action", "count"),
            Column("discrepancy", "Discrepancies", "count"),
        ]
    else:  # release-pipeline
        cases = (
            await session.execute(
                select(ReleaseCase.status, ReleaseCase.applied_on, ReleaseCase.closed_on)
            )
        ).all()
        stage_label = {
            "in_clearance": "Collecting clearances",
            "blocked": "Blocked by a cell",
            "cleared": "Ready for authorisation",
            "authorised": "Authorised, awaiting bank",
            "closed": "Released",
        }
        grouped: dict[str, list[int]] = defaultdict(list)
        for status, applied, closed in cases:
            grouped[status].append(_days(applied, closed or as_of))
        rows = [
            {
                "stage": stage_label.get(s, s),
                "count": len(v),
                "median_days": statistics.median(v),
                "p90_days": sorted(v)[int(0.9 * (len(v) - 1))],
            }
            for s, v in sorted(
                grouped.items(),
                key=lambda kv: list(stage_label).index(kv[0]) if kv[0] in stage_label else 99,
            )
        ]
        columns = [
            Column("stage", "Stage"),
            Column("count", "Cases", "count"),
            Column("median_days", "Median days open", "days"),
            Column("p90_days", "90th percentile days", "days"),
        ]

    totals: dict[str, Any] = {"rows": len(rows)}
    if any(c.key == "amount_paise" for c in columns):
        totals["amount_paise"] = sum(r["amount_paise"] for r in rows)
    if any(c.key == "count" for c in columns):
        totals["count"] = sum(r["count"] for r in rows)
    return Report(definition, as_of, columns, rows, totals, params)


def _cell(value: Any, kind: str) -> str:
    from app.domain.provenance import rupees

    if value is None:
        return ""
    if kind == "money":
        return rupees(int(value) // 100)
    if kind == "percent":
        return f"{float(value) * 100:.0f}%"
    if kind == "date" and isinstance(value, date):
        return value.strftime("%d %b %Y")
    if kind == "days":
        return f"{value:g}" if isinstance(value, float) else str(value)
    return str(value)


def pdf(report: Report) -> bytes:
    register_fonts()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=landscape(A4),
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
        title=report.definition.title,
        author="Pramaan prototype",
    )
    base = ParagraphStyle("b", fontName="Sans", fontSize=8, leading=10)
    head = ParagraphStyle("h", parent=base, fontName="Sans-SemiBold", fontSize=7.5)
    title = ParagraphStyle("t", fontName="Serif", fontSize=20, leading=24)
    meta = ParagraphStyle("m", parent=base, fontSize=8.5, textColor=colors.HexColor("#4A525C"))
    params = ", ".join(f"{k} {v}" for k, v in report.params.items())
    story: list[Any] = [
        Paragraph(report.definition.title, title),
        Paragraph(
            f"{report.definition.description} As of {report.as_of:%d %B %Y}"
            f"{'; ' + params if params else ''}. {len(report.rows)} rows. "
            "Computed from synthetic data by Pramaan.",
            meta,
        ),
        Spacer(1, 4 * mm),
    ]
    data = [[Paragraph(c.label, head) for c in report.columns]]
    for r in report.rows[:2000]:
        data.append([Paragraph(_cell(r.get(c.key), c.kind), base) for c in report.columns])
    if "amount_paise" in report.totals:
        data.append(
            [
                Paragraph(
                    _cell(report.totals["amount_paise"], "money")
                    if c.key == "amount_paise"
                    else ("Total" if i == 0 else ""),
                    head,
                )
                for i, c in enumerate(report.columns)
            ]
        )
    table = Table(data, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F4F1EA")),
                ("LINEBELOW", (0, 0), (-1, -1), 0.3, colors.HexColor("#D9D4CA")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(table)
    if len(report.rows) > 2000:
        story.append(Paragraph("First 2,000 rows shown; export CSV for all rows.", meta))
    doc.build(story)
    return buf.getvalue()
