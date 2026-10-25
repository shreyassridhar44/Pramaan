"""Reports gallery (R11): definitions, data for the preview table, and PDF export."""

from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, HTTPException, Query, Response
from pydantic import BaseModel

from app.api.deps import DbSession, OfficerReader
from app.services import portfolio as psvc
from app.services import reports as svc

router = APIRouter(prefix="/reports", tags=["reports"])


class ReportInfo(BaseModel):
    name: str
    title: str
    description: str
    params: list[str]


class ColumnOut(BaseModel):
    key: str
    label: str
    kind: str


class ReportOut(BaseModel):
    info: ReportInfo
    as_of: str
    params: dict[str, Any]
    columns: list[ColumnOut]
    rows: list[dict[str, Any]]
    totals: dict[str, Any]
    data_source: str


def _info(d: svc.ReportDef) -> ReportInfo:
    return ReportInfo(name=d.name, title=d.title, description=d.description, params=list(d.params))


def _json(key: str, v: Any) -> Any:
    """Amounts are decimal strings of paise, as everywhere in the API (DECISION D14)."""
    if key == "amount_paise":
        return str(v)
    if isinstance(v, date):
        return v.isoformat()
    return v


@router.get("", response_model=list[ReportInfo])
async def catalogue(principal: OfficerReader) -> list[ReportInfo]:
    return [_info(d) for d in svc.CATALOGUE]


async def _build(
    name: str, principal: OfficerReader, db: DbSession, as_of: date | None, days: int
) -> svc.Report:
    if name not in svc.BY_NAME:
        raise HTTPException(404, "Report not found.")
    scope = await psvc.scope_for(db, principal.user)
    return await svc.build(db, scope, name, as_of or date.today(), days)


@router.get("/{name}", response_model=ReportOut)
async def report(
    name: str,
    principal: OfficerReader,
    db: DbSession,
    as_of: date | None = None,
    days: Annotated[int, Query(ge=1, le=730)] = 90,
) -> ReportOut:
    r = await _build(name, principal, db, as_of, days)
    return ReportOut(
        info=_info(r.definition),
        as_of=r.as_of.isoformat(),
        params=r.params,
        columns=[ColumnOut(key=c.key, label=c.label, kind=c.kind) for c in r.columns],
        rows=[{k: _json(k, v) for k, v in row.items()} for row in r.rows],
        totals={k: _json(k, v) for k, v in r.totals.items()},
        data_source="synthetic",
    )


@router.get("/{name}/pdf")
async def report_pdf(
    name: str,
    principal: OfficerReader,
    db: DbSession,
    as_of: date | None = None,
    days: Annotated[int, Query(ge=1, le=730)] = 90,
) -> Response:
    r = await _build(name, principal, db, as_of, days)
    return Response(
        svc.pdf(r),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{name}-{r.as_of}.pdf"'},
    )
