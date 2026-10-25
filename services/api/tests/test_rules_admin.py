"""Rule administration: versioned changes with validation, roles and effective dates."""

from datetime import date, timedelta

from httpx import AsyncClient

from app.db import SessionLocal
from app.services.facts import load_rules
from tests.conftest import sign_in


async def _reminders(client: AsyncClient) -> dict:
    rules = (await client.get("/api/v1/rules")).json()
    return next(r for r in rules if r["code"] == "monitoring.reminders")


async def test_rules_listed_with_references(client: AsyncClient) -> None:
    await sign_in(client, "bureau")
    rules = (await client.get("/api/v1/rules")).json()
    codes = {r["code"] for r in rules}
    assert {"demand.rate_card", "monitoring.reminders", "release"} <= codes
    rate = next(r for r in rules if r["code"] == "demand.rate_card")
    assert "Table 1.4" in rate["aph_ref"]
    assert "_note" not in rate["current"]["params"]
    denied = await client.post(
        "/api/v1/rules/monitoring.reminders/versions",
        json={"params": {}, "effective_from": date.today().isoformat(), "note": "Not mine"},
    )
    assert denied.status_code == 403


async def test_new_version_validated_and_applied(client: AsyncClient) -> None:
    await sign_in(client, "section_head")
    current = (await _reminders(client))["current"]["params"]
    bad = {**current, "reminder_offsets_days": [90, 90, 7]}
    r = await client.post(
        "/api/v1/rules/monitoring.reminders/versions",
        json={"params": bad, "effective_from": date.today().isoformat(), "note": "Repeat offsets"},
    )
    assert r.status_code == 422
    past = await client.post(
        "/api/v1/rules/monitoring.reminders/versions",
        json={
            "params": current,
            "effective_from": (date.today() - timedelta(days=1)).isoformat(),
            "note": "Backdated change",
        },
    )
    assert past.status_code == 422

    future = {**current, "reminder_offsets_days": [120, 90, 60, 30, 7, 0]}
    later = date.today() + timedelta(days=30)
    r = await client.post(
        "/api/v1/rules/monitoring.reminders/versions",
        json={
            "params": future,
            "effective_from": later.isoformat(),
            "note": "Add T-120 next month",
        },
    )
    assert r.status_code == 200, r.text
    async with SessionLocal() as db:
        assert 120 not in (await load_rules(db)).maturity.reminder_offsets_days
        assert 120 in (await load_rules(db, later)).maturity.reminder_offsets_days
    body = r.json()
    assert body["current"]["params"]["reminder_offsets_days"] == current["reminder_offsets_days"]
    assert body["history"][0]["note"] == "Add T-120 next month"
