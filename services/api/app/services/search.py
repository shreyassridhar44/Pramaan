"""Plain-language search for the registry (PROJECT.md F12, R10).

An officer's sentence becomes registry filters. With Bedrock enabled, Claude fills a tool whose
schema allows only the registry's real values; the output is validated before use. Without it, or
when the call fails, a deterministic parser does the same job. Either way the officer sees the
interpreted filters as chips and applies them; nothing runs unseen. Only the typed sentence is sent
to the model, never records.
"""

import calendar
import json
import logging
import re
from dataclasses import dataclass, field
from datetime import date, timedelta
from functools import cache
from typing import Any, Literal, get_args

from pydantic import BaseModel, Field, ValidationError

from app.config import get_settings

log = logging.getLogger("pramaan.search")

Kind = Literal["joint_fdr", "rpgf", "rtgs"]
StatusName = Literal[
    "submitted",
    "under_scrutiny",
    "returned",
    "discrepancy",
    "active",
    "maturing",
    "matured",
    "renewal_pending",
    "renewed",
    "release_requested",
    "release_cleared",
    "released",
    "lien_hold",
    "forfeited",
    "encashed_prematurely",
]


class Filters(BaseModel):
    q: str | None = Field(default=None, max_length=120)
    region: list[str] = Field(default_factory=list)
    bank: list[str] = Field(default_factory=list)
    kind: list[Kind] = Field(default_factory=list)
    status: list[StatusName] = Field(default_factory=list)
    assurance: list[int] = Field(default_factory=list)
    maturity_from: date | None = None
    maturity_to: date | None = None
    has_signals: bool | None = None


@dataclass
class Interpretation:
    filters: Filters
    source: Literal["model", "rules"]
    unrecognised: list[str] = field(default_factory=list)
    note: str | None = None


# Reference values


REGIONS: dict[str, tuple[str, ...]] = {
    # Longer aliases are matched first, so "west bengal" never reads as "west".
    "north_western": (
        "north-western",
        "north western",
        "northwestern",
        "north-west",
        "north west",
        "northwest",
        "chandigarh",
        "punjab",
        "haryana",
        "rajasthan",
        "delhi",
        "himachal",
        "jammu",
        "kashmir",
    ),
    "north_east": (
        "north-east",
        "north east",
        "northeast",
        "guwahati",
        "assam",
        "meghalaya",
        "tripura",
        "manipur",
        "mizoram",
        "nagaland",
        "arunachal",
        "sikkim",
    ),
    "south_central": ("south-central", "south central", "hyderabad", "telangana", "andhra"),
    "south_western": (
        "south-western",
        "south western",
        "southwestern",
        "south-west",
        "south west",
        "southwest",
        "bengaluru",
        "bangalore",
        "karnataka",
    ),
    "eastern": (
        "eastern",
        "east region",
        "kolkata",
        "west bengal",
        "bengal",
        "odisha",
        "orissa",
        "jharkhand",
        "east",
    ),
    "western": ("western", "west region", "mumbai", "maharashtra", "goa", "west"),
    "northern": (
        "northern",
        "north region",
        "kanpur",
        "uttar pradesh",
        "uttarakhand",
        "bihar",
        "lucknow",
        "north",
    ),
    "central": ("central", "bhopal", "madhya pradesh", "chhattisgarh"),
    "southern": ("southern", "south region", "chennai", "tamil nadu", "puducherry", "south"),
    "kerala": ("kerala", "thiruvananthapuram", "kochi"),
    "gujarat": ("gujarat", "vadodara", "ahmedabad", "surat"),
}
REGION_NAMES = {
    "north_western": "North-Western",
    "north_east": "North-East",
    "south_central": "South-Central",
    "south_western": "South-Western",
    "eastern": "Eastern",
    "western": "Western",
    "northern": "Northern",
    "central": "Central",
    "southern": "Southern",
    "kerala": "Kerala",
    "gujarat": "Gujarat",
}
BANKS: dict[str, str] = {
    "BHNX": "Bharat National Bank",
    "DCCX": "Deccan Cooperative Bank",
    "SAHX": "Sahyadri Bank",
    "GGBX": "Ganga Gramin Bank",
    "VCBX": "Vindhya Commercial Bank",
    "KMBX": "Konkan Mercantile Bank",
    "NARX": "Narmada Bank",
    "MFBX": "Malabar Federal Bank",
    "HUBX": "Himalayan Union Bank",
    "KTBX": "Kaveri Trust Bank",
    "ARVX": "Aravalli Bank",
    "BRPX": "Brahmaputra Bank",
}
# Real banks people will type; this synthetic portfolio does not include them.
OUTSIDE_PORTFOLIO = (
    "sbi",
    "state bank",
    "hdfc",
    "icici",
    "axis",
    "pnb",
    "punjab national",
    "canara",
    "bank of baroda",
    "bob",
    "kotak",
    "union bank",
    "indian bank",
    "bank of india",
)
STATUS_WORDS: list[tuple[str, tuple[str, ...]]] = [
    ("matured without action", ("matured",)),
    ("past maturity", ("matured",)),
    ("unclaimed", ("matured",)),
    ("overdue", ("matured",)),
    ("matured", ("matured",)),
    ("renewal pending", ("renewal_pending",)),
    ("release requested", ("release_requested",)),
    ("release pending", ("release_requested",)),
    ("cleared for release", ("release_cleared",)),
    ("awaiting discharge", ("release_cleared",)),
    ("pending verification", ("submitted", "under_scrutiny")),
    ("awaiting verification", ("submitted", "under_scrutiny")),
    ("awaiting scrutiny", ("submitted", "under_scrutiny")),
    ("pending scrutiny", ("submitted", "under_scrutiny")),
    ("under scrutiny", ("under_scrutiny",)),
    ("unverified", ("submitted", "under_scrutiny")),
    ("not verified", ("submitted", "under_scrutiny")),
    ("new submissions", ("submitted",)),
    ("submitted", ("submitted",)),
    ("discrepancies", ("discrepancy",)),
    ("discrepancy", ("discrepancy",)),
    ("mismatch", ("discrepancy",)),
    ("conflict", ("discrepancy",)),
    ("returned", ("returned",)),
    ("renewed", ("renewed",)),
    ("released", ("released",)),
    ("lien hold", ("lien_hold",)),
    ("under lien", ("lien_hold",)),
    ("forfeited", ("forfeited",)),
    ("encashed", ("encashed_prematurely",)),
    ("about to mature", ("maturing",)),
    ("due for renewal", ("maturing",)),
    ("expiring", ("maturing",)),
    ("active", ("active",)),
]
ASSURANCE_WORDS: list[tuple[str, tuple[int, ...]]] = [
    ("without bank confirmation", (0, 1)),
    ("not bank confirmed", (0, 1)),
    ("not bank-confirmed", (0, 1)),
    ("not confirmed", (0, 1)),
    ("unconfirmed", (0, 1)),
    ("unproven", (0, 1)),
    ("not proven", (0, 1)),
    ("declared only", (0,)),
    ("only declared", (0,)),
    ("document-checked", (1,)),
    ("document checked", (1,)),
    ("re-confirmed", (3,)),
    ("reconfirmed", (3,)),
    ("bank-confirmed", (2, 3)),
    ("bank confirmed", (2, 3)),
    ("confirmed by the bank", (2, 3)),
    ("confirmed by bank", (2, 3)),
    ("proven", (2, 3)),
]
MONTHS = (
    {m.lower(): i for i, m in enumerate(calendar.month_name) if m}
    | {m.lower(): i for i, m in enumerate(calendar.month_abbr) if m}
    | {"sept": 9}
)
STOPWORDS = set(
    [
        "show",
        "me",
        "all",
        "the",
        "list",
        "find",
        "give",
        "get",
        "display",
        "any",
        "every",
        "deposits",
        "deposit",
        "instruments",
        "instrument",
        "receipts",
        "receipt",
        "records",
        "record",
        "that",
        "which",
        "are",
        "is",
        "be",
        "with",
        "in",
        "of",
        "for",
        "from",
        "to",
        "and",
        "or",
        "a",
        "an",
        "by",
        "whose",
        "held",
        "hold",
        "holding",
        "bank",
        "banks",
        "region",
        "regions",
        "zone",
        "office",
        "please",
        "what",
        "how",
        "many",
        "their",
        "its",
        "there",
        "where",
        "at",
        "on",
        "whose",
        "have",
        "has",
        "having",
        "maturity",
        "mature",
        "maturing",
        "matures",
        "due",
        "institutions",
        "institution",
        "colleges",
        "college",
        "fdrs",
        "fdr",
        "s",
        "still",
        "yet",
        "currently",
        "now",
        "than",
        "less",
        "more",
        "without",
        "renewal",
        "not",
        "no",
        "only",
        "plan",
    ]
)


# Deterministic parser


def _month_end(y: int, m: int) -> date:
    return date(y, m, calendar.monthrange(y, m)[1])


def _parse_month_year(text: str, today: date) -> tuple[date, date] | None:
    """'march 2027', 'mar 27', 'march' (next occurrence), '2027'."""
    t = text.strip()
    m = re.fullmatch(r"([a-z]+)\.?\s*,?\s*(\d{4}|'?\d{2})?", t)
    if m and m.group(1) in MONTHS:
        month = MONTHS[m.group(1)]
        if m.group(2):
            yy = m.group(2).lstrip("'")
            year = int(yy) + 2000 if len(yy) == 2 else int(yy)
        else:
            year = today.year if month >= today.month else today.year + 1
        return date(year, month, 1), _month_end(year, month)
    m = re.fullmatch(r"(\d{4})", t)
    if m:
        y = int(m.group(1))
        return date(y, 1, 1), date(y, 12, 31)
    return None


DATE_UNIT = r"(\d+)\s*(day|days|week|weeks|month|months|year|years)"
WHEN = r"([a-z]+\.?\s*,?\s*(?:\d{4}|'\d{2})?|\d{4})"


def _span_days(n: int, unit: str) -> int:
    return n * {"day": 1, "week": 7, "month": 30, "year": 365}[unit.rstrip("s")]


def _dates(text: str, today: date) -> tuple[date | None, date | None, str]:
    """Maturity range from the sentence, and the sentence with the date phrase removed."""
    rules: list[tuple[str, Any]] = [
        (rf"\bbetween\s+{WHEN}\s+and\s+{WHEN}", "between"),
        (rf"\b(?:in|within|over)\s+the\s+next\s+{DATE_UNIT}", "next"),
        (rf"\b(?:next|within|in)\s+{DATE_UNIT}", "next"),
        (rf"\b(?:last|past)\s+{DATE_UNIT}", "last"),
        (r"\bthis\s+month\b", "this_month"),
        (r"\bnext\s+month\b", "next_month"),
        (r"\bthis\s+year\b", "this_year"),
        (r"\bnext\s+year\b", "next_year"),
        (r"\b(?:by|before)\s+(?:the\s+)?(?:end\s+of\s+(?:the\s+)?year|year[\s-]end)\b", "year_end"),
        (rf"\bbefore\s+{WHEN}", "before"),
        (rf"\b(?:by|until|till|up\s+to)\s+{WHEN}", "by"),
        (rf"\bafter\s+{WHEN}", "after"),
        (rf"\b(?:from|since|starting)\s+{WHEN}", "from"),
        (rf"\b(?:in|during|for)\s+{WHEN}", "in"),
    ]
    for pattern, kind in rules:
        for m in re.finditer(pattern, text):
            start: date | None = None
            end: date | None = None
            if kind == "next":
                start, end = today, today + timedelta(days=_span_days(int(m.group(1)), m.group(2)))
            elif kind == "last":
                start, end = today - timedelta(days=_span_days(int(m.group(1)), m.group(2))), today
            elif kind == "this_month":
                start, end = date(today.year, today.month, 1), _month_end(today.year, today.month)
            elif kind == "next_month":
                y, mo = (today.year + 1, 1) if today.month == 12 else (today.year, today.month + 1)
                start, end = date(y, mo, 1), _month_end(y, mo)
            elif kind == "this_year":
                start, end = date(today.year, 1, 1), date(today.year, 12, 31)
            elif kind == "next_year":
                start, end = date(today.year + 1, 1, 1), date(today.year + 1, 12, 31)
            elif kind == "year_end":
                start, end = None, date(today.year, 12, 31)
            elif kind == "between":
                a, b = _parse_month_year(m.group(1), today), _parse_month_year(m.group(2), today)
                if not a or not b:
                    continue
                start, end = a[0], b[1]
            else:
                rng = _parse_month_year(m.group(1), today)
                if not rng:
                    continue
                if kind == "before":
                    start, end = None, rng[0] - timedelta(days=1)
                elif kind == "by":
                    start, end = None, rng[1]
                elif kind == "after":
                    start, end = rng[1] + timedelta(days=1), None
                elif kind == "from":
                    start, end = rng[0], None
                else:
                    start, end = rng
            rest = (text[: m.start()] + " " + text[m.end() :]).strip()
            return start, end, rest
    return None, None, text


def _take(text: str, phrase: str) -> tuple[bool, str]:
    pattern = rf"(?<![a-z0-9]){re.escape(phrase)}(?![a-z0-9])"
    if re.search(pattern, text):
        return True, re.sub(pattern, " ", text, count=1)
    return False, text


def parse(sentence: str, today: date) -> Interpretation:
    original = sentence.strip()
    text = " " + original.lower().replace("\u2019", "'") + " "
    f = Filters()
    unrecognised: list[str] = []

    quoted = re.search(r'"([^"]+)"', original)
    if quoted:
        f.q = quoted.group(1).strip()
        text = text.replace(quoted.group(0).lower(), " ")
    number = re.search(r"\b(\d{8,20}|1-\d{6,10}|utr[0-9a-z]+)\b", text)
    if number and not f.q:
        f.q = number.group(1).upper() if number.group(1).startswith("utr") else number.group(1)
        text = text.replace(number.group(1), " ")

    for code, name in BANKS.items():
        short = name.lower().removesuffix(" bank")
        # One-word short names (Narmada, Kaveri) are common in institution names, so only
        # two-word short names count without the word "bank".
        for alias in [name.lower(), code.lower()] + ([short] if " " in short else []):
            hit, text = _take(text, alias)
            if hit:
                f.bank.append(code)
                break
    for alias in OUTSIDE_PORTFOLIO:
        hit, text = _take(text, alias)
        if hit:
            unrecognised.append(
                f"{alias.upper() if len(alias) <= 4 else alias.title()} "
                "(not a bank in this portfolio)"
            )

    for code, aliases in REGIONS.items():
        # Consume every alias of the region, so "Punjab and Haryana" leaves nothing behind.
        for alias in sorted(aliases, key=len, reverse=True):
            hit, text = _take(text, alias)
            while hit:
                if code not in f.region:
                    f.region.append(code)
                hit, text = _take(text, alias)

    for word, kind in (
        ("rtgs", "rtgs"),
        ("rpgf", "rpgf"),
        ("joint fdrs", "joint_fdr"),
        ("joint fdr", "joint_fdr"),
        ("fixed deposits", "joint_fdr"),
        ("fixed deposit", "joint_fdr"),
        ("fdrs", "joint_fdr"),
        ("fdr", "joint_fdr"),
    ):
        hit, text = _take(text, word)
        if hit and kind not in f.kind:
            f.kind.append(kind)  # type: ignore[arg-type]

    for word, flag in (
        ("without signals", False),
        ("no signals", False),
        ("with signals", True),
        ("flagged", True),
        ("with alerts", True),
        ("signals", True),
    ):
        hit, text = _take(text, word)
        if hit:
            f.has_signals = flag
            break

    for word, levels in ASSURANCE_WORDS:
        hit, text = _take(text, word)
        if hit:
            f.assurance = sorted(set(f.assurance) | set(levels))
            break
    for m in re.finditer(r"\ba([0-3])\b", text):
        f.assurance = sorted(set(f.assurance) | {int(m.group(1))})
    text = re.sub(r"\ba[0-3]\b", " ", text)

    f.maturity_from, f.maturity_to, text = _dates(text, today)

    for word, statuses in STATUS_WORDS:
        hit, text = _take(text, word)
        if hit:
            for s in statuses:
                if s not in f.status:
                    f.status.append(s)  # type: ignore[arg-type]
    # "Maturing" alone (no dates) means the 90-day maturing window.
    if f.maturity_from is None and f.maturity_to is None:
        hit, text = _take(text, "maturing soon")
        hit2, text = _take(text, "maturing")
        if (hit or hit2) and "maturing" not in f.status:
            f.status.append("maturing")

    # What remains: a capitalised name becomes a text search; other words are reported.
    words = [w for w in re.findall(r"[a-z][a-z'-]+", text) if w not in STOPWORDS]
    if words and not f.q:
        leftover = set(re.findall(r"[a-z][a-z'-]+", text))
        for m in re.finditer(r"[A-Z][a-zA-Z]+(?:\s+(?:of\s+)?[A-Z][a-zA-Z]+)*", original):
            parts = [p for p in m.group(0).lower().split() if p != "of"]
            if m.start() == 0 and len(parts) == 1:
                continue  # A capitalised first word is just the start of the sentence.
            if all(p in leftover for p in parts):
                f.q = m.group(0)
                words = [w for w in words if w not in parts]
                break
    unrecognised += [w for w in words if len(w) > 2]
    return Interpretation(f, "rules", unrecognised)


# Model path


TOOL_NAME = "apply_registry_filters"


def _tool_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "q": {
                "type": "string",
                "description": "Institution name, instrument number or AICTE ID to search for.",
            },
            "region": {"type": "array", "items": {"type": "string", "enum": list(REGIONS)}},
            "bank": {"type": "array", "items": {"type": "string", "enum": list(BANKS)}},
            "kind": {"type": "array", "items": {"type": "string", "enum": list(get_args(Kind))}},
            "status": {
                "type": "array",
                "items": {"type": "string", "enum": list(get_args(StatusName))},
            },
            "assurance": {
                "type": "array",
                "items": {"type": "integer", "enum": [0, 1, 2, 3]},
                "description": "0 declared only, 1 document-checked, 2 bank-confirmed, "
                "3 re-confirmed. Unconfirmed means [0, 1].",
            },
            "maturity_from": {"type": "string", "description": "ISO date, inclusive."},
            "maturity_to": {"type": "string", "description": "ISO date, inclusive."},
            "has_signals": {"type": "boolean"},
            "unrecognised": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Parts of the request that cannot be expressed with these "
                "filters, such as a bank that is not listed.",
            },
        },
        "additionalProperties": False,
    }


def _system_prompt(today: date) -> str:
    regions = ", ".join(f"{c} ({REGION_NAMES[c]})" for c in REGIONS)
    banks = ", ".join(f"{c} ({n})" for c, n in BANKS.items())
    return (
        f"Today is {today.isoformat()}. You convert an AICTE officer's request about security "
        f"deposits into registry filters by calling {TOOL_NAME} exactly once.\n"
        f"Regions: {regions}.\nBanks: {banks}. Any other bank name goes in unrecognised.\n"
        "Kinds: joint_fdr (FDR), rpgf, rtgs. Statuses: maturing means within 90 days of "
        "maturity; matured means past maturity with no renewal or release; overdue means "
        "matured; pending verification means submitted and under_scrutiny.\n"
        "Dates are maturity dates. 'Before March 2027' means maturity_to = last day of February "
        "2027; 'by March 2027' means the end of March; 'in 2027' means the whole year. When a "
        "date range is given, do not also add the maturing status.\n"
        "Put institution names, instrument numbers or AICTE IDs in q. Leave out anything the "
        "request does not ask for. Never invent values."
    )


@cache
def _client() -> Any:
    import boto3
    from botocore.config import Config

    return boto3.client(
        "bedrock-runtime",
        region_name=get_settings().aws_region,
        config=Config(
            connect_timeout=3,
            read_timeout=8,
            retries={"max_attempts": 2, "mode": "adaptive"},
        ),
    )


def _from_model(sentence: str, today: date, client: Any) -> Interpretation:
    response = client.converse(
        modelId=get_settings().bedrock_model_id,
        system=[{"text": _system_prompt(today)}],
        messages=[{"role": "user", "content": [{"text": sentence[:500]}]}],
        inferenceConfig={"maxTokens": 400, "temperature": 0},
        toolConfig={
            "tools": [
                {
                    "toolSpec": {
                        "name": TOOL_NAME,
                        "description": "Apply filters to the deposit registry.",
                        "inputSchema": {"json": _tool_schema()},
                    }
                }
            ],
            "toolChoice": {"tool": {"name": TOOL_NAME}},
        },
    )
    block = next(
        (b["toolUse"] for b in response["output"]["message"]["content"] if "toolUse" in b),
        None,
    )
    if block is None or block.get("name") != TOOL_NAME:
        raise ValueError("model did not call the filter tool")
    raw = dict(block["input"])
    unrecognised = [str(u)[:80] for u in raw.pop("unrecognised", []) if str(u).strip()][:5]
    # Model output is untrusted: keep only allowed values, then validate types.
    raw["region"] = [r for r in raw.get("region", []) if r in REGIONS]
    raw["bank"] = [b for b in raw.get("bank", []) if b in BANKS]
    raw["assurance"] = [a for a in raw.get("assurance", []) if a in (0, 1, 2, 3)]
    filters = Filters.model_validate(raw)
    return Interpretation(filters, "model", unrecognised)


def interpret(sentence: str, today: date, client: Any | None = None) -> Interpretation:
    if get_settings().bedrock_enabled or client is not None:
        try:
            return _from_model(sentence, today, client or _client())
        except (ValueError, ValidationError, KeyError, TypeError) as exc:
            log.warning("search model output rejected", extra={"fields": {"error": str(exc)}})
            note = "The model's answer could not be used; interpreted by rules instead."
        except Exception as exc:
            log.warning("search model unavailable", extra={"fields": {"error": str(exc)}})
            note = "The model is unavailable; interpreted by rules instead."
        result = parse(sentence, today)
        result.note = note
        return result
    return parse(sentence, today)


def describe(f: Filters) -> list[dict[str, str]]:
    """Chips the officer reviews before applying, one per filter value."""
    chips: list[dict[str, str]] = []
    if f.q:
        chips.append({"key": "q", "value": f.q, "label": f'Text "{f.q}"'})
    chips += [{"key": "region", "value": r, "label": f"Region {REGION_NAMES[r]}"} for r in f.region]
    chips += [{"key": "bank", "value": b, "label": BANKS[b]} for b in f.bank]
    kind_label = {"joint_fdr": "Joint FDR", "rpgf": "RPGF", "rtgs": "RTGS"}
    chips += [{"key": "kind", "value": k, "label": kind_label[k]} for k in f.kind]
    chips += [
        {"key": "status", "value": s, "label": s.replace("_", " ").capitalize()} for s in f.status
    ]
    names = {
        0: "A0 declared",
        1: "A1 document-checked",
        2: "A2 bank-confirmed",
        3: "A3 re-confirmed",
    }
    chips += [{"key": "assurance", "value": str(a), "label": names[a]} for a in f.assurance]
    if f.maturity_from:
        chips.append(
            {
                "key": "maturity_from",
                "value": f.maturity_from.isoformat(),
                "label": f"Matures from {f.maturity_from:%d %b %Y}",
            }
        )
    if f.maturity_to:
        chips.append(
            {
                "key": "maturity_to",
                "value": f.maturity_to.isoformat(),
                "label": f"Matures by {f.maturity_to:%d %b %Y}",
            }
        )
    if f.has_signals is not None:
        chips.append(
            {
                "key": "has_signals",
                "value": json.dumps(f.has_signals),
                "label": "Has open signals" if f.has_signals else "No open signals",
            }
        )
    return chips
