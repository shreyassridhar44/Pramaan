"""Seed the database with the synthetic portfolio.

Usage: uv run python -m scripts.seed [--seed 2026] [--anchor YYYY-MM-DD] [--institutions 2600]
"""

import argparse
import asyncio
import sys
from datetime import date

from app.db import SessionLocal, engine
from app.seed.load import reset_and_seed


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", type=int, default=2026)
    parser.add_argument("--anchor", type=date.fromisoformat, default=None)
    parser.add_argument("--institutions", type=int, default=2600)
    args = parser.parse_args()
    async with SessionLocal() as session:
        counts = await reset_and_seed(session, args.seed, args.anchor, args.institutions)
    await engine.dispose()
    width = max(len(k) for k in counts)
    for name, n in counts.items():
        print(f"{name.ljust(width)}  {n:>7}")


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
