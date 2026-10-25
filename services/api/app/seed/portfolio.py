"""Synthetic portfolio generator (DATA_SOURCES.md 2.1).

Builds a deterministic, internally consistent dataset: institutions, programmes, demands computed
with the real Table 1.4 rule, instruments over ten years with realistic outcomes, records held by
the simulated banks (with deliberate mismatches at a controlled rate), observations from each
source, signals, complaints, release cases, reminders, escalations and a hash-chained audit trail.

Everything is anchored to `anchor` (normally today) so the demo always looks current.
"""

import base64
import hashlib
import json
import random
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, time, timedelta
from pathlib import Path
from time import time_ns
from typing import Any

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

from app.domain.asof import InstrumentFacts, status_on
from app.domain.assurance import EvidenceDates
from app.domain.provenance import normalise
from app.domain.rules.demand import ProgrammeLevel, compute_demand
from app.domain.rules.params import RuleSet
from app.domain.types import FieldName, InstrumentKind, Ownership, Premises, Source, Status
from app.seed import reference as ref
from app.services.audit import GENESIS, canonical, chain_hash

DEMO_PASSWORD = "Pramaan@2026"  # noqa: S105 (published demo credential, demo mode only)
RULES = RuleSet()


def inr_grouped(rupees: int) -> str:
    s = str(rupees)
    if len(s) <= 3:
        return s
    head, tail = s[:-3], s[-3:]
    groups: list[str] = []
    while len(head) > 2:
        groups.insert(0, head[-2:])
        head = head[:-2]
    if head:
        groups.insert(0, head)
    return ",".join(groups) + "," + tail


def bank_keypair(seed: int, code: str) -> tuple[str, str, str]:
    """Deterministic Ed25519 key for a simulated bank: (key_id, private_b64, public_b64)."""
    raw = hashlib.sha256(f"pramaan-sim-bank:{seed}:{code}".encode()).digest()
    key = Ed25519PrivateKey.from_private_bytes(raw)
    pub = key.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw)
    key_id = f"{code.lower()}-sim-{hashlib.sha256(pub).hexdigest()[:8]}"
    return key_id, base64.b64encode(raw).decode(), base64.b64encode(pub).decode()


@dataclass
class Dataset:
    anchor: date
    rows: dict[str, list[dict[str, Any]]] = field(default_factory=lambda: defaultdict(list))
    counters: dict[str, int] = field(default_factory=lambda: defaultdict(int))

    def add(self, table: str, row: dict[str, Any]) -> int:
        self.counters[table] += 1
        row = {"id": self.counters[table], **row}
        self.rows[table].append(row)
        return int(row["id"])


@dataclass
class _Inst:
    id: int
    name: str
    trust: str
    region_code: str
    region_id: int
    city: str
    state: str
    ownership: Ownership
    premises: Premises
    established: int
    type_label: str
    programmes: list[tuple[str, str, int]]  # (discipline, level, year approved)
    complaint_open: bool = False
    dispute: bool = False


class Generator:
    def __init__(self, seed: int, anchor: date, institutions: int = 2600) -> None:
        self.seed = seed
        self.rng = random.Random(seed)  # noqa: S311 (synthetic data, not security)
        self.anchor = anchor
        self.n_institutions = institutions
        self.ds = Dataset(anchor)
        self.region_ids: dict[str, int] = {}
        self.bank_ids: dict[str, int] = {}
        self.officers_by_region: dict[str, list[int]] = defaultdict(list)
        self.persona_ids: dict[str, int] = {}
        self.numbers: set[tuple[int, str]] = set()
        self.events: list[dict[str, Any]] = []

    # ---------------------------------------------------------------- reference data
    def regions_and_banks(self) -> None:
        for r in ref.REGIONS:
            self.region_ids[r.code] = self.ds.add(
                "regions",
                {
                    "code": r.code,
                    "name": r.name,
                    "office_city": r.office_city,
                    "is_camp_office": r.camp,
                    "lat": r.lat,
                    "lng": r.lng,
                },
            )
        for b in ref.BANKS:
            key_id, priv, pub = bank_keypair(self.seed, b.code)
            bank_id = self.ds.add(
                "banks",
                {
                    "code": b.code,
                    "name": b.name,
                    "hq_city": b.hq_city,
                    "is_simulated": True,
                    "key_id": key_id,
                    "public_key_b64": pub,
                    "integration": b.integration,
                },
            )
            self.bank_ids[b.code] = bank_id
            self.ds.rows["sim_bank_keys"].append(
                {"bank_id": bank_id, "key_id": key_id, "private_key_b64": priv}
            )

    def users(self, password_hash: str) -> None:
        def user(
            email: str,
            name: str,
            designation: str,
            role: str,
            persona: str | None = None,
            **extra: Any,
        ) -> int:
            uid = self.ds.add(
                "users",
                {
                    "email": email,
                    "name": name,
                    "designation": designation,
                    "password_hash": password_hash,
                    "role": role,
                    "persona_key": persona,
                    "region_id": None,
                    "institution_id": None,
                    "bank_id": None,
                    "cell": None,
                    "is_active": True,
                    "failed_logins": 0,
                    **extra,
                },
            )
            if persona:
                self.persona_ids[persona] = uid
            return uid

        user(
            "ananya.iyer@aicte.demo",
            "Ananya Iyer",
            "Assistant Director, Regulation Bureau",
            "bureau_officer",
            "bureau",
        )
        user(
            "rajeev.menon@aicte.demo",
            "Rajeev Menon",
            "Deputy Director, Regulation Bureau",
            "section_head",
            "section_head",
        )
        user(
            "sunita.rao@aicte.demo",
            "Dr. Sunita Rao",
            "Director, Approval Bureau",
            "approving_authority",
            "authority",
        )
        user(
            "prakash.kulkarni@aicte.demo",
            "Prakash Kulkarni",
            "Regional Officer, Western Region",
            "regional_officer",
            "regional",
            region_id=self.region_ids["western"],
        )
        user(
            "farah.siddiqui@aicte.demo",
            "Farah Siddiqui",
            "Section Officer, PGRC",
            "cell_officer",
            "pgrc",
            cell="pgrc",
        )
        user(
            "harish.negi@aicte.demo",
            "Harish Negi",
            "Section Officer, Vigilance Cell",
            "cell_officer",
            "vigilance",
            cell="vigilance",
        )
        user(
            "meera.pillai@aicte.demo",
            "Meera Pillai",
            "Section Officer, Grants",
            "cell_officer",
            "grants",
            cell="grants",
        )
        user(
            "sanjay.bhat@bharatnational.demo",
            "Sanjay Bhat",
            "Branch Manager (simulated bank)",
            "bank_officer",
            "bank",
            bank_id=self.bank_ids["BHNX"],
        )
        user(
            "lakshmi.narayan@aicte.demo", "Lakshmi Narayan", "Internal Audit", "auditor", "auditor"
        )
        user("admin@aicte.demo", "Pramaan Administrator", "Administrator", "admin", "admin")

        for r in ref.REGIONS:
            for i in range(2):
                first = self.rng.choice(ref.FIRST_NAMES)
                last = self.rng.choice(ref.SURNAMES)
                uid = user(
                    f"{first.lower()}.{last.lower().replace(chr(39), '')}.{r.code}{i}@aicte.demo",
                    f"{first} {last}",
                    f"Dealing Officer, {r.name}",
                    "bureau_officer",
                    region_id=self.region_ids[r.code],
                )
                self.officers_by_region[r.code].append(uid)

    # ---------------------------------------------------------------- institutions
    def institutions(self) -> list[_Inst]:
        rng = self.rng
        states: list[tuple[str, str, float, tuple[str, ...]]] = []
        for r in ref.REGIONS:
            for st, (w, cities) in r.states.items():
                states.append((r.code, st, w, cities))
        weights = [s[2] for s in states]
        type_weights = [t[1] for t in ref.INSTITUTION_TYPES]
        years = list(range(2007, self.anchor.year + 1))
        year_weights = [3.0 if 2008 <= y <= 2013 else 1.4 if y <= 2019 else 1.0 for y in years]
        names: set[str] = set()
        out: list[_Inst] = []

        out.append(self._demo_institution())
        names.add(out[0].name)
        out.append(self._release_story_institution())
        names.add(out[1].name)

        while len(out) < self.n_institutions:
            region_code, state, _, cities = rng.choices(states, weights)[0]
            city = rng.choice(cities)
            type_label, _, programmes = rng.choices(ref.INSTITUTION_TYPES, type_weights)[0]
            prefix = rng.choice(ref.NAME_PREFIXES)
            name = f"{prefix} {type_label}, {city}"
            if name in names:
                continue
            names.add(name)
            established = rng.choices(years, year_weights)[0]
            ownership = rng.choices(
                [Ownership.PRIVATE, Ownership.GOVERNMENT, Ownership.AIDED], [85, 10, 5]
            )[0]
            premises = (
                Premises.LEASED
                if ownership == Ownership.PRIVATE and rng.random() < 0.12
                else Premises.OWN
            )
            progs: list[tuple[str, str, int]] = []
            for disc, level, prob in programmes:
                if rng.random() < prob:
                    added = (
                        established
                        if prob >= 1 or rng.random() < 0.6
                        else min(self.anchor.year, established + rng.randint(2, 7))
                    )
                    progs.append((disc, level, added))
            inst = _Inst(
                id=0,
                name=name,
                trust=rng.choice(ref.TRUST_PATTERNS).format(p=prefix),
                region_code=region_code,
                region_id=self.region_ids[region_code],
                city=city,
                state=state,
                ownership=ownership,
                premises=premises,
                established=established,
                type_label=type_label,
                programmes=progs,
            )
            inst.complaint_open = rng.random() < 0.06
            inst.dispute = rng.random() < 0.004
            out.append(inst)

        for inst in out:
            inst.id = self.ds.add(
                "institutions",
                {
                    "aicte_id": f"1-{self.rng.randint(10_000_000, 99_999_999)}",
                    "name": inst.name,
                    "trust_name": inst.trust,
                    "region_id": inst.region_id,
                    "state": inst.state,
                    "district": inst.city,
                    "city": inst.city,
                    "premises": inst.premises.value,
                    "ownership": inst.ownership.value,
                    "established_year": inst.established,
                    "status": "operating",
                    "flags": {
                        "complaint_open": inst.complaint_open,
                        "dispute_lien": inst.dispute,
                        "embezzlement_noc_pending": False,
                    },
                },
            )
            for disc, level, year in inst.programmes:
                self.ds.add(
                    "programmes",
                    {
                        "institution_id": inst.id,
                        "discipline": disc,
                        "level": level,
                        "intake": self.rng.choice([60, 120, 180, 240, 300])
                        if level != "pg"
                        else self.rng.choice([18, 24, 30, 60]),
                        "approved_from": date(year, 7, 1),
                    },
                )
        return out

    def _demo_institution(self) -> _Inst:
        return _Inst(
            0,
            "Demo Institute of Technology, Pune",
            "Demo Education Society",
            "western",
            self.region_ids["western"],
            "Pune",
            "Maharashtra",
            Ownership.PRIVATE,
            Premises.OWN,
            self.anchor.year - 10,
            "Institute of Technology",
            [
                ("engineering_technology", "ug", self.anchor.year - 10),
                ("engineering_technology", "pg", self.anchor.year - 5),
            ],
        )

    def _release_story_institution(self) -> _Inst:
        inst = _Inst(
            0,
            "Sahyadri College of Engineering, Nashik",
            "Sahyadri Education Society",
            "western",
            self.region_ids["western"],
            "Nashik",
            "Maharashtra",
            Ownership.PRIVATE,
            Premises.OWN,
            self.anchor.year - 11,
            "College of Engineering",
            [("engineering_technology", "ug", self.anchor.year - 11)],
        )
        inst.complaint_open = True
        return inst

    # ---------------------------------------------------------------- instruments
    def deposits(self, insts: list[_Inst]) -> None:
        for inst in insts:
            if inst.ownership != Ownership.PRIVATE:
                continue
            by_year: dict[int, list[ProgrammeLevel]] = defaultdict(list)
            for disc, level, year in inst.programmes:
                by_year[year].append(ProgrammeLevel(disc, level))  # type: ignore[arg-type]
            first_maturity: date | None = None
            for year in sorted(by_year):
                is_new = year == inst.established
                demand = compute_demand(
                    by_year[year],
                    inst.premises,
                    inst.ownership,
                    0 if is_new else year - inst.established,
                    True,
                    RULES.demand,
                )
                if demand.exempt or demand.total_paise == 0:
                    continue
                intimated = self._intimation_date(year)
                if intimated is None:
                    continue
                first_maturity = self._instrument_for_demand(
                    inst, demand, intimated, is_new, first_maturity
                )

    _MONTH_WEIGHTS = (3, 3, 4, 10, 12, 12, 9, 6, 5, 5, 4, 3)

    def _intimation_date(self, year: int) -> date | None:
        """Approvals cluster in April to July but happen all year. Demands that would fall after
        the anchor in the current year are pulled into the last few weeks instead, which keeps a
        realistic stream of fresh submissions in the verification queue."""
        month = self.rng.choices(range(1, 13), self._MONTH_WEIGHTS)[0]
        d = date(year, month, self.rng.randint(1, 28))
        if d <= self.anchor:
            return d
        if year == self.anchor.year and self.rng.random() < 0.8:
            return self.anchor - timedelta(days=self.rng.randint(3, 45))
        return None

    def _instrument_for_demand(
        self, inst: _Inst, demand: Any, intimated: date, is_new: bool, first_maturity: date | None
    ) -> date | None:
        rng = self.rng
        lag = rng.choice([rng.randint(3, 14)] * 9 + [rng.randint(16, 70)])
        furnished = intimated + timedelta(days=lag)
        furnished_on = None if furnished > self.anchor else furnished
        demand_id = self.ds.add(
            "demands",
            {
                "institution_id": inst.id,
                "reason": "new_institution" if is_new else "new_programme",
                "lines": [
                    {
                        "discipline": line.discipline,
                        "level": line.level,
                        "base_paise": line.base_paise,
                        "multiplier": line.multiplier,
                        "amount_paise": line.amount_paise,
                        "note": line.note,
                    }
                    for line in demand.lines
                ],
                "amount_paise": demand.total_paise,
                "leased_multiplier": 2 if inst.premises == Premises.LEASED else 1,
                "rule_code": RULES.demand.ref.code,
                "rule_version": RULES.demand.ref.version,
                "intimated_on": intimated,
                "due_on": intimated + timedelta(days=15),
                "furnished_on": furnished_on,
                "status": "furnished" if furnished_on else "open",
            },
        )
        if furnished_on is None:
            return first_maturity

        kind = InstrumentKind.JOINT_FDR
        if intimated.year >= 2020 and rng.random() < 0.10:
            kind = InstrumentKind.RTGS
        elif intimated.year <= 2014 and rng.random() < 0.10:
            kind = InstrumentKind.RPGF
        tenure_years = 8 if intimated.year <= 2011 and rng.random() < 0.25 else 10
        issue = furnished_on - timedelta(days=rng.randint(0, 3))
        maturity = (
            issue.replace(year=issue.year + tenure_years)
            if not (issue.month == 2 and issue.day == 29)
            else date(issue.year + tenure_years, 2, 28)
        )
        if not is_new and first_maturity and first_maturity > issue:
            maturity = first_maturity  # top-up for the remaining period (Clause 1.12 iii)
        self._create_instrument(
            inst, demand_id, kind, demand.total_paise, issue, maturity, furnished_on, None
        )
        return first_maturity or maturity

    def _number(self, bank_id: int, kind: InstrumentKind, issue: date) -> str:
        while True:
            if kind == InstrumentKind.RTGS:
                n = f"UTR{issue:%Y%m%d}{self.rng.randint(10**7, 10**8 - 1)}"
            else:
                n = f"{self.rng.randint(100, 999)}{issue:%y}{self.rng.randint(10**7, 10**8 - 1)}"
            if (bank_id, n) not in self.numbers:
                self.numbers.add((bank_id, n))
                return n

    def _create_instrument(
        self,
        inst: _Inst,
        demand_id: int | None,
        kind: InstrumentKind,
        amount: int,
        issue: date,
        maturity: date,
        submitted: date,
        predecessor_id: int | None,
    ) -> int:
        rng = self.rng
        anchor = self.anchor
        bank_code = rng.choice([b.code for b in ref.BANKS])
        if inst.name.startswith("Demo Institute"):
            bank_code = "BHNX"
        bank_id = self.bank_ids[bank_code]
        branch_code = rng.randint(100000, 999999)
        ifsc = f"{bank_code}0{branch_code}"
        area = rng.choice(
            ["Main", "Camp", "Station Road", "Civil Lines", "MG Road", "Industrial Area"]
        )
        branch = f"{inst.city} {area}"
        number = self._number(bank_id, kind, issue)
        holders = f"Member Secretary, AICTE; Secretary, {inst.trust}"
        rate = round(rng.uniform(5.25, 8.1), 2)
        tenure_months = (maturity.year - issue.year) * 12 + (maturity.month - issue.month)

        verified = submitted + timedelta(days=rng.randint(4, 45))
        f = dict(
            verified_on=verified if verified <= anchor else None,
            returned_on=None,
            release_requested_on=None,
            release_cleared_on=None,
            released_on=None,
            renewed_on=None,
            encashed_on=None,
            forfeited_on=None,
            lien_hold_since=None,
            lien_lifted_on=None,
        )
        # Very recent submissions stay in the queue.
        if (anchor - submitted).days <= 21 and rng.random() < 0.85:
            f["verified_on"] = None

        # Outcomes after maturity.
        outcome = None
        if maturity <= anchor and f["verified_on"] and not inst.name.startswith("Demo Institute"):
            recent = (anchor - maturity).days < 150
            outcome = rng.choices(
                ["released", "renewed", "unclaimed", "pending_release", "cleared", "lien"],
                [15, 5, 45, 30, 4, 1]
                if recent
                else [78, 9, 8, 3, 1, 1]
                if (anchor - maturity).days < 1100
                else [92, 4, 2, 1, 0, 1],
            )[0]
            if (anchor - maturity).days > 900 and outcome in ("pending_release", "cleared"):
                outcome = "released"
            if inst.dispute:
                outcome = "lien"
            if inst.name.startswith("Sahyadri College of Engineering, Nashik"):
                outcome = "pending_release"
            if outcome in ("released", "pending_release", "cleared"):
                req = maturity + timedelta(days=rng.randint(5, 140))
                if req > anchor:
                    req = anchor - timedelta(days=rng.randint(1, 10))
                f["release_requested_on"] = req
                if outcome in ("released", "cleared"):
                    cleared = req + timedelta(days=rng.randint(15, 70))
                    if cleared <= anchor:
                        f["release_cleared_on"] = cleared
                        if outcome == "released":
                            done = cleared + timedelta(days=rng.randint(5, 30))
                            if done <= anchor:
                                f["released_on"] = done
            elif outcome == "renewed":
                f["renewed_on"] = maturity
            elif outcome == "lien":
                f["lien_hold_since"] = maturity - timedelta(days=rng.randint(30, 400))
        elif f["verified_on"] and rng.random() < 0.006 and maturity > anchor:
            encashed = issue + timedelta(days=rng.randint(400, 2000))
            f["encashed_on"] = encashed if encashed <= anchor else None
        if (
            inst.dispute
            and f["lien_hold_since"] is None
            and f["verified_on"]
            and maturity > anchor - timedelta(days=400)
        ):
            f["lien_hold_since"] = anchor - timedelta(days=rng.randint(20, 300))

        # Evidence.
        ev: dict[str, date | None] = dict(
            document_checked_on=None,
            bank_confirmed_on=None,
            last_confirmed_on=None,
            conflict_since=None,
            conflict_resolved_on=None,
            high_signal_since=None,
            high_signal_resolved_on=None,
        )
        digital = submitted >= date(2019, 7, 1)
        if digital or rng.random() < 0.35:
            ev["document_checked_on"] = (
                submitted + timedelta(days=1)
                if digital
                else submitted + timedelta(days=rng.randint(200, 900))
            )
            if ev["document_checked_on"] and ev["document_checked_on"] > anchor:
                ev["document_checked_on"] = None
        held_now = f["released_on"] is None and f["renewed_on"] is None and f["encashed_on"] is None
        confirm_p = 0.66 if held_now else 0.5
        if f["verified_on"] and rng.random() < confirm_p:
            if submitted >= date(2023, 1, 1):
                c = f["verified_on"] + timedelta(days=rng.randint(2, 20))
            else:
                c = max(f["verified_on"], anchor - timedelta(days=rng.randint(40, 620)))
            if c <= anchor:
                ev["bank_confirmed_on"] = c
                ev["last_confirmed_on"] = c
                if (anchor - c).days > 200 and rng.random() < 0.3:
                    ev["last_confirmed_on"] = anchor - timedelta(days=rng.randint(10, 300))
        if inst.name.startswith("Demo Institute") and predecessor_id is None and demand_id:
            ev["bank_confirmed_on"] = f["verified_on"] or submitted
            ev["last_confirmed_on"] = ev["bank_confirmed_on"]

        # Deliberate mismatches with the bank's record.
        bank_record: dict[str, Any] = dict(
            holders=holders, amount=amount, issue=issue, maturity=maturity, lien=True
        )
        conflict_field: str | None = None
        if (
            held_now
            and ev["bank_confirmed_on"]
            and rng.random() < 0.03
            and not inst.name.startswith(("Demo", "Sahyadri College of Engineering, Nashik"))
        ):
            conflict_field = rng.choice(["amount", "maturity_date", "lien", "holders"])
            if conflict_field == "amount":
                bank_record["amount"] = amount - rng.choice([5, 10]) * 100_000 * 100
                if bank_record["amount"] <= 0:
                    bank_record["amount"] = amount // 2
            elif conflict_field == "maturity_date":
                bank_record["maturity"] = maturity - timedelta(days=rng.choice([365, 730, 1826]))
            elif conflict_field == "lien":
                bank_record["lien"] = False
            else:
                bank_record["holders"] = f"Secretary, {inst.trust}"
            ev["conflict_since"] = ev["bank_confirmed_on"]

        facts = InstrumentFacts(
            id=self.ds.counters["instruments"] + 1,
            amount_paise=amount,
            maturity_date=maturity,
            region=inst.region_code,
            bank=bank_code,
            owner_id=None,
            submitted_on=submitted,
            evidence=EvidenceDates(**ev),
            **f,
        )
        status = status_on(facts, anchor, RULES) or Status.SUBMITTED
        owner = rng.choice(self.officers_by_region[inst.region_code])
        next_action, next_due = self._next_action(status, submitted, maturity)
        instrument_id = self.ds.add(
            "instruments",
            {
                "number": number,
                "kind": kind.value,
                "institution_id": inst.id,
                "demand_id": demand_id,
                "bank_id": bank_id,
                "branch": branch,
                "ifsc": ifsc,
                "amount_paise": amount,
                "interest_rate": rate,
                "issue_date": issue,
                "maturity_date": maturity,
                "tenure_months": tenure_months,
                "auto_renew": rng.random() < 0.4,
                "predecessor_id": predecessor_id,
                "status": status.value,
                "owner_id": owner,
                "next_action": next_action,
                "next_action_due": next_due,
                "submitted_on": submitted,
                **f,
                **ev,
            },
        )

        self.ds.add(
            "sim_bank_deposits",
            {
                "bank_id": bank_id,
                "number": number,
                "branch": branch,
                "ifsc": ifsc,
                "holders": bank_record["holders"],
                "amount_paise": bank_record["amount"],
                "issue_date": issue,
                "maturity_date": bank_record["maturity"],
                "lien_aicte": bank_record["lien"],
                "encumbrance": None,
                "status": "closed"
                if f["released_on"]
                else "encashed"
                if f["encashed_on"]
                else "matured"
                if maturity <= anchor
                else "live",
            },
        )
        self._observations(
            instrument_id,
            inst,
            bank_code,
            number,
            ifsc,
            amount,
            issue,
            maturity,
            holders,
            submitted,
            ev,
            bank_record,
        )
        self._lifecycle_events(instrument_id, inst, status, submitted, f, ev)
        if conflict_field:
            self.ds.add(
                "signals",
                {
                    "entity_type": "instrument",
                    "entity_id": instrument_id,
                    "code": "field_conflict",
                    "severity": "high",
                    "title": f"Bank record does not match on {conflict_field.replace('_', ' ')}",
                    "evidence": {"field": conflict_field},
                    "source": "provenance.compare",
                    "source_version": "1",
                    "status": "open",
                    "raised_on": ev["conflict_since"],
                    "resolution_note": None,
                    "resolved_by": None,
                    "resolved_on": None,
                },
            )
        if f["renewed_on"]:
            succ_issue = maturity
            succ_mat = succ_issue + timedelta(days=365 * rng.choice([1, 2, 3, 5]))
            self._create_instrument(
                inst,
                None,
                kind,
                amount,
                succ_issue,
                succ_mat,
                succ_issue + timedelta(days=rng.randint(1, 20)),
                instrument_id,
            )
        return instrument_id

    def _next_action(
        self, status: Status, submitted: date, maturity: date
    ) -> tuple[str | None, date | None]:
        return {
            Status.SUBMITTED: ("Scrutinise submission", submitted + timedelta(days=7)),
            Status.UNDER_SCRUTINY: ("Complete scrutiny", submitted + timedelta(days=10)),
            Status.DISCREPANCY: (
                "Resolve discrepancy with institution and bank",
                self.anchor + timedelta(days=7),
            ),
            Status.MATURING: ("Confirm renewal or release plan", maturity),
            Status.MATURED: ("Follow up release application", maturity + timedelta(days=15)),
            Status.RELEASE_REQUESTED: ("Track clearances", self.anchor + timedelta(days=10)),
            Status.RELEASE_CLEARED: ("Await bank lien discharge", self.anchor + timedelta(days=7)),
            Status.LIEN_HOLD: ("Review lien hold", self.anchor + timedelta(days=30)),
        }.get(status, (None, None))

    def _observations(
        self,
        iid: int,
        inst: _Inst,
        bank_code: str,
        number: str,
        ifsc: str,
        amount: int,
        issue: date,
        maturity: date,
        holders: str,
        submitted: date,
        ev: dict[str, date | None],
        bank: dict[str, Any],
    ) -> None:
        bank_name = next(b.name for b in ref.BANKS if b.code == bank_code)
        rupees = amount // 100
        declared = {
            FieldName.NUMBER: number,
            FieldName.BANK: bank_name,
            FieldName.IFSC: ifsc,
            FieldName.AMOUNT: f"Rs. {inr_grouped(rupees)}/-",
            FieldName.ISSUE_DATE: f"{issue:%d/%m/%Y}",
            FieldName.MATURITY_DATE: f"{maturity:%d/%m/%Y}",
            FieldName.HOLDERS: holders,
            FieldName.LIEN: "Yes",
        }
        self._obs_rows(iid, Source.DECLARED, declared, submitted, None, "user")
        if ev["document_checked_on"]:
            extracted = {
                FieldName.NUMBER: number,
                FieldName.BANK: bank_name.upper(),
                FieldName.IFSC: ifsc,
                FieldName.AMOUNT: f"{inr_grouped(rupees)}.00",
                FieldName.ISSUE_DATE: f"{issue:%d-%m-%Y}",
                FieldName.MATURITY_DATE: f"{maturity:%d-%m-%Y}",
                FieldName.HOLDERS: holders.upper(),
                FieldName.LIEN: "Lien marked in favour of AICTE",
            }
            self._obs_rows(
                iid, Source.EXTRACTED, extracted, ev["document_checked_on"], 0.97, "document"
            )
        if ev["bank_confirmed_on"]:
            confirmed = {
                FieldName.NUMBER: number,
                FieldName.BANK: bank_name,
                FieldName.IFSC: ifsc,
                FieldName.AMOUNT: f"{bank['amount'] // 100}.00",
                FieldName.ISSUE_DATE: bank["issue"].isoformat(),
                FieldName.MATURITY_DATE: bank["maturity"].isoformat(),
                FieldName.HOLDERS: bank["holders"],
                FieldName.LIEN: "yes" if bank["lien"] else "no",
            }
            self._obs_rows(
                iid, Source.CONFIRMED, confirmed, ev["bank_confirmed_on"], None, "bank_message"
            )

    def _obs_rows(
        self,
        iid: int,
        source: Source,
        values: dict[FieldName, str],
        on: date,
        confidence: float | None,
        evidence_type: str,
    ) -> None:
        for fld, raw in values.items():
            self.ds.add(
                "field_observations",
                {
                    "instrument_id": iid,
                    "field": fld.value,
                    "source": source.value,
                    "value_raw": raw,
                    "value_norm": normalise(fld, raw),
                    "confidence": confidence,
                    "evidence_type": evidence_type,
                    "evidence_id": None,
                    "actor_id": None,
                    "observed_on": on,
                    "note": None,
                },
            )

    def _lifecycle_events(
        self,
        iid: int,
        inst: _Inst,
        status: Status,
        submitted: date,
        f: dict[str, date | None],
        ev: dict[str, date | None],
    ) -> None:
        def event(kind: str, on: date | None, actor: str, **payload: Any) -> None:
            if on is None or on > self.anchor:
                return
            self.events.append(
                {
                    "entity_type": "instrument",
                    "entity_id": iid,
                    "type": kind,
                    "payload": payload,
                    "occurred_on": on,
                    "actor": actor,
                }
            )

        event("instrument.submitted", submitted, "institution", institution=inst.name)
        event("instrument.document_checked", ev["document_checked_on"], "system")
        event("instrument.verified", f["verified_on"], "officer")
        event("bank.confirmed", ev["bank_confirmed_on"], "bank")
        if ev["last_confirmed_on"] != ev["bank_confirmed_on"]:
            event("bank.reconfirmed", ev["last_confirmed_on"], "bank")
        event("instrument.discrepancy", ev["conflict_since"], "system")
        event("release.requested", f["release_requested_on"], "institution")
        event("release.cleared", f["release_cleared_on"], "authority")
        event("instrument.released", f["released_on"], "bank")
        event("instrument.renewed", f["renewed_on"], "system")
        event("instrument.encashed_prematurely", f["encashed_on"], "bank")
        event("instrument.lien_hold", f["lien_hold_since"], "section_head")

    # ---------------------------------------------------------------- workflow tables
    def workflow(self, insts: list[_Inst]) -> None:
        rng = self.rng
        anchor = self.anchor
        by_id = {i.id: i for i in insts}
        categories = (
            "Fee refund delay",
            "Faculty salary not paid",
            "Infrastructure shortfall",
            "Admission irregularity",
            "Certificates withheld",
        )
        for inst in insts:
            if inst.complaint_open:
                self.ds.add(
                    "complaints",
                    {
                        "institution_id": inst.id,
                        "reference": f"PGRC/{anchor.year}/{rng.randint(10000, 99999)}-{inst.id}",
                        "cell": "pgrc",
                        "category": rng.choice(categories),
                        "status": "open",
                        "opened_on": anchor - timedelta(days=rng.randint(10, 200)),
                        "closed_on": None,
                    },
                )
            if rng.random() < 0.12:
                opened = anchor - timedelta(days=rng.randint(200, 2000))
                self.ds.add(
                    "complaints",
                    {
                        "institution_id": inst.id,
                        "reference": f"PGRC/{opened.year}/{rng.randint(10000, 99999)}-{inst.id}c",
                        "cell": "pgrc",
                        "category": rng.choice(categories),
                        "status": "closed",
                        "opened_on": opened,
                        "closed_on": opened + timedelta(days=rng.randint(20, 120)),
                    },
                )

        sec_head = self.persona_ids["section_head"]
        cell_users = {
            "pgrc": self.persona_ids["pgrc"],
            "vigilance": self.persona_ids["vigilance"],
            "grants": self.persona_ids["grants"],
        }
        for inst_row in self.ds.rows["instruments"]:
            req = inst_row["release_requested_on"]
            if not req:
                continue
            inst = by_id[inst_row["institution_id"]]
            cleared = inst_row["release_cleared_on"]
            released = inst_row["released_on"]
            status = "closed" if released else "authorised" if cleared else "in_clearance"
            case_id = self.ds.add(
                "release_cases",
                {
                    "reference": f"REL/{req:%Y}/{inst_row['id']:06d}",
                    "institution_id": inst.id,
                    "kind": inst_row["kind"],
                    "status": status,
                    "documents": [
                        "application_letter",
                        "affidavit_6",
                        "instrument_copy",
                        "latest_loa_eoa",
                    ]
                    if rng.random() < 0.85 or cleared
                    else ["application_letter", "instrument_copy"],
                    "penalty": {},
                    "applied_on": req,
                    "authorised_by": self.persona_ids["authority"] if cleared else None,
                    "authorised_on": cleared,
                    "closed_on": released,
                },
            )
            self.ds.rows["release_case_instruments"].append(
                {"release_case_id": case_id, "instrument_id": inst_row["id"]}
            )
            for cell in ("pgrc", "vigilance", "grants"):
                if cleared:
                    st, decided = "cleared", req + timedelta(days=rng.randint(5, 40))
                elif cell == "pgrc" and inst.complaint_open:
                    st, decided = "pending", None
                else:
                    st = rng.choices(["cleared", "pending", "blocked"], [55, 40, 5])[0]
                    decided = req + timedelta(days=rng.randint(3, 30)) if st != "pending" else None
                    if decided and decided > anchor:
                        st, decided = "pending", None
                self.ds.add(
                    "clearances",
                    {
                        "release_case_id": case_id,
                        "cell": cell,
                        "status": st,
                        "officer_id": cell_users[cell] if st != "pending" else None,
                        "reason": "Grant utilisation certificate outstanding"
                        if st == "blocked"
                        else None,
                        "decided_on": decided,
                    },
                )
            if status == "in_clearance":
                rows = [c for c in self.ds.rows["clearances"] if c["release_case_id"] == case_id]
                if any(c["status"] == "blocked" for c in rows):
                    self.ds.rows["release_cases"][-1]["status"] = "blocked"
        _ = sec_head

        for inst_row in self.ds.rows["instruments"]:
            maturity = inst_row["maturity_date"]
            status = inst_row["status"]
            if status in ("matured", "renewal_pending"):
                days = (anchor - maturity).days
                level = "dealing_officer"
                for threshold, name in RULES.escalation.ladder:
                    if days >= threshold:
                        level = name
                self.ds.add(
                    "escalations",
                    {
                        "entity_type": "instrument",
                        "entity_id": inst_row["id"],
                        "level": level,
                        "raised_on": maturity,
                        "resolved_on": None,
                    },
                )
            if (
                status in ("active", "maturing", "matured")
                and -120 <= (maturity - anchor).days <= 95
            ):
                for offset in RULES.maturity.reminder_offsets_days:
                    due = maturity - timedelta(days=offset)
                    if anchor - timedelta(days=120) <= due <= anchor:
                        self.ds.add(
                            "reminders",
                            {
                                "instrument_id": inst_row["id"],
                                "rule_code": RULES.maturity.ref.code,
                                "offset_days": offset,
                                "channel": "email",
                                "recipient": "accounts@institution.demo",
                                "due_on": due,
                                "sent_on": due,
                                "status": "sent",
                            },
                        )

    def bank_history(self) -> None:
        """Signed bank messages behind every seeded confirmation, so each one can be verified."""
        from app.services.bank import canonical_json, sign

        keys = {k["bank_id"]: k for k in self.ds.rows["sim_bank_keys"]}
        codes = {v: k for k, v in self.bank_ids.items()}
        records = {(r["bank_id"], r["number"]): r for r in self.ds.rows["sim_bank_deposits"]}
        for inst in self.ds.rows["instruments"]:
            dates = [inst["bank_confirmed_on"]]
            if inst["last_confirmed_on"] and inst["last_confirmed_on"] != inst["bank_confirmed_on"]:
                dates.append(inst["last_confirmed_on"])
            for i, on in enumerate(d for d in dates if d):
                rec = records.get((inst["bank_id"], inst["number"]))
                if rec is None:
                    continue
                req_id = self.ds.add(
                    "bank_requests",
                    {
                        "instrument_id": inst["id"],
                        "bank_id": inst["bank_id"],
                        "kind": "confirm" if i == 0 else "reconfirm",
                        "adapter": "simulated_network",
                        "status": "answered",
                        "requested_by": None,
                        "requested_on": on,
                        "payload": {
                            "number": inst["number"],
                            "ifsc": inst["ifsc"],
                            "amount_paise": inst["amount_paise"],
                            "kind": "confirm",
                        },
                    },
                )
                payload = {
                    "message_type": "deposit_confirmation",
                    "request_id": req_id,
                    "bank_code": codes[inst["bank_id"]],
                    "result": "found",
                    "number": rec["number"],
                    "branch": rec["branch"],
                    "ifsc": rec["ifsc"],
                    "holders": rec["holders"],
                    "amount": f"{rec['amount_paise'] // 100}.{rec['amount_paise'] % 100:02d}",
                    "issue_date": rec["issue_date"].isoformat(),
                    "maturity_date": rec["maturity_date"].isoformat(),
                    "lien_in_favour_of_aicte": "yes" if rec["lien_aicte"] else "no",
                    "encumbrance": "none",
                    "deposit_status": "live",
                    "responded_at": f"{on.isoformat()}T11:00:00+00:00",
                }
                key = keys[inst["bank_id"]]
                self.ds.add(
                    "bank_messages",
                    {
                        "request_id": req_id,
                        "bank_id": inst["bank_id"],
                        "payload": payload,
                        "canonical": canonical_json(payload).decode(),
                        "signature_b64": sign(key["private_key_b64"], payload),
                        "key_id": key["key_id"],
                        "signature_valid": True,
                        "received_on": on,
                    },
                )

    def rules_and_version(self) -> None:
        from app.services.facts import default_rule_rows

        for row in default_rule_rows():
            self.ds.add("rules", {**row, "effective_from": date(2024, 4, 1), "created_by": None})
        self.ds.rows["data_version"].append(
            {
                "id": 1,
                "version": time_ns() // 1_000_000,  # new cache key on every seed
                "seed_label": f"synthetic seed {self.seed}",
                "anchor_date": self.anchor,
            }
        )

    def audit_trail(self) -> None:
        actor_ids = {
            "officer": self.persona_ids["bureau"],
            "authority": self.persona_ids["authority"],
            "section_head": self.persona_ids["section_head"],
            "bank": None,
            "system": None,
            "institution": None,
        }
        labels = {
            "officer": "Ananya Iyer (bureau_officer)",
            "authority": "Dr. Sunita Rao (approving_authority)",
            "section_head": "Rajeev Menon (section_head)",
            "bank": "Simulated bank network",
            "system": "Pramaan system",
            "institution": "Institution user",
        }
        prev = GENESIS
        self.events.sort(key=lambda e: (e["occurred_on"], e["entity_id"], e["type"]))
        for i, ev in enumerate(self.events):
            at = datetime.combine(ev["occurred_on"], time(10, 0), tzinfo=UTC) + timedelta(
                seconds=i % 28800
            )
            actor_id = actor_ids[ev["actor"]]
            data = {"type": ev["type"], **ev["payload"]}
            h = chain_hash(
                prev, canonical(at, actor_id, ev["type"], "instrument", ev["entity_id"], data)
            )
            self.ds.add(
                "audit_log",
                {
                    "at": at,
                    "actor_id": actor_id,
                    "actor_label": labels[ev["actor"]],
                    "action": ev["type"],
                    "entity_type": "instrument",
                    "entity_id": ev["entity_id"],
                    "data": data,
                    "prev_hash": prev,
                    "hash": h,
                    "note": None,
                },
            )
            prev = h
            self.ds.add(
                "events",
                {
                    "entity_type": ev["entity_type"],
                    "entity_id": ev["entity_id"],
                    "type": ev["type"],
                    "payload": ev["payload"],
                    "actor_id": actor_id,
                    "occurred_on": ev["occurred_on"],
                },
            )

    def build(self, password_hash: str) -> Dataset:
        self.regions_and_banks()
        self.users(password_hash)
        insts = self.institutions()
        demo = next(i for i in insts if i.name.startswith("Demo Institute"))
        self.ds.rows["users"].append(
            {
                "id": self.ds.counters["users"] + 1,
                "email": "vikram.deshmukh@demoinstitute.demo",
                "name": "Vikram Deshmukh",
                "designation": "Accounts Officer, Demo Education Society",
                "password_hash": password_hash,
                "role": "institution_user",
                "persona_key": "institution",
                "region_id": None,
                "institution_id": demo.id,
                "bank_id": None,
                "cell": None,
                "is_active": True,
                "failed_logins": 0,
            }
        )
        self.ds.counters["users"] += 1
        self.persona_ids["institution"] = self.ds.counters["users"]
        self.deposits(insts)
        self._shape_demo_story(demo)
        self._open_demand_story(demo)
        self.workflow(insts)
        self.bank_history()
        self.rules_and_version()
        self.audit_trail()
        return self.ds

    def _open_demand_story(self, demo: _Inst) -> None:
        """A programme approved this week leaves the demo institution with an open demand, and the
        simulated bank holds the genuine record of the specimen receipt shipped in demo_assets."""
        intimated = self.anchor - timedelta(days=5)
        self.ds.add(
            "programmes",
            {
                "institution_id": demo.id,
                "discipline": "computer_applications",
                "level": "pg",
                "intake": 60,
                "approved_from": intimated,
            },
        )
        demand = compute_demand(
            [ProgrammeLevel("computer_applications", "pg")],
            demo.premises,
            demo.ownership,
            0,
            True,
            RULES.demand,
        )
        line = demand.lines[0]
        self.ds.add(
            "demands",
            {
                "institution_id": demo.id,
                "reason": "new_programme",
                "lines": [
                    {
                        "discipline": line.discipline,
                        "level": line.level,
                        "base_paise": line.base_paise,
                        "multiplier": line.multiplier,
                        "amount_paise": line.amount_paise,
                        "note": line.note,
                    }
                ],
                "amount_paise": demand.total_paise,
                "leased_multiplier": 1,
                "rule_code": RULES.demand.ref.code,
                "rule_version": RULES.demand.ref.version,
                "intimated_on": intimated,
                "due_on": intimated + timedelta(days=15),
                "furnished_on": None,
                "status": "open",
            },
        )
        spec = json.loads(
            (Path(__file__).resolve().parents[1] / "demo_assets" / "specimen.json").read_text()
        )
        self.ds.add(
            "sim_bank_deposits",
            {
                "bank_id": self.bank_ids[spec["bank"]],
                "number": spec["number"],
                "branch": spec["branch"],
                "ifsc": spec["ifsc"],
                "holders": spec["holders"],
                "amount_paise": spec["amount_rupees"] * 100,
                "issue_date": date.fromisoformat(spec["issue"]),
                "maturity_date": date.fromisoformat(spec["maturity"]),
                "lien_aicte": True,
                "encumbrance": None,
                "status": "live",
            },
        )

    def _shape_demo_story(self, demo: _Inst) -> None:
        """The demo institution's FDRs mature about 85 days from the anchor: the T-90 reminder has
        gone out and renewal is open, so the story is visible on day one."""
        target = self.anchor + timedelta(days=85)
        for row in self.ds.rows["instruments"]:
            if row["institution_id"] == demo.id:
                row["maturity_date"] = target
                row["status"] = (
                    Status.ACTIVE.value
                    if (target - self.anchor).days > RULES.maturity.maturing_window_days
                    else Status.MATURING.value
                )
                row["next_action"], row["next_action_due"] = (
                    "Confirm renewal or release plan",
                    target,
                )
        for sim in self.ds.rows["sim_bank_deposits"]:
            inst_ids = {
                r["number"]: r["institution_id"]
                for r in self.ds.rows["instruments"]
                if r["institution_id"] == demo.id
            }
            if sim["number"] in inst_ids:
                sim["maturity_date"] = target
        demo_ids = {r["id"] for r in self.ds.rows["instruments"] if r["institution_id"] == demo.id}
        for obs in self.ds.rows["field_observations"]:
            if obs["instrument_id"] in demo_ids and obs["field"] == "maturity_date":
                raw = {
                    "declared": f"{target:%d/%m/%Y}",
                    "extracted": f"{target:%d-%m-%Y}",
                    "confirmed": target.isoformat(),
                }[obs["source"]]
                obs["value_raw"], obs["value_norm"] = raw, target.isoformat()
