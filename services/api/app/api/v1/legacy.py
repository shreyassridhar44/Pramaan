import time
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from pydantic import BaseModel

from app.api.deps import DbSession, Principal, require_roles
from app.domain.types import Role
from app.services import audit
from app.services import legacy as svc

router = APIRouter(prefix="/legacy", tags=["legacy"])

Importer = Annotated[
    Principal, Depends(require_roles(Role.BUREAU_OFFICER, Role.SECTION_HEAD, Role.ADMIN))
]
MAX_BYTES = 8 * 1024 * 1024
SHOW_MATCHES = 150
CODE = {"match": "m", "differs": "d", "new": "n", "duplicate": "u", "incomplete": "i"}


class Difference(BaseModel):
    field: str
    in_register: str
    pramaan: str


class FindingOut(BaseModel):
    line: int
    outcome: str
    number: str
    institution: str
    bank: str
    amount_paise: str | None
    instrument_id: int | None
    differences: list[Difference]
    problem: str | None


class ReconcileReport(BaseModel):
    filename: str
    rows_read: int
    columns: dict[str, int]
    counts: dict[str, int]
    matched_value_paise: str
    # One letter per row in file order (m, d, n, u, i), for drawing the whole register at once.
    sequence: str
    findings: list[FindingOut]
    elapsed_ms: int
    data_source: str


@router.get("/sample", response_class=Response)
async def sample(principal: Importer, db: DbSession) -> Response:
    """A synthetic legacy register built from the demo records, roughened like a real one."""
    data = await svc.sample_register(db)
    return Response(
        data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="legacy-fdr-register-sample.xlsx"'},
    )


@router.post("/reconcile", response_model=ReconcileReport)
async def reconcile(
    principal: Importer, db: DbSession, file: Annotated[UploadFile, File()]
) -> ReconcileReport:
    """Reads a register (xlsx or csv) and compares every row with Pramaan. Writes nothing except
    an audit entry; differences are for an officer to resolve."""
    name = file.filename or "register"
    if not name.lower().endswith((".xlsx", ".xlsm", ".csv")):
        raise HTTPException(422, "Upload an Excel (.xlsx) or CSV file.")
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "The file is larger than 8 MB.")
    started = time.perf_counter()
    try:
        cols, rows = svc.read_upload(name, data)
    except Exception as e:  # openpyxl raises many types for damaged files
        raise HTTPException(422, "The file could not be read as a spreadsheet.") from e
    if "number" not in cols:
        raise HTTPException(422, "No column for the deposit number was found in the header.")
    findings = svc.run(await svc.known_records(db), rows)
    counts = {k: 0 for k in ("match", "differs", "new", "duplicate", "incomplete")}
    matched = 0
    for f in findings:
        counts[f.outcome] += 1
        if f.outcome == "match" and f.row.amount_paise:
            matched += f.row.amount_paise
    shown = [f for f in findings if f.outcome != "match"] + [
        f for f in findings if f.outcome == "match"
    ][:SHOW_MATCHES]
    shown.sort(key=lambda f: f.row.line)
    await audit.append(
        db,
        actor_id=principal.user.id,
        actor_label=principal.label,
        action="legacy.reconciled",
        entity_type="legacy_register",
        entity_id=None,
        data={"filename": name, "rows": len(rows), **counts},
    )
    await db.commit()
    return ReconcileReport(
        filename=name,
        rows_read=len(rows),
        columns=cols,
        counts=counts,
        matched_value_paise=str(matched),
        sequence="".join(CODE[f.outcome] for f in findings),
        findings=[
            FindingOut(
                line=f.row.line,
                outcome=f.outcome,
                number=f.row.number_raw,
                institution=f.row.institution,
                bank=f.row.bank,
                amount_paise=str(f.row.amount_paise) if f.row.amount_paise is not None else None,
                instrument_id=f.instrument_id,
                differences=[
                    Difference(field=a, in_register=b, pramaan=c) for a, b, c in f.differences
                ],
                problem=f.problem,
            )
            for f in shown
        ],
        elapsed_ms=round((time.perf_counter() - started) * 1000),
        data_source="synthetic",
    )
