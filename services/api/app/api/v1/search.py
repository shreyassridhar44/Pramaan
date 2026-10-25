"""Plain-language registry search: interpretation only. The officer reviews and applies it."""

from datetime import date

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.api.deps import OfficerReader
from app.services import search as svc

router = APIRouter(prefix="/search", tags=["search"])


class InterpretBody(BaseModel):
    text: str = Field(min_length=1, max_length=500)


class Chip(BaseModel):
    key: str
    value: str
    label: str


class InterpretResult(BaseModel):
    filters: svc.Filters
    chips: list[Chip]
    source: str
    unrecognised: list[str]
    note: str | None


@router.post("/interpret", response_model=InterpretResult)
async def interpret(body: InterpretBody, principal: OfficerReader) -> InterpretResult:
    result = svc.interpret(body.text, date.today())
    return InterpretResult(
        filters=result.filters,
        chips=[Chip(**c) for c in svc.describe(result.filters)],
        source=result.source,
        unrecognised=result.unrecognised,
        note=result.note,
    )
