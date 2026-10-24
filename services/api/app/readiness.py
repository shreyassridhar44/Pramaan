"""Readiness checks for /readyz. Each check returns "ok" or a short failure reason."""

from collections.abc import Awaitable, Callable

Check = Callable[[], Awaitable[str]]

_checks: dict[str, Check] = {}


def register(name: str, check: Check) -> None:
    _checks[name] = check


async def run_checks() -> dict[str, str]:
    results: dict[str, str] = {}
    for name, check in _checks.items():
        try:
            results[name] = await check()
        except Exception as exc:
            results[name] = f"error: {type(exc).__name__}"
    return results


def register_default_checks() -> None:
    from sqlalchemy import text

    from app.db import engine

    async def database() -> str:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return "ok"

    register("database", database)
