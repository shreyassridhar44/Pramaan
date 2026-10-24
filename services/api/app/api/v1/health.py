from fastapi import APIRouter
from pydantic import BaseModel

from app.config import get_settings

router = APIRouter(tags=["health"])


class Health(BaseModel):
    status: str
    environment: str
    demo_mode: bool


class Readiness(BaseModel):
    status: str
    checks: dict[str, str]


@router.get("/healthz", response_model=Health)
async def healthz() -> Health:
    settings = get_settings()
    return Health(status="ok", environment=settings.environment, demo_mode=settings.demo_mode)


@router.get("/readyz", response_model=Readiness)
async def readyz() -> Readiness:
    # Dependency checks are registered as the services they cover are added (Step 2 onwards).
    from app.readiness import run_checks

    checks = await run_checks()
    status = "ok" if all(v == "ok" for v in checks.values()) else "degraded"
    return Readiness(status=status, checks=checks)
