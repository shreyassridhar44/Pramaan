from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.deps import DbSession, Principal, require_roles
from app.config import get_settings
from app.domain.types import Role
from app.seed.load import reset_and_seed

router = APIRouter(prefix="/demo", tags=["demo"])

Admin = Annotated[Principal, Depends(require_roles(Role.ADMIN))]


class ResetResult(BaseModel):
    counts: dict[str, int]


@router.post("/reset", response_model=ResetResult)
async def reset(principal: Admin, db: DbSession) -> ResetResult:
    """Replaces all data with a fresh synthetic portfolio anchored to today. Demo mode only."""
    if not get_settings().demo_mode:
        raise HTTPException(404, "Not found")
    return ResetResult(counts=await reset_and_seed(db))
