"""Integration-test setup: a dedicated database seeded once per session with a small portfolio."""

import os

os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://pramaan:pramaan@localhost:5432/pramaan_test"
)
os.environ["ENVIRONMENT"] = "test"
os.environ["DEMO_MODE"] = "true"

from collections.abc import AsyncIterator
from datetime import date

import asyncpg
import pytest
from httpx import ASGITransport, AsyncClient

ANCHOR = date(2026, 10, 24)


async def _ensure_database() -> None:
    from app.config import get_settings

    # Settings normalise any driver prefix (CI passes postgresql+psycopg) to asyncpg.
    url = get_settings().database_url.replace("postgresql+asyncpg", "postgresql")
    base, name = url.rsplit("/", 1)
    conn = await asyncpg.connect(f"{base}/postgres")
    try:
        exists = await conn.fetchval("SELECT 1 FROM pg_database WHERE datname = $1", name)
        if not exists:
            await conn.execute(f'CREATE DATABASE "{name}"')
    finally:
        await conn.close()


@pytest.fixture(scope="session")
async def seeded() -> AsyncIterator[None]:
    await _ensure_database()
    import app.models  # noqa: F401
    from app.db import Base, SessionLocal, engine
    from app.seed.load import reset_and_seed

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    async with SessionLocal() as session:
        await reset_and_seed(session, seed=7, anchor=ANCHOR, institutions=260)
    yield
    await engine.dispose()


@pytest.fixture
async def client(seeded: None) -> AsyncIterator[AsyncClient]:
    from app.main import create_app

    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def sign_in(client: AsyncClient, persona: str) -> AsyncClient:
    response = await client.post(f"/api/v1/auth/persona/{persona}")
    assert response.status_code == 200, response.text
    client.headers["x-csrf-token"] = client.cookies["pramaan_csrf"]
    return client
