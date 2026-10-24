"""Synthetic Fixed Deposit Receipt renderer.

Twelve fictional bank layouts (DATA_SOURCES.md 2.2). Each render returns the image plus exact boxes
for every field value and every character in it, which the tamper generator and the field
extractor use as ground truth. Every image carries a "SYNTHETIC SPECIMEN" watermark.
"""

import math
import random
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from synth.fonts import ensure_fonts, font_path

W, H = 1700, 1100

FIELDS = (
    "number",
    "amount",
    "amount_words",
    "issue_date",
    "maturity_date",
    "holders",
    "ifsc",
    "branch",
    "rate",
    "lien",
)


@dataclass(frozen=True)
class Bank:
    code: str
    name: str
    hindi: str
    primary: tuple[int, int, int]
    accent: tuple[int, int, int]
    paper: tuple[int, int, int]
    label_font: str
    value_font: str
    style: str  # "table" | "lines" | "grid" | "cert"
    logo: str  # "circle" | "hex" | "shield" | "square"
    number_label: str
    date_fmt: str
    amount_fmt: str


BANKS: tuple[Bank, ...] = (
    Bank(
        "BHNX",
        "Bharat National Bank",
        "भारत नेशनल बैंक",
        (20, 48, 110),
        (190, 120, 30),
        (247, 244, 236),
        "serif",
        "mono_plex",
        "table",
        "circle",
        "FDR No.",
        "%d/%m/%Y",
        "rs",
    ),
    Bank(
        "DCCX",
        "Deccan Cooperative Bank",
        "डेक्कन सहकारी बैंक",
        (110, 30, 40),
        (40, 90, 60),
        (250, 246, 238),
        "sans_plex",
        "mono_courier",
        "lines",
        "hex",
        "Deposit No.",
        "%d-%m-%Y",
        "inr",
    ),
    Bank(
        "SAHX",
        "Sahyadri Bank",
        "सह्याद्री बैंक",
        (25, 90, 70),
        (150, 110, 40),
        (244, 248, 242),
        "serif_source",
        "mono_roboto",
        "grid",
        "shield",
        "Receipt No.",
        "%d.%m.%Y",
        "rupee",
    ),
    Bank(
        "GGBX",
        "Ganga Gramin Bank",
        "गंगा ग्रामीण बैंक",
        (60, 60, 130),
        (200, 90, 40),
        (248, 246, 240),
        "sans_open",
        "mono_incons",
        "cert",
        "square",
        "FD Account No.",
        "%d %b %Y",
        "rs",
    ),
    Bank(
        "VCBX",
        "Vindhya Commercial Bank",
        "विंध्य कमर्शियल बैंक",
        (80, 40, 100),
        (180, 140, 60),
        (246, 243, 248),
        "serif_pt",
        "mono_pt",
        "table",
        "hex",
        "Term Deposit No.",
        "%d/%m/%Y",
        "inr",
    ),
    Bank(
        "KMBX",
        "Konkan Mercantile Bank",
        "कोंकण मर्केंटाइल बैंक",
        (10, 80, 100),
        (200, 70, 60),
        (243, 247, 248),
        "sans_lato",
        "mono_plex",
        "lines",
        "circle",
        "FDR No.",
        "%d-%b-%Y",
        "rupee",
    ),
    Bank(
        "NARX",
        "Narmada Bank",
        "नर्मदा बैंक",
        (30, 70, 140),
        (60, 140, 120),
        (245, 247, 250),
        "serif",
        "mono_roboto",
        "grid",
        "square",
        "Deposit Receipt No.",
        "%d/%m/%Y",
        "rs",
    ),
    Bank(
        "MFBX",
        "Malabar Federal Bank",
        "मालाबार फेडरल बैंक",
        (0, 100, 80),
        (190, 150, 40),
        (244, 249, 246),
        "sans_plex",
        "mono_courier",
        "cert",
        "shield",
        "TD No.",
        "%d.%m.%Y",
        "inr",
    ),
    Bank(
        "HUBX",
        "Himalayan Union Bank",
        "हिमालयन यूनियन बैंक",
        (40, 50, 70),
        (170, 60, 50),
        (247, 246, 244),
        "serif_source",
        "mono_pt",
        "table",
        "square",
        "FDR No.",
        "%d %B %Y",
        "rupee",
    ),
    Bank(
        "KTBX",
        "Kaveri Trust Bank",
        "कावेरी ट्रस्ट बैंक",
        (120, 70, 20),
        (30, 90, 120),
        (250, 247, 240),
        "serif_pt",
        "mono_incons",
        "lines",
        "circle",
        "Deposit No.",
        "%d/%m/%Y",
        "rs",
    ),
    Bank(
        "ARVX",
        "Aravalli Bank",
        "अरावली बैंक",
        (150, 60, 30),
        (50, 70, 120),
        (250, 245, 240),
        "sans_open",
        "mono_plex",
        "grid",
        "hex",
        "Receipt No.",
        "%d-%m-%Y",
        "inr",
    ),
    Bank(
        "BRPX",
        "Brahmaputra Bank",
        "ब्रह्मपुत्र बैंक",
        (20, 100, 110),
        (180, 120, 40),
        (243, 248, 247),
        "sans_lato",
        "mono_roboto",
        "cert",
        "shield",
        "FD Receipt No.",
        "%d %b %Y",
        "rupee",
    ),
)
BANK_BY_CODE = {b.code: b for b in BANKS}

_ONES = (
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
)
_TENS = ("", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety")


def _two(n: int) -> str:
    return _ONES[n] if n < 20 else (_TENS[n // 10] + (" " + _ONES[n % 10] if n % 10 else ""))


def rupees_in_words(n: int) -> str:
    """Indian numbering: crore, lakh, thousand, hundred."""
    if n == 0:
        return "Zero"
    parts = []
    for div, name in (
        (10_000_000, "Crore"),
        (100_000, "Lakh"),
        (1_000, "Thousand"),
        (100, "Hundred"),
    ):
        if n >= div:
            parts.append(
                f"{_two(n // div) if n // div < 100 else rupees_in_words(n // div)} {name}"
            )
            n %= div
    if n:
        parts.append(_two(n))
    return " ".join(parts)


def inr_grouped(n: int) -> str:
    s = str(n)
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


def has_glyph(font_key: str, ch: str, size: int = 28) -> bool:
    """True when the font draws `ch` itself rather than its missing-glyph box."""
    f = font(font_key, size)
    return f.getbbox(ch) != f.getbbox("􏿽") and f.getbbox(ch) != (0, 0, 0, 0)


def format_amount(rupees: int, style: str, font_key: str | None = None) -> str:
    g = inr_grouped(rupees)
    if style == "rupee" and font_key and not has_glyph(font_key, "₹"):
        style = "rs"
    return {"rs": f"Rs. {g}.00", "inr": f"INR {g}/-", "rupee": f"₹ {g}.00"}[style]


@dataclass
class FdrData:
    bank: Bank
    number: str
    branch: str
    ifsc: str
    amount_rupees: int
    issue: date
    maturity: date
    rate: float
    holders: tuple[str, str]
    lien: bool = True

    @classmethod
    def random(cls, rng: random.Random, bank: Bank | None = None) -> "FdrData":
        bank = bank or rng.choice(BANKS)
        city = rng.choice(
            [
                "Pune",
                "Nashik",
                "Indore",
                "Lucknow",
                "Chennai",
                "Kochi",
                "Jaipur",
                "Patna",
                "Guwahati",
                "Bhopal",
                "Nagpur",
                "Mysuru",
                "Vadodara",
                "Ranchi",
                "Mohali",
            ]
        )
        issue = date(rng.randint(2012, 2026), rng.randint(1, 12), rng.randint(1, 28))
        years = rng.choice([8, 10, 10, 10, 5, 3])
        trust_prefix = rng.choice(
            [
                "Sahyadri",
                "Vindhya",
                "Kaveri",
                "Narmada",
                "Pragati",
                "Unnati",
                "Godavari",
                "Shivalik",
                "Konkan",
                "Malwa",
                "Samarth",
                "Prerana",
            ]
        )
        trust = f"{trust_prefix} {rng.choice(['Education Society', 'Educational Trust', 'Shikshan Sanstha'])}"
        lakh = rng.choice([5, 10, 15, 15, 30, 35, 35, 50, 70, 100])
        return cls(
            bank=bank,
            number=f"{rng.randint(100, 999)}{issue:%y}{rng.randint(10**7, 10**8 - 1)}",
            branch=f"{city} {rng.choice(['Main', 'Camp', 'Station Road', 'Civil Lines', 'MG Road'])}",
            ifsc=f"{bank.code}0{rng.randint(100000, 999999)}",
            amount_rupees=lakh * 100_000,
            issue=issue,
            maturity=issue.replace(year=issue.year + years)
            if not (issue.month == 2 and issue.day == 29)
            else date(issue.year + years, 2, 28),
            rate=round(rng.uniform(5.25, 8.1), 2),
            holders=("Member Secretary, AICTE", f"Secretary, {trust}"),
            lien=rng.random() > 0.03,
        )


@dataclass
class Rendered:
    image: np.ndarray  # H x W x 3 uint8 (RGB)
    data: FdrData
    fields: dict[str, dict[str, Any]] = field(default_factory=dict)
    labels: list[dict[str, Any]] = field(default_factory=list)
    value_font: str = ""
    value_size: int = 0


_FONT_CACHE: dict[tuple[str, int], ImageFont.FreeTypeFont] = {}


def font(key: str, size: int) -> ImageFont.FreeTypeFont:
    k = (key, size)
    if k not in _FONT_CACHE:
        _FONT_CACHE[k] = ImageFont.truetype(str(font_path(key)), size)
    return _FONT_CACHE[k]


class _Canvas:
    def __init__(self, bank: Bank, rng: random.Random) -> None:
        self.bank = bank
        self.rng = rng
        self.img = Image.new("RGB", (W, H), bank.paper)
        self.draw = ImageDraw.Draw(self.img)
        self.fields: dict[str, dict[str, Any]] = {}
        self.labels: list[dict[str, Any]] = []

    def text(
        self,
        xy: tuple[float, float],
        s: str,
        f: ImageFont.FreeTypeFont,
        fill: tuple[int, int, int],
        field_name: str | None = None,
        label: bool = False,
    ) -> tuple[int, int, int, int]:
        x, y = xy
        self.draw.text((x, y), s, font=f, fill=fill)
        box = self.draw.textbbox((x, y), s, font=f)
        if field_name:
            chars = []
            for i, ch in enumerate(s):
                if ch.isspace():
                    continue
                left = x + f.getlength(s[:i])
                cb = self.draw.textbbox((left, y), ch, font=f)
                chars.append([int(cb[0]), int(cb[1]), int(cb[2]), int(cb[3]), ch])
            self.fields[field_name] = {"value": s, "box": [int(v) for v in box], "chars": chars}
        if label:
            self.labels.append({"text": s, "box": [int(v) for v in box]})
        return tuple(int(v) for v in box)  # type: ignore[return-value]


def _guilloche(c: _Canvas) -> None:
    rng = c.rng
    tint = tuple(min(255, int(p * 0.15 + 255 * 0.85)) for p in c.bank.primary)
    for k in range(18):
        phase = rng.uniform(0, math.tau)
        amp = rng.uniform(12, 40)
        freq = rng.uniform(0.004, 0.012)
        y0 = 120 + k * 52
        pts = [
            (x, y0 + amp * math.sin(freq * x + phase) + 0.5 * amp * math.sin(2.7 * freq * x))
            for x in range(0, W, 6)
        ]
        c.draw.line(pts, fill=tint, width=1)


def _logo(c: _Canvas, x: int, y: int, size: int) -> None:
    b = c.bank
    initials = "".join(w[0] for w in b.name.split()[:2])
    if b.logo == "circle":
        c.draw.ellipse([x, y, x + size, y + size], fill=b.primary)
    elif b.logo == "square":
        c.draw.rounded_rectangle([x, y, x + size, y + size], radius=size // 6, fill=b.primary)
    elif b.logo == "hex":
        r = size / 2
        cx, cy = x + r, y + r
        c.draw.polygon(
            [
                (cx + r * math.cos(math.pi / 3 * i), cy + r * math.sin(math.pi / 3 * i))
                for i in range(6)
            ],
            fill=b.primary,
        )
    else:
        c.draw.polygon(
            [
                (x, y),
                (x + size, y),
                (x + size, y + size * 0.6),
                (x + size / 2, y + size),
                (x, y + size * 0.6),
            ],
            fill=b.primary,
        )
    f = font(b.label_font, int(size * 0.38))
    tw = c.draw.textlength(initials, font=f)
    c.draw.text((x + (size - tw) / 2, y + size * 0.27), initials, font=f, fill=b.paper)


def _header(c: _Canvas, rng: random.Random) -> None:
    b = c.bank
    c.draw.rectangle([0, 0, W, 8], fill=b.primary)
    _logo(c, 70, 40, 92)
    c.text((185, 40), b.name, font(b.label_font, 46), b.primary)
    c.text((187, 98), b.hindi, font("deva", 26), b.accent)
    title = rng.choice(["FIXED DEPOSIT RECEIPT", "TERM DEPOSIT RECEIPT", "FIXED DEPOSIT ADVICE"])
    f = font(b.label_font, 30)
    tw = c.draw.textlength(title, font=f)
    c.draw.text((W - 70 - tw, 52), title, font=f, fill=b.primary)
    c.draw.text(
        (W - 70 - c.draw.textlength("NON-TRANSFERABLE", font=font(b.label_font, 18)), 96),
        "NON-TRANSFERABLE",
        font=font(b.label_font, 18),
        fill=b.accent,
    )
    c.draw.line([(60, 150), (W - 60, 150)], fill=b.accent, width=3)


def _watermark(img: Image.Image, rng: random.Random) -> Image.Image:
    f = font("sans_plex", 84)
    text = "SYNTHETIC SPECIMEN"
    bb = f.getbbox(text)
    tile = Image.new("RGBA", (bb[2] + 20, bb[3] + 20), (0, 0, 0, 0))
    ImageDraw.Draw(tile).text((10 - bb[0], 10 - bb[1]), text, font=f, fill=(150, 30, 30, 42))
    tile = tile.rotate(rng.uniform(14, 22), resample=Image.Resampling.BICUBIC, expand=True)
    base = img.convert("RGBA")
    base.alpha_composite(tile, (int(W / 2 - tile.width / 2), int(H / 2 - tile.height / 2)))
    return base.convert("RGB")


def _signature(c: _Canvas, x: int, y: int) -> None:
    rng = c.rng
    pts = []
    for i in range(60):
        t = i / 59
        pts.append(
            (
                x + t * 220 + rng.uniform(-3, 3),
                y + 18 * math.sin(t * rng.uniform(8, 14)) + rng.uniform(-4, 4),
            )
        )
    c.draw.line(pts, fill=(25, 35, 90), width=2, joint="curve")


def _seal(c: _Canvas, x: int, y: int) -> None:
    b = c.bank
    col = (*b.accent,)
    c.draw.ellipse([x, y, x + 150, y + 150], outline=col, width=4)
    c.draw.ellipse([x + 14, y + 14, x + 136, y + 136], outline=col, width=2)
    f = font(b.label_font, 17)
    for i, ch in enumerate(b.name.upper()[:22]):
        ang = math.pi + i * (math.pi / 21)
        c.draw.text(
            (x + 75 + 58 * math.cos(ang) - 5, y + 75 + 58 * math.sin(ang) - 8), ch, font=f, fill=col
        )
    c.draw.text((x + 46, y + 64), b.code, font=font(b.label_font, 24), fill=col)


def _date(d: date, fmt: str) -> str:
    return d.strftime(fmt)


def render(data: FdrData, rng: random.Random) -> Rendered:
    """Draws one receipt. Layout details vary per bank style and randomly within a style."""
    ensure_fonts()
    b = data.bank
    c = _Canvas(b, rng)
    _guilloche(c)
    _header(c, rng)
    lab = font(b.label_font, rng.choice([24, 25, 26]))
    vsize = rng.choice([27, 28, 30])
    val = font(b.value_font, vsize)
    ink = (22, 24, 30)
    lab_col = tuple(int(v * 0.85) for v in b.primary)

    rows = [
        ("number", b.number_label, data.number),
        ("branch", "Branch", data.branch),
        ("ifsc", "IFSC", data.ifsc),
        (
            "amount",
            rng.choice(["Amount", "Deposit Amount", "Principal"]),
            format_amount(data.amount_rupees, b.amount_fmt, b.value_font),
        ),
        ("amount_words", "In words", f"Rupees {rupees_in_words(data.amount_rupees)} Only"),
        (
            "issue_date",
            rng.choice(["Date of Issue", "Date of Deposit", "Issue Date"]),
            _date(data.issue, b.date_fmt),
        ),
        (
            "maturity_date",
            rng.choice(["Maturity Date", "Date of Maturity", "Due Date"]),
            _date(data.maturity, b.date_fmt),
        ),
        ("rate", "Rate of Interest", f"{data.rate:.2f}% p.a."),
        (
            "holders",
            rng.choice(["In the name of", "Depositor(s)", "Holders"]),
            " & ".join(data.holders),
        ),
        (
            "lien",
            "Lien",
            "Lien marked in favour of AICTE, New Delhi" if data.lien else "No lien marked",
        ),
    ]
    if b.style in ("table", "grid"):
        x_lab, x_val, y = 90, 520, 200
        gap = 70 if b.style == "table" else 72
        for i, (name, label, value) in enumerate(rows):
            if b.style == "grid":
                c.draw.rectangle(
                    [70, y - 14, W - 70, y + gap - 18],
                    outline=tuple(int(v * 0.6 + 100) for v in b.primary),
                    width=1,
                )
            elif i % 2 == 0:
                c.draw.rectangle(
                    [70, y - 12, W - 70, y + gap - 20],
                    fill=tuple(min(255, int(v * 0.06 + 240)) for v in b.primary),
                )
            c.text((x_lab, y), label, lab, lab_col, label=True)
            v_font = (
                val
                if name not in ("amount_words", "holders", "lien")
                else font(b.value_font, vsize - 4)
            )
            c.text((x_val, y), value, v_font, ink, field_name=name)
            y += gap
    elif b.style == "lines":
        y = 200
        col_x = (90, 880)
        pairs = [rows[i : i + 2] for i in range(0, 4, 2)] + [[r] for r in rows[4:]]
        for pair in pairs:
            for j, (name, label, value) in enumerate(pair):
                x = col_x[j] if len(pair) == 2 else 90
                lb = c.text((x, y), label + ":", lab, lab_col, label=True)
                v_font = (
                    val
                    if name not in ("amount_words", "holders", "lien")
                    else font(b.value_font, vsize - 4)
                )
                vb = c.text((lb[2] + 18, y), value, v_font, ink, field_name=name)
                c.draw.line(
                    [(lb[2] + 12, vb[3] + 6), (min(W - 80, vb[2] + 120), vb[3] + 6)],
                    fill=lab_col,
                    width=1,
                )
            y += 84
    else:  # cert
        f_body = font(b.label_font, 27)
        y = 200
        c.draw.rounded_rectangle([60, 175, W - 60, H - 60], radius=16, outline=b.accent, width=3)
        c.text(
            (100, y),
            "Received from the depositor(s) named below the sum stated, as a fixed deposit on the terms printed overleaf.",
            f_body,
            ink,
        )
        y += 70
        for name, label, value in rows:
            lb = c.text((110, y), label, lab, lab_col, label=True)
            v_font = (
                val
                if name not in ("amount_words", "holders", "lien")
                else font(b.value_font, vsize - 4)
            )
            c.text((560, y), value, v_font, ink, field_name=name)
            _ = lb
            y += 66

    _seal(c, W - 360, H - 250)
    _signature(c, W - 640, H - 150)
    c.draw.text(
        (W - 660, H - 105), "Authorised Signatory", font=font(b.label_font, 20), fill=lab_col
    )
    c.draw.text(
        (90, H - 90),
        f"{b.name} · This is a computer-generated specimen for testing. Not a valid instrument.",
        font=font(b.label_font, 17),
        fill=lab_col,
    )
    img = _watermark(c.img, rng)
    return Rendered(np.asarray(img).copy(), data, c.fields, c.labels, b.value_font, vsize)


def random_receipt(seed: int, bank_code: str | None = None) -> Rendered:
    rng = random.Random(seed)
    bank = BANK_BY_CODE[bank_code] if bank_code else None
    return render(FdrData.random(rng, bank), rng)


def _days(d: date, n: int) -> date:
    return d + timedelta(days=n)
