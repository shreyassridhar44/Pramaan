from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import select

from app.api.deps import CurrentPrincipal, DbSession
from app.models import Bank, Region

router = APIRouter(prefix="/meta", tags=["meta"])


class Option(BaseModel):
    code: str
    name: str


class BankOption(Option):
    integration: str
    simulated: bool


class Meta(BaseModel):
    regions: list[Option]
    banks: list[BankOption]


@router.get("", response_model=Meta)
async def meta(principal: CurrentPrincipal, db: DbSession) -> Meta:
    regions = (await db.scalars(select(Region).order_by(Region.id))).all()
    banks = (await db.scalars(select(Bank).order_by(Bank.name))).all()
    return Meta(
        regions=[Option(code=r.code, name=r.name) for r in regions],
        banks=[
            BankOption(
                code=b.code, name=b.name, integration=b.integration, simulated=b.is_simulated
            )
            for b in banks
        ],
    )
