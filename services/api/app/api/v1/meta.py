from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import select

from app.api.deps import CurrentPrincipal, DbSession
from app.domain.types import Role
from app.models import Bank, Region, User

router = APIRouter(prefix="/meta", tags=["meta"])


class Option(BaseModel):
    code: str
    name: str


class BankOption(Option):
    integration: str
    simulated: bool


class OfficerOption(BaseModel):
    id: int
    name: str
    role: str
    region: str | None


class Meta(BaseModel):
    regions: list[Option]
    banks: list[BankOption]
    officers: list[OfficerOption]


ASSIGNABLE = (Role.BUREAU_OFFICER, Role.REGIONAL_OFFICER, Role.SECTION_HEAD)


@router.get("", response_model=Meta)
async def meta(principal: CurrentPrincipal, db: DbSession) -> Meta:
    regions = (await db.scalars(select(Region).order_by(Region.id))).all()
    banks = (await db.scalars(select(Bank).order_by(Bank.name))).all()
    codes = {r.id: r.code for r in regions}
    officers = (
        await db.scalars(
            select(User)
            .where(User.role.in_(ASSIGNABLE), User.is_active.is_(True))
            .order_by(User.name)
        )
    ).all()
    return Meta(
        regions=[Option(code=r.code, name=r.name) for r in regions],
        banks=[
            BankOption(
                code=b.code, name=b.name, integration=b.integration, simulated=b.is_simulated
            )
            for b in banks
        ],
        officers=[
            OfficerOption(
                id=u.id,
                name=u.name,
                role=u.role,
                region=codes.get(u.region_id) if u.region_id else None,
            )
            for u in officers
        ],
    )
