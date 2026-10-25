"""Rule administration (F16, FR16): every rule with its APH reference and version history.
A change creates a new version; the old one stays for history and for as-of calculations."""

from dataclasses import fields as dc_fields
from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from app.api.deps import DbSession, OfficerReader, Principal, require_roles
from app.domain.rules import params as p
from app.domain.types import Role
from app.models import RuleVersion, User
from app.services import audit
from app.services import portfolio as psvc
from app.services.facts import RULE_CLASSES, tuplify

router = APIRouter(prefix="/rules", tags=["rules"])
Editor = Annotated[Principal, Depends(require_roles(Role.ADMIN, Role.SECTION_HEAD))]

TITLES = {
    "demand.rate_card": "Security deposit rate card",
    "deadline.furnishing": "Furnishing deadline and late penalties",
    "monitoring.reminders": "Maturity reminders",
    "monitoring.escalation": "Escalation ladder",
    "penalty": "Penalties",
    "release": "Release conditions",
}
LEVELS = ("dealing_officer", "section_head", "deputy_director", "director")
DOCUMENTS = ("application_letter", "affidavit_6", "instrument_copy", "latest_loa_eoa")
CELLS = ("pgrc", "vigilance", "grants")


class VersionOut(BaseModel):
    version: int
    params: dict[str, Any]
    effective_from: str
    created_by: str | None
    created_at: str
    note: str | None


class RuleOut(BaseModel):
    code: str
    title: str
    aph_ref: str
    is_assumption: bool
    current: VersionOut
    history: list[VersionOut]


class NewVersion(BaseModel):
    params: dict[str, Any]
    effective_from: date
    note: str = Field(min_length=5, max_length=1000)


def _check(code: str, params: dict[str, Any]) -> None:
    """Rejects values that would make the rules engine misbehave. Raises ValueError."""

    def frac(v: Any) -> bool:
        return isinstance(v, int | float) and 0 <= v <= 1

    if code == "demand.rate_card":
        for disc, levels in params["rate_card_lakh"].items():
            for level, v in levels.items():
                if v is not None and (not isinstance(v, int) or v < 0 or v > 500):
                    raise ValueError(f"Rate for {disc} {level} must be 0 to 500 lakh or blank.")
        if not 1 <= params["leased_multiplier"] <= 5:
            raise ValueError("Leased multiplier must be 1 to 5.")
        if not 1 <= params["term_years"] <= 30:
            raise ValueError("Term must be 1 to 30 years.")
    elif code == "deadline.furnishing":
        if not 1 <= params["furnish_within_days"] <= 90:
            raise ValueError("Deadline must be 1 to 90 days.")
        last = (0, 0)
        for (month, day), fraction in params["slabs"]:
            if not (1 <= month <= 12 and 1 <= day <= 31) or (month, day) <= last:
                raise ValueError("Penalty dates must be valid and in calendar order.")
            if not frac(fraction):
                raise ValueError("Penalties must be between 0 and 1.")
            last = (month, day)
    elif code == "monitoring.reminders":
        offsets = params["reminder_offsets_days"]
        if not offsets or any(not isinstance(o, int) or o < 0 or o > 365 for o in offsets):
            raise ValueError("Reminder offsets must be whole days from 0 to 365.")
        if len(set(offsets)) != len(offsets):
            raise ValueError("Reminder offsets must not repeat.")
        if not 1 <= params["overdue_reminder_every_days"] <= 60:
            raise ValueError("Overdue reminders must repeat every 1 to 60 days.")
        if not 1 <= params["maturing_window_days"] <= 365:
            raise ValueError("The maturing window must be 1 to 365 days.")
        if not 30 <= params["reconfirm_window_days"] <= 1095:
            raise ValueError("Re-confirmation must be every 30 to 1,095 days.")
    elif code == "monitoring.escalation":
        ladder = params["ladder"]
        days = [d for d, _ in ladder]
        if not ladder or days[0] != 0 or days != sorted(set(days)):
            raise ValueError("The ladder must start at day 0 and rise without repeats.")
        if any(level not in LEVELS for _, level in ladder):
            raise ValueError("Unknown escalation level.")
    elif code == "penalty":
        if not all(frac(params[k]) for k in params):
            raise ValueError("Penalties must be between 0 and 1.")
    elif code == "release":
        if not set(params["required_documents"]) <= set(DOCUMENTS):
            raise ValueError("Unknown document in the release conditions.")
        if not set(params["required_cells"]) <= set(CELLS):
            raise ValueError("Unknown clearance cell.")


@router.get("", response_model=list[RuleOut])
async def list_rules(principal: OfficerReader, db: DbSession) -> list[RuleOut]:
    rows = (
        await db.execute(
            select(RuleVersion, User.name)
            .outerjoin(User, User.id == RuleVersion.created_by)
            .order_by(RuleVersion.code, RuleVersion.version.desc())
        )
    ).all()
    by_code: dict[str, list[tuple[RuleVersion, str | None]]] = {}
    for rv, name in rows:
        by_code.setdefault(rv.code, []).append((rv, name))
    today = date.today()
    out = []
    for code in RULE_CLASSES:
        versions = by_code.get(code, [])
        if not versions:
            continue
        current = next((v for v in versions if v[0].effective_from <= today), versions[-1])
        out.append(
            RuleOut(
                code=code,
                title=TITLES.get(code, code),
                aph_ref=current[0].aph_ref,
                is_assumption=current[0].is_assumption,
                current=_version(*current),
                history=[_version(*v) for v in versions],
            )
        )
    return out


def _version(rv: RuleVersion, name: str | None) -> VersionOut:
    return VersionOut(
        version=rv.version,
        params={k: v for k, v in rv.params.items() if not k.startswith("_")},
        effective_from=rv.effective_from.isoformat(),
        created_by=name,
        created_at=rv.created_at.isoformat(),
        note=rv.params.get("_note") if isinstance(rv.params, dict) else None,
    )


@router.post("/{code}/versions", response_model=RuleOut)
async def new_version(code: str, body: NewVersion, principal: Editor, db: DbSession) -> RuleOut:
    if code not in RULE_CLASSES:
        raise HTTPException(404, "Rule not found.")
    if body.effective_from < date.today():
        raise HTTPException(422, "A new version cannot take effect in the past.")
    _attr, cls = RULE_CLASSES[code]
    allowed = {f.name for f in dc_fields(cls) if f.name != "ref"}
    params = {k: v for k, v in body.params.items() if k in allowed}
    if set(params) != allowed:
        raise HTTPException(422, f"Provide every parameter: {', '.join(sorted(allowed))}.")
    try:
        _check(code, params)
        converted = {k: (tuplify(v) if k != "rate_card_lakh" else v) for k, v in params.items()}
        cls(ref=p.RuleRef(code, 0, ""), **converted)
    except (ValueError, TypeError, KeyError) as exc:
        raise HTTPException(422, str(exc)) from exc
    latest = await db.scalar(
        select(RuleVersion).where(RuleVersion.code == code).order_by(RuleVersion.version.desc())
    )
    assert latest is not None
    version = (
        int(
            await db.scalar(select(func.max(RuleVersion.version)).where(RuleVersion.code == code))
            or 0
        )
        + 1
    )
    db.add(
        RuleVersion(
            code=code,
            version=version,
            params={**params, "_note": body.note.strip()},
            aph_ref=latest.aph_ref,
            is_assumption=latest.is_assumption,
            effective_from=body.effective_from,
            created_by=principal.user.id,
        )
    )
    await audit.append(
        db,
        actor_id=principal.user.id,
        actor_label=principal.label,
        action="rule.version_created",
        entity_type="rule",
        entity_id=None,
        data={"code": code, "version": version, "effective_from": body.effective_from.isoformat()},
        note=body.note.strip(),
    )
    await psvc.bump_data_version(db)
    await db.commit()
    return next(r for r in await list_rules(principal, db) if r.code == code)
