"""arq worker: scheduled monitoring and outbox delivery.

Run with: uv run arq app.workers.settings.WorkerSettings
"""

from datetime import date
from typing import Any

from arq import cron
from arq.connections import RedisSettings

from app.config import get_settings
from app.db import SessionLocal
from app.services.monitoring import run_monitoring, send_outbox


async def daily_monitoring(ctx: dict[str, Any]) -> dict[str, int]:
    async with SessionLocal() as db:
        s = await run_monitoring(db, date.today())
    return {"reminders": s.reminders, "escalations": s.escalations}


async def deliver_outbox(ctx: dict[str, Any]) -> int:
    async with SessionLocal() as db:
        sent = await send_outbox(db)
        await db.commit()
    return sent


class WorkerSettings:
    redis_settings = RedisSettings.from_dsn(get_settings().redis_url)
    functions = (daily_monitoring, deliver_outbox)
    # 06:00 IST is 00:30 UTC.
    cron_jobs = (
        cron(daily_monitoring, hour=0, minute=30),
        cron(deliver_outbox, minute={0, 15, 30, 45}),
    )
