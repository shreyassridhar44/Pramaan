"""Letters with verifiable QR tokens (R8, PROJECT.md 3.8).

A token is "<key fingerprint>.<letter id>.<base64url Ed25519 signature of the first two parts>".
Anyone can check the signature against the published key; the letter's current state (issued,
superseded, revoked) comes from the database at verification time.
"""

import base64
import hashlib
import io
import secrets
from dataclasses import dataclass
from datetime import date
from functools import cache
from pathlib import Path
from typing import Any

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    NoEncryption,
    PrivateFormat,
    PublicFormat,
)
from reportlab.graphics import renderPDF
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.domain.provenance import rupees
from app.models import Letter
from app.services import audit
from app.services.storage import storage

FONTS = Path(__file__).resolve().parents[1] / "assets" / "fonts"

KINDS = {
    "release_noc": {
        "code": "NOC",
        "title_en": "No Objection Certificate for release of security deposit",
        "title_hi": "सुरक्षा जमा राशि की वापसी हेतु अनापत्ति प्रमाण पत्र",
        "short_en": "No Objection Certificate",
        "short_hi": "अनापत्ति प्रमाण पत्र",
    },
    "deficiency": {
        "code": "DEF",
        "title_en": "Deficiency letter on a security deposit submission",
        "title_hi": "सुरक्षा जमा प्रस्तुति पर कमी सूचना पत्र",
        "short_en": "Deficiency letter",
        "short_hi": "कमी सूचना पत्र",
    },
    "release_sanction": {
        "code": "SO",
        "title_en": "Sanction order for refund of security deposit",
        "title_hi": "सुरक्षा जमा राशि की वापसी हेतु स्वीकृति आदेश",
        "short_en": "Sanction order",
        "short_hi": "स्वीकृति आदेश",
    },
}


# Keys


@dataclass(frozen=True)
class IssuerKey:
    fingerprint: str
    private: Ed25519PrivateKey
    public_b64: str

    @property
    def key_id(self) -> str:
        return f"pramaan-letters-{self.fingerprint}"


@cache
def issuer_key() -> IssuerKey:
    s = get_settings()
    raw = s.letter_signing_key_b64
    if not raw:
        # Local and test runs keep one generated key so letters stay verifiable across restarts.
        path = Path(s.storage_local_dir).resolve().parent / "keys" / "letter_signing.key"
        if path.exists():
            raw = path.read_text().strip()
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            key = Ed25519PrivateKey.generate()
            raw = base64.b64encode(
                key.private_bytes(Encoding.Raw, PrivateFormat.Raw, NoEncryption())
            ).decode()
            path.write_text(raw)
    private = Ed25519PrivateKey.from_private_bytes(base64.b64decode(raw))
    pub = private.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw)
    return IssuerKey(hashlib.sha256(pub).hexdigest()[:8], private, base64.b64encode(pub).decode())


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64url(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def make_token(token_id: str) -> str:
    """Short enough for a QR code that a phone camera reads at a glance."""
    key = issuer_key()
    message = f"{key.fingerprint}.{token_id}"
    return f"{message}.{_b64url(key.private.sign(message.encode()))}"


def read_token(token: str) -> str | None:
    """Returns the letter id inside a token whose signature verifies, else None."""
    key = issuer_key()
    try:
        fingerprint, token_id, sig = token.split(".")
        if fingerprint != key.fingerprint:
            return None
        public = Ed25519PublicKey.from_public_bytes(base64.b64decode(key.public_b64))
        public.verify(_unb64url(sig), f"{fingerprint}.{token_id}".encode())
    except (ValueError, InvalidSignature):
        return None
    return token_id


def verify_url(token: str) -> str:
    return f"{get_settings().public_base_url.rstrip('/')}/verify/{token}"


# Issue, supersede, revoke


async def next_reference(db: AsyncSession, kind: str, on: date) -> str:
    prefix = f"AICTE/RB/SD/{KINDS[kind]['code']}/{on:%Y}/"
    last = await db.scalar(
        select(Letter.reference)
        .where(Letter.reference.like(f"{prefix}%"))
        .order_by(Letter.reference.desc())
        .limit(1)
    )
    n = int(last.rsplit("/", 1)[1]) + 1 if last else 1
    return f"{prefix}{n:06d}"


async def issue(
    db: AsyncSession,
    *,
    kind: str,
    entity_type: str,
    entity_id: int,
    institution_id: int | None,
    recipient: str,
    fields: dict[str, Any],
    actor_id: int | None,
    actor_label: str,
    on: date,
) -> Letter:
    """Issues a letter, superseding any earlier issued letter of the same kind for the entity."""
    earlier = (
        await db.scalars(
            select(Letter).where(
                Letter.kind == kind,
                Letter.entity_type == entity_type,
                Letter.entity_id == entity_id,
                Letter.status == "issued",
            )
        )
    ).all()
    letter = Letter(
        kind=kind,
        reference=await next_reference(db, kind, on),
        entity_type=entity_type,
        entity_id=entity_id,
        institution_id=institution_id,
        recipient=recipient,
        fields=fields,
        token_id=secrets.token_urlsafe(12),
        status="issued",
        issued_by=actor_id,
        issued_on=on,
    )
    db.add(letter)
    await db.flush()
    for old in earlier:
        old.status = "superseded"
        old.fields = {**old.fields, "superseded_by": letter.reference}
    await audit.append(
        db,
        actor_id=actor_id,
        actor_label=actor_label,
        action="letter.issued",
        entity_type=entity_type,
        entity_id=entity_id,
        data={"letter_id": letter.id, "reference": letter.reference, "kind": kind},
    )
    return letter


async def revoke(
    db: AsyncSession, letter: Letter, reason: str, actor_id: int, actor_label: str, on: date
) -> None:
    letter.status = "revoked"
    letter.fields = {**letter.fields, "revoked_on": on.isoformat(), "revoked_reason": reason}
    await audit.append(
        db,
        actor_id=actor_id,
        actor_label=actor_label,
        action="letter.revoked",
        entity_type=letter.entity_type,
        entity_id=letter.entity_id,
        data={"letter_id": letter.id, "reference": letter.reference},
        note=reason,
    )


def pdf_bytes(letter: Letter) -> bytes:
    """The letter PDF, rendered once and kept in object storage."""
    store = storage()
    key = letter.storage_key or f"letters/{letter.id}/{letter.token_id}.pdf"
    if letter.storage_key and store.exists(key):
        return store.get(key)
    data = render_pdf(letter)
    store.put(key, data, "application/pdf")
    letter.storage_key = key
    return data


# Rendering


@cache
def register_fonts() -> None:
    for name, file in (
        ("Sans", "NotoSans-Regular.ttf"),
        ("Sans-SemiBold", "NotoSans-SemiBold.ttf"),
        ("Deva", "NotoSansDevanagari-Regular.ttf"),
        ("Deva-SemiBold", "NotoSansDevanagari-SemiBold.ttf"),
        ("Serif", "InstrumentSerif-Regular.ttf"),
    ):
        pdfmetrics.registerFont(TTFont(name, str(FONTS / file)))
    # Lets <b> in paragraphs pick the semibold face.
    pdfmetrics.registerFontFamily("Sans", normal="Sans", bold="Sans-SemiBold")
    pdfmetrics.registerFontFamily("Deva", normal="Deva", bold="Deva-SemiBold")


INK = colors.HexColor("#1B1F24")
INK_2 = colors.HexColor("#4A525C")
INK_3 = colors.HexColor("#6B737D")
LINE = colors.HexColor("#D9D4CA")
BRAND = colors.HexColor("#1F2A5C")
SOFT = colors.HexColor("#F4F1EA")


def _styles() -> dict[str, ParagraphStyle]:
    base = ParagraphStyle("base", fontName="Sans", fontSize=10, leading=15, textColor=INK)
    return {
        "body": base,
        "small": ParagraphStyle("small", parent=base, fontSize=8.5, leading=12, textColor=INK_2),
        "label": ParagraphStyle("label", parent=base, fontSize=7.5, leading=10, textColor=INK_3),
        "cell": ParagraphStyle("cell", parent=base, fontSize=9, leading=12),
        "title": ParagraphStyle(
            "title", parent=base, fontName="Serif", fontSize=21, leading=25, textColor=INK
        ),
        "hi": ParagraphStyle(
            "hi", parent=base, fontName="Deva", fontSize=12, leading=19, shaping=1
        ),
        "hi_small": ParagraphStyle(
            "hi_small",
            parent=base,
            fontName="Deva",
            fontSize=9,
            leading=14,
            shaping=1,
            textColor=INK_2,
        ),
        "subject": ParagraphStyle("subject", parent=base, fontName="Sans-SemiBold"),
    }


def _header(c: Canvas, letter: Letter) -> None:
    w, h = A4
    c.saveState()
    c.setFillColor(BRAND)
    c.rect(0, h - 6 * mm, w, 6 * mm, stroke=0, fill=1)
    hi = Paragraph(
        "अखिल भारतीय तकनीकी शिक्षा परिषद्",
        ParagraphStyle(
            "h", fontName="Deva-SemiBold", fontSize=13, leading=18, shaping=1, textColor=INK
        ),
    )
    hi.wrapOn(c, 120 * mm, 20 * mm)
    hi.drawOn(c, 20 * mm, h - 20 * mm)
    c.setFont("Sans-SemiBold", 12)
    c.setFillColor(INK)
    c.drawString(20 * mm, h - 26 * mm, "All India Council for Technical Education")
    c.setFont("Sans", 8.5)
    c.setFillColor(INK_2)
    c.drawString(
        20 * mm,
        h - 31 * mm,
        "Regulation Bureau, Nelson Mandela Marg, Vasant Kunj, New Delhi 110070",
    )
    c.setFont("Sans", 8.5)
    c.drawRightString(w - 20 * mm, h - 20 * mm, letter.reference)
    c.drawRightString(w - 20 * mm, h - 25 * mm, f"Date: {letter.issued_on:%d %B %Y}")
    c.setStrokeColor(LINE)
    c.setLineWidth(0.6)
    c.line(20 * mm, h - 35 * mm, w - 20 * mm, h - 35 * mm)
    c.restoreState()


def _footer(c: Canvas, letter: Letter, token: str) -> None:
    w, _ = A4
    c.saveState()
    size = 30 * mm
    url = verify_url(token)
    qr = QrCodeWidget(url, barLevel="M")
    x0, y0, x1, y1 = qr.getBounds()
    d = Drawing(size, size, transform=[size / (x1 - x0), 0, 0, size / (y1 - y0), 0, 0])
    d.add(qr)
    renderPDF.draw(d, c, w - 20 * mm - size, 14 * mm)
    c.setFillColor(INK)
    c.setFont("Sans-SemiBold", 8.5)
    tx = w - 20 * mm - size - 4 * mm
    c.drawRightString(tx, 36 * mm, "Scan to verify this letter")
    hi = Paragraph(
        "सत्यापन के लिए स्कैन करें",
        ParagraphStyle(
            "f", fontName="Deva", fontSize=8, leading=11, shaping=1, textColor=INK_2, alignment=2
        ),
    )
    hi.wrapOn(c, 60 * mm, 8 * mm)
    hi.drawOn(c, tx - 60 * mm, 30.5 * mm)
    c.setFont("Sans", 7.5)
    c.setFillColor(INK_3)
    c.drawRightString(tx, 26 * mm, f"Signed token, key {issuer_key().key_id}")
    c.drawRightString(tx, 22 * mm, url if len(url) < 70 else url[:67] + "...")
    c.setStrokeColor(LINE)
    c.line(20 * mm, 11 * mm, w - 20 * mm, 11 * mm)
    c.drawString(
        20 * mm,
        7 * mm,
        "Generated by the Pramaan prototype with synthetic data. Not an official AICTE document.",
    )
    c.restoreState()


def _deficiency_body(f: dict[str, Any], st: dict[str, ParagraphStyle]) -> list[Any]:
    out: list[Any] = [
        Paragraph(
            f"The Regulation Bureau has examined the submission and returned it for the following "
            f"reason: <b>{f['reason']}</b>",
            st["body"],
        ),
        Spacer(1, 3 * mm),
    ]
    if f.get("discrepancies"):
        rows = [
            [Paragraph(h, st["label"]) for h in ("FIELD", "DECLARED", "ON THE RECEIPT", "BANK")]
        ]
        for d in f["discrepancies"]:
            rows.append(
                [
                    Paragraph(d["field"], st["cell"]),
                    Paragraph(d.get("declared") or "None", st["cell"]),
                    Paragraph(d.get("extracted") or "Not read", st["cell"]),
                    Paragraph(d.get("confirmed") or "Not yet confirmed", st["cell"]),
                ]
            )
        table = Table(rows, colWidths=[34 * mm, 46 * mm, 46 * mm, 44 * mm])
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), SOFT),
                    ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]
            )
        )
        out += [
            Paragraph("The values below do not agree with each other:", st["body"]),
            Spacer(1, 2 * mm),
            table,
            Spacer(1, 3 * mm),
        ]
    out.append(
        Paragraph(
            "Please correct the submission and resubmit it through the Pramaan institution portal "
            f"within {f.get('respond_within_days', 15)} days. Earlier entries remain on record. "
            "This letter does not withdraw any approval.",
            st["body"],
        )
    )
    return out


def render_pdf(letter: Letter) -> bytes:
    register_fonts()
    st = _styles()
    meta = KINDS[letter.kind]
    f = letter.fields
    token = make_token(letter.token_id)
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        # The frame adds 6 pt of padding; this lines body text up with the letterhead.
        leftMargin=20 * mm - 6,
        rightMargin=20 * mm - 6,
        topMargin=42 * mm,
        bottomMargin=48 * mm,
        title=f"{meta['short_en']} {letter.reference}",
        author="Pramaan prototype",
    )
    story: list[Any] = [
        Paragraph(meta["title_hi"], st["hi"]),
        Paragraph(meta["title_en"], st["title"]),
        Spacer(1, 5 * mm),
        Paragraph(f"To<br/>{letter.recipient.replace(chr(10), '<br/>')}", st["body"]),
        Spacer(1, 4 * mm),
        Paragraph(
            f"Subject: Deficiencies in the security deposit submitted by {f['institution']} "
            f"({f['aicte_id']})."
            if letter.kind == "deficiency"
            else f"Subject: {meta['short_en']} for release of the security deposit of "
            f"{f['institution']} ({f['aicte_id']}). Release case {f['case_reference']}.",
            st["subject"],
        ),
        Spacer(1, 3 * mm),
    ]
    rows = [
        [
            Paragraph(h, st["label"])
            for h in ("INSTRUMENT", "TYPE", "BANK AND BRANCH", "ISSUED", "MATURITY", "AMOUNT")
        ]
    ]
    for i in f["instruments"]:
        rows.append(
            [
                Paragraph(i["number"], st["cell"]),
                Paragraph(i["kind_label"], st["cell"]),
                Paragraph(f"{i['bank']}, {i['branch']}", st["cell"]),
                Paragraph(date.fromisoformat(i["issue_date"]).strftime("%d %b %Y"), st["cell"]),
                Paragraph(date.fromisoformat(i["maturity_date"]).strftime("%d %b %Y"), st["cell"]),
                Paragraph(rupees(int(i["amount_paise"]) // 100), st["cell"]),
            ]
        )
    table = Table(rows, colWidths=[32 * mm, 22 * mm, 46 * mm, 22 * mm, 22 * mm, 26 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), SOFT),
                ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story += [table, Spacer(1, 4 * mm)]
    if letter.kind == "deficiency":
        story += _deficiency_body(f, st)
    elif letter.kind == "release_noc":
        body = (
            f"The deposit above is held jointly in favour of the Member Secretary, AICTE and "
            f"{f['trust']}. The All India Council for Technical Education has no objection to its "
            f"release under Clause 6.46 of the Approval Process Handbook 2024-27. The bank may "
            f"discharge the lien marked in favour of AICTE and pay the proceeds to {f['trust']}."
        )
    else:
        body = (
            f"Refund of the security deposit above, received by RTGS from {f['trust']}, is "
            f"sanctioned under Clause 6.46 of the Approval Process Handbook 2024-27. The Accounts "
            f"Section may credit {rupees(int(f['amount_paise']) // 100)} to the institution's "
            f"registered bank account after recording this order."
        )
    if letter.kind != "deficiency":
        checks = "; ".join(f"{c['label']} ({c['aph_ref']})" for c in f["checks"])
        story += [
            Paragraph(body, st["body"]),
            Spacer(1, 3 * mm),
            Paragraph(f"Conditions verified before issue: {checks}.", st["small"]),
        ]
    story += [
        Spacer(1, 8 * mm),
        Paragraph(f"<b>{f['authority']['name']}</b>", st["body"]),
        Paragraph(f["authority"]["designation"], st["small"]),
        Paragraph(
            "Issued electronically in Pramaan"
            if letter.kind == "deficiency"
            else "Approved electronically in Pramaan",
            st["small"],
        ),
        Spacer(1, 5 * mm),
        Paragraph(
            "Copy to: Regional Office concerned"
            if letter.kind == "deficiency"
            else f"Copy to: {f['institution']}, {f['address']}",
            st["small"],
        ),
    ]

    def decorate(c: Canvas, _doc: object) -> None:
        _header(c, letter)
        _footer(c, letter, token)

    doc.build(story, onFirstPage=decorate, onLaterPages=decorate)
    return buf.getvalue()
