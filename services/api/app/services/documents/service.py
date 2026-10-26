"""Upload, analysis and checks for institution documents.

Checks compare what the document says with what the institution declared, look for internal
inconsistency (amount in figures against words), map forensic regions to fields, and look for the
same instrument or the same image elsewhere in the portfolio. Every check is a review prompt.
"""

import hashlib
from dataclasses import asdict, dataclass
from dataclasses import field as dc_field
from typing import Any

import cv2
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.domain.provenance import display, normalise, rupees
from app.domain.types import FieldName
from app.domain.words import words_to_rupees
from app.models import Analysis, Bank, Document, Institution, Instrument
from app.services.documents.forensics import hamming, heatmap_png
from app.services.documents.pipeline import analyse_document, sniff_mime
from app.services.storage import storage

FIELD_LABEL = {
    "number": "Instrument number",
    "amount": "Amount",
    "amount_words": "Amount in words",
    "issue_date": "Issue date",
    "maturity_date": "Maturity date",
    "ifsc": "IFSC",
    "holders": "Holders",
    "lien": "Lien",
    "branch": "Branch",
}
COMPARED = ("number", "ifsc", "amount", "issue_date", "maturity_date")


@dataclass
class Check:
    code: str
    severity: str
    title: str
    detail: str
    field: str | None = None
    evidence: dict[str, Any] = dc_field(default_factory=dict)


def _norm(name: str, value: str) -> str | None:
    try:
        return normalise(FieldName(name), value)
    except ValueError:
        return None


def _shown(name: str, norm: str | None, raw: str) -> str:
    if norm is None:
        return raw
    try:
        return display(FieldName(name), norm)
    except ValueError:
        return raw


async def upload_and_analyse(
    db: AsyncSession,
    *,
    data: bytes,
    filename: str,
    kind: str,
    uploaded_by: int,
    institution_id: int | None,
    declared: dict[str, str] | None,
) -> dict[str, Any]:
    mime = sniff_mime(data)
    sha = hashlib.sha256(data).hexdigest()
    ext = {"application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg"}[mime]
    key = f"documents/{sha[:2]}/{sha}.{ext}"
    store = storage()
    if not store.exists(key):
        store.put(key, data, mime)

    doc = Document(
        entity_type="pending",
        entity_id=institution_id or 0,
        kind=kind,
        filename=filename[:200],
        storage_key=key,
        sha256=sha,
        mime=mime,
        size_bytes=len(data),
        uploaded_by=uploaded_by,
    )
    db.add(doc)
    await db.flush()

    if kind != "fdr_scan":
        await db.commit()
        return {"document_id": doc.id, "kind": kind, "filename": doc.filename, "analysed": False}

    result = await run_in_threadpool(analyse_document, data)
    page_key = f"analyses/{doc.id}/page.jpg"
    _, page_jpg = cv2.imencode(
        ".jpg", cv2.cvtColor(result.image, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 90]
    )
    store.put(page_key, page_jpg.tobytes(), "image/jpeg")
    heat_key = f"analyses/{doc.id}/heatmap.png"
    store.put(heat_key, heatmap_png(result.forensics.heatmap), "image/png")
    doc.phash = result.phash
    doc.pages = 1

    h, w = result.image.shape[:2]
    fields = []
    for name, f in result.fields.items():
        norm = _norm(name, f.value) if name in (*COMPARED, "lien", "holders") else None
        fields.append(
            {
                "field": name,
                "label": FIELD_LABEL.get(name, name),
                "value": f.value,
                "norm": norm,
                "display": _shown(name, norm, f.value),
                "box": [round(v) for v in f.box],
                "confidence": round(f.confidence, 3),
            }
        )
    checks = await _checks(db, result, fields, declared, institution_id, doc.id)
    analysis = Analysis(
        document_id=doc.id,
        status="done",
        ocr={
            "tokens": [
                {"text": t.text, "box": [round(v) for v in t.box], "conf": round(t.conf, 3)}
                for t in result.tokens
            ]
        },
        extraction={"fields": fields, "width": w, "height": h},
        forensics={
            "score": result.forensics.image_score,
            "method": result.forensics.method,
            "regions": [
                {"box": list(r.box), "score": r.score, "sources": r.sources}
                for r in result.forensics.regions
            ],
            "classical": result.forensics.classical,
            "page_key": page_key,
            "heatmap_key": heat_key,
            "checks": [asdict(c) for c in checks],
        },
        model_versions=result.model_versions,
        duration_ms=result.duration_ms,
    )
    db.add(analysis)
    await db.commit()
    return analysis_payload(doc, analysis)


def analysis_payload(doc: Document, a: Analysis) -> dict[str, Any]:
    ex = a.extraction or {}
    fo = a.forensics or {}
    return {
        "document_id": doc.id,
        "kind": doc.kind,
        "filename": doc.filename,
        "analysed": True,
        "width": ex.get("width"),
        "height": ex.get("height"),
        "fields": ex.get("fields", []),
        "checks": fo.get("checks", []),
        "forensics": {
            "score": fo.get("score"),
            "method": fo.get("method"),
            "regions": fo.get("regions", []),
        },
        "model_versions": a.model_versions or {},
        "duration_ms": a.duration_ms,
        "page_url": f"/api/v1/documents/{doc.id}/page",
        "heatmap_url": f"/api/v1/documents/{doc.id}/heatmap",
    }


def _overlap(a: list[int] | tuple[int, ...], b: list[int] | tuple[int, ...]) -> float:
    ix = max(0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    area = max(1, (a[2] - a[0]) * (a[3] - a[1]))
    return ix * iy / area


async def _checks(
    db: AsyncSession,
    result: Any,
    fields: list[dict[str, Any]],
    declared: dict[str, str] | None,
    institution_id: int | None,
    doc_id: int,
) -> list[Check]:
    checks: list[Check] = []
    by_name = {f["field"]: f for f in fields}

    # 1. Document against declaration.
    if declared:
        for name in COMPARED:
            d_raw = declared.get(name)
            f = by_name.get(name)
            if not d_raw:
                continue
            d_norm = _norm(name, d_raw)
            if f is None:
                checks.append(
                    Check(
                        "field_unread",
                        "low",
                        f"Could not read the {FIELD_LABEL[name].lower()} from the document",
                        "Check the scan quality or enter the value carefully.",
                        name,
                    )
                )
            elif f["norm"] is not None and d_norm is not None and f["norm"] != d_norm:
                checks.append(
                    Check(
                        "declared_mismatch",
                        "high" if name in ("amount", "maturity_date", "number") else "medium",
                        f"{FIELD_LABEL[name]} on the document differs from the entered value",
                        f"Entered {_shown(name, d_norm, d_raw)}, document reads {f['display']}.",
                        name,
                        {"declared": _shown(name, d_norm, d_raw), "document": f["display"]},
                    )
                )

    # 2. Amount in figures against amount in words.
    amount, words = by_name.get("amount"), by_name.get("amount_words")
    if amount and words and amount["norm"]:
        in_words = words_to_rupees(words["value"])
        figures = int(amount["norm"]) // 100
        if in_words is not None and in_words != figures:
            checks.append(
                Check(
                    "figures_words_mismatch",
                    "high",
                    "Amount in figures does not match the amount in words",
                    f"Figures read {display(FieldName.AMOUNT, amount['norm'])};"
                    f" words read {rupees(in_words)}.",
                    "amount",
                    {"figures_rupees": figures, "words_rupees": in_words},
                )
            )

    # 3. Forensic regions mapped to fields. A mark that touches no value field (printed labels,
    # borders) is still shown, but graded low: an altered deposit changes values.
    for region in result.forensics.regions:
        near = max(fields, key=lambda f: _overlap(f["box"], region.box), default=None)
        target = near if near and _overlap(near["box"], region.box) > 0.1 else None
        if target:
            severity = "high" if region.score > 0.7 else "medium"
            label = FIELD_LABEL.get(target["field"], "a field").lower()
            title = f"Possible alteration near {label}"
        else:
            severity = "low"
            title = "Possible alteration outside the value fields"
        checks.append(
            Check(
                "possible_alteration",
                severity,
                title,
                f"The {result.forensics.method} analysis marks this region"
                f" (score {region.score:.2f}). "
                "Compare it with the original receipt.",
                target["field"] if target else None,
                {
                    "box": list(region.box),
                    "score": round(region.score, 3),
                    "sources": region.sources,
                },
            )
        )

    # 4. Same instrument or same image elsewhere.
    number, ifsc = by_name.get("number"), by_name.get("ifsc")
    if number and number["norm"]:
        bank_code = ifsc["norm"][:4] if ifsc and ifsc["norm"] else None
        q = (
            select(Instrument.id, Instrument.number, Institution.name, Bank.code)
            .join(Institution, Institution.id == Instrument.institution_id)
            .join(Bank, Bank.id == Instrument.bank_id)
        )
        for iid, num, inst_name, code in (
            await db.execute(q.where(Instrument.number == number["norm"]))
        ).all():
            if bank_code is None or code == bank_code:
                checks.append(
                    Check(
                        "duplicate_instrument",
                        "high",
                        "This instrument number is already registered",
                        f"Registered to {inst_name} (instrument {num}).",
                        "number",
                        {"instrument_id": iid, "institution": inst_name},
                    )
                )
    phash = result.phash
    others = (
        await db.execute(
            select(Document.id, Document.phash, Document.entity_id, Document.entity_type).where(
                Document.phash.is_not(None), Document.id != doc_id
            )
        )
    ).all()
    for oid, other_hash, entity_id, entity_type in others:
        if other_hash and hamming(phash, other_hash) <= 4 and entity_type == "instrument":
            checks.append(
                Check(
                    "duplicate_image",
                    "medium",
                    "A near-identical scan is already on file",
                    f"Document {oid} looks the same"
                    f" (perceptual hash distance {hamming(phash, other_hash)}).",
                    None,
                    {"document_id": oid, "instrument_id": entity_id},
                )
            )
            break
    return checks
