import json
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy import select

from app.api.deps import CurrentPrincipal, DbSession
from app.config import get_settings
from app.domain.types import Role
from app.models import Analysis, Document, Instrument, ReleaseCase
from app.services import audit
from app.services.documents.pipeline import MAX_BYTES, UnsupportedDocument
from app.services.documents.service import analysis_payload, upload_and_analyse
from app.services.storage import storage

router = APIRouter(prefix="/documents", tags=["documents"])
DEMO_ASSETS = Path(__file__).resolve().parents[2] / "demo_assets"
KINDS = {
    "fdr_scan",
    "affidavit_3",
    "affidavit_6",
    "application_letter",
    "instrument_copy",
    "latest_loa_eoa",
    "other",
}


async def _visible(db: DbSession, principal: CurrentPrincipal, doc: Document) -> None:
    """Institution users see only their own documents; cells and banks see none here."""
    role = principal.role
    if role in (Role.CELL_OFFICER, Role.BANK_OFFICER):
        raise HTTPException(404, "Document not found.")
    if role == Role.INSTITUTION_USER:
        own = doc.entity_type == "pending" and doc.uploaded_by == principal.user.id
        if doc.entity_type == "instrument":
            inst = await db.get(Instrument, doc.entity_id)
            own = inst is not None and inst.institution_id == principal.user.institution_id
        if doc.entity_type == "release_case":
            case = await db.get(ReleaseCase, doc.entity_id)
            own = case is not None and case.institution_id == principal.user.institution_id
        if not own:
            raise HTTPException(404, "Document not found.")


@router.post("")
async def upload(
    principal: CurrentPrincipal,
    db: DbSession,
    file: Annotated[UploadFile, File()],
    kind: Annotated[str, Form()] = "fdr_scan",
    declared: Annotated[str | None, Form()] = None,
) -> dict[str, Any]:
    """Uploads a document. FDR scans are analysed straight away (OCR, fields, forensics, checks)."""
    if principal.role not in (
        Role.INSTITUTION_USER,
        Role.BUREAU_OFFICER,
        Role.SECTION_HEAD,
        Role.ADMIN,
    ):
        raise HTTPException(403, "Your role cannot upload documents.")
    if kind not in KINDS:
        raise HTTPException(422, "Unknown document kind.")
    data = await file.read(MAX_BYTES + 1)
    try:
        declared_values = json.loads(declared) if declared else None
        result = await upload_and_analyse(
            db,
            data=data,
            filename=file.filename or "upload",
            kind=kind,
            uploaded_by=principal.user.id,
            institution_id=principal.user.institution_id,
            declared=declared_values,
        )
    except UnsupportedDocument as exc:
        raise HTTPException(422, str(exc)) from exc
    await audit.append(
        db,
        actor_id=principal.user.id,
        actor_label=principal.label,
        action="document.uploaded",
        entity_type="document",
        entity_id=result["document_id"],
        data={"kind": kind},
    )
    await db.commit()
    return result


@router.get("/{document_id}/analysis")
async def get_analysis(
    document_id: int, principal: CurrentPrincipal, db: DbSession
) -> dict[str, Any]:
    doc = await db.get(Document, document_id)
    if doc is None:
        raise HTTPException(404, "Document not found.")
    await _visible(db, principal, doc)
    a = await db.scalar(
        select(Analysis).where(Analysis.document_id == doc.id).order_by(Analysis.id.desc())
    )
    if a is None:
        return {
            "document_id": doc.id,
            "kind": doc.kind,
            "filename": doc.filename,
            "analysed": False,
        }
    return analysis_payload(doc, a)


async def _image(
    db: DbSession, principal: CurrentPrincipal, document_id: int, which: str
) -> Response:
    doc = await db.get(Document, document_id)
    if doc is None:
        raise HTTPException(404, "Document not found.")
    await _visible(db, principal, doc)
    a = await db.scalar(
        select(Analysis).where(Analysis.document_id == doc.id).order_by(Analysis.id.desc())
    )
    if a is None or not a.forensics:
        raise HTTPException(404, "No analysed page for this document.")
    key = a.forensics[f"{which}_key"]
    media = "image/jpeg" if which == "page" else "image/png"
    await audit.append(
        db,
        actor_id=principal.user.id,
        actor_label=principal.label,
        action="document.viewed",
        entity_type="document",
        entity_id=doc.id,
        data={"part": which},
    )
    await db.commit()
    return Response(
        storage().get(key), media_type=media, headers={"Cache-Control": "private, max-age=300"}
    )


@router.get("/{document_id}/page")
async def page(document_id: int, principal: CurrentPrincipal, db: DbSession) -> Response:
    return await _image(db, principal, document_id, "page")


@router.get("/{document_id}/heatmap")
async def heatmap(document_id: int, principal: CurrentPrincipal, db: DbSession) -> Response:
    return await _image(db, principal, document_id, "heatmap")


SPECIMENS = {
    "genuine": ("specimen_fdr_genuine.jpg", "image/jpeg"),
    "altered": ("specimen_fdr_altered.jpg", "image/jpeg"),
    "application_letter": ("specimen_release_application.pdf", "application/pdf"),
    "affidavit_6": ("specimen_affidavit_6.pdf", "application/pdf"),
    "latest_loa_eoa": ("specimen_latest_loa.pdf", "application/pdf"),
}


@router.get("/specimens/{name}")
async def specimen(name: str, principal: CurrentPrincipal) -> Response:
    """Synthetic specimen documents for trying the submission and release flows. Demo mode only."""
    if not get_settings().demo_mode or name not in SPECIMENS:
        raise HTTPException(404, "Not found")
    filename, mime = SPECIMENS[name]
    return Response(
        (DEMO_ASSETS / filename).read_bytes(),
        media_type=mime,
        headers={"Content-Disposition": f'attachment; filename="{filename.replace("_", "-")}"'},
    )
