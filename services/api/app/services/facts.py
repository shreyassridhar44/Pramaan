"""Loads instrument facts for the as-of engine and loads the active rule set."""

from dataclasses import fields as dc_fields
from datetime import date
from typing import Any

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.asof import InstrumentFacts
from app.domain.assurance import EvidenceDates
from app.domain.rules import params as p
from app.models import Bank, Institution, Instrument, Region, RuleVersion

_EVIDENCE = [f.name for f in dc_fields(EvidenceDates)]
_LIFECYCLE = [
    "verified_on",
    "returned_on",
    "release_requested_on",
    "release_cleared_on",
    "released_on",
    "renewed_on",
    "encashed_on",
    "forfeited_on",
    "lien_hold_since",
    "lien_lifted_on",
]


def facts_query() -> Select[Any]:
    cols = [getattr(Instrument, c) for c in (*_LIFECYCLE, *_EVIDENCE)]
    return (
        select(
            Instrument.id,
            Instrument.amount_paise,
            Instrument.maturity_date,
            Region.code,
            Bank.code,
            Instrument.owner_id,
            Instrument.submitted_on,
            *cols,
        )
        .join(Institution, Institution.id == Instrument.institution_id)
        .join(Region, Region.id == Institution.region_id)
        .join(Bank, Bank.id == Instrument.bank_id)
    )


def row_to_facts(row: Any) -> InstrumentFacts:
    values = tuple(row)
    base, rest = values[:7], values[7:]
    lifecycle = dict(zip(_LIFECYCLE, rest[: len(_LIFECYCLE)], strict=True))
    evidence = EvidenceDates(**dict(zip(_EVIDENCE, rest[len(_LIFECYCLE) :], strict=True)))
    return InstrumentFacts(
        id=base[0],
        amount_paise=base[1],
        maturity_date=base[2],
        region=base[3],
        bank=base[4],
        owner_id=base[5],
        submitted_on=base[6],
        evidence=evidence,
        **lifecycle,
    )


async def load_facts(
    session: AsyncSession, query: Select[Any] | None = None
) -> list[InstrumentFacts]:
    result = await session.execute(query if query is not None else facts_query())
    return [row_to_facts(r) for r in result]


_RULE_CLASSES: dict[str, tuple[str, type]] = {
    "demand.rate_card": ("demand", p.DemandRules),
    "deadline.furnishing": ("deadline", p.DeadlineRules),
    "monitoring.reminders": ("maturity", p.MaturityRules),
    "monitoring.escalation": ("escalation", p.EscalationRules),
    "penalty": ("penalty", p.PenaltyRules),
    "release": ("release", p.ReleaseRules),
}


def _tuplify(value: Any) -> Any:
    if isinstance(value, list):
        return tuple(_tuplify(v) for v in value)
    return value


async def load_rules(session: AsyncSession, as_of: date | None = None) -> p.RuleSet:
    """Latest version of each rule effective on `as_of` (default: all). Falls back to the APH
    defaults for any rule not yet stored."""
    query = select(RuleVersion).order_by(RuleVersion.code, RuleVersion.version)
    if as_of is not None:
        query = query.where(RuleVersion.effective_from <= as_of)
    latest: dict[str, RuleVersion] = {}
    for rv in (await session.scalars(query)).all():
        latest[rv.code] = rv
    kwargs: dict[str, Any] = {}
    for code, (attr, cls) in _RULE_CLASSES.items():
        stored = latest.get(code)
        if stored is None:
            continue
        rv = stored
        ref = p.RuleRef(rv.code, rv.version, rv.aph_ref, rv.is_assumption)
        params = {k: (_tuplify(v) if k != "rate_card_lakh" else v) for k, v in rv.params.items()}
        kwargs[attr] = cls(ref=ref, **params)
    return p.RuleSet(**kwargs)


def default_rule_rows() -> list[dict[str, Any]]:
    """Rows that seed the rules table from the APH defaults."""
    rs = p.RuleSet()
    rows = []
    for code, (attr, _cls) in _RULE_CLASSES.items():
        rule = getattr(rs, attr)
        params = {f.name: getattr(rule, f.name) for f in dc_fields(rule) if f.name != "ref"}
        rows.append(
            {
                "code": code,
                "version": rule.ref.version,
                "params": params,
                "aph_ref": rule.ref.aph_ref,
                "is_assumption": rule.ref.assumption,
            }
        )
    return rows
