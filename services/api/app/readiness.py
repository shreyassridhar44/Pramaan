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

    async def queue() -> str:
        from redis.asyncio import Redis

        from app.config import get_settings

        client = Redis.from_url(get_settings().redis_url, socket_timeout=2)
        try:
            await client.ping()
        finally:
            await client.aclose()
        return "ok"

    async def storage() -> str:
        from app.services.storage import storage as get_storage

        get_storage().exists("readyz-probe")
        return "ok"

    async def models() -> str:
        from pathlib import Path

        from app.config import get_settings

        root = Path(get_settings().models_dir)
        missing = [n for n in ("localiser.onnx", "field_extractor.txt") if not (root / n).exists()]
        return "ok" if not missing else "missing " + ", ".join(missing) + " (classical fallback)"

    register("queue", queue)
    register("storage", storage)
    register("models", models)
