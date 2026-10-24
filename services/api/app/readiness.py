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
