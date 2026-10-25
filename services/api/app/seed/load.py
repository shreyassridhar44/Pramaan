"""Writes a generated dataset to the database, replacing existing data."""

import logging
import time
from datetime import date

from sqlalchemy import insert, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import Base
from app.seed.portfolio import DEMO_PASSWORD, Generator
from app.services.auth import hash_password

log = logging.getLogger("pramaan.seed")

# Insert order respects foreign keys.
ORDER = (
    "regions",
    "banks",
    "sim_bank_keys",
    "institutions",
    "users",
    "programmes",
    "rules",
    "demands",
    "instruments",
    "sim_bank_deposits",
    "field_observations",
    "signals",
    "events",
    "bank_requests",
    "bank_messages",
    "complaints",
    "release_cases",
    "release_case_instruments",
    "clearances",
    "escalations",
    "reminders",
    "audit_log",
    "data_version",
)
BATCH = 5000


async def reset_and_seed(
    session: AsyncSession, seed: int = 2026, anchor: date | None = None, institutions: int = 2600
) -> dict[str, int]:
    started = time.perf_counter()
    anchor = anchor or date.today()
    ds = Generator(seed, anchor, institutions).build(hash_password(DEMO_PASSWORD))

    tables = ", ".join(t.name for t in reversed(Base.metadata.sorted_tables))
    await session.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
    counts: dict[str, int] = {}
    for name in ORDER:
        rows = ds.rows.get(name, [])
        table = Base.metadata.tables[name]
        for i in range(0, len(rows), BATCH):
            await session.execute(insert(table), rows[i : i + BATCH])
        counts[name] = len(rows)
        if rows and "id" in table.c and table.c.id.autoincrement:
            # Table names come from our own metadata, never from input.
            sql = (
                f"SELECT setval(pg_get_serial_sequence('{name}', 'id'), "  # noqa: S608
                f"(SELECT COALESCE(MAX(id), 1) FROM {name}))"
            )
            await session.execute(text(sql))
    await session.commit()
    log.info(
        "seeded",
        extra={"fields": {"counts": counts, "seconds": round(time.perf_counter() - started, 1)}},
    )
    return counts
