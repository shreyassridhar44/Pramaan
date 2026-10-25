"""Reports (R11): every report renders, and totals reconcile with the summary and the registry."""

import pytest
from httpx import AsyncClient

from app.services.reports import CATALOGUE
from tests.conftest import sign_in


@pytest.mark.parametrize("name", [r.name for r in CATALOGUE])
async def test_report_renders_with_pdf(client: AsyncClient, name: str) -> None:
    await sign_in(client, "bureau")
    r = await client.get(f"/api/v1/reports/{name}")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["data_source"] == "synthetic"
    assert body["columns"]
    assert body["totals"]["rows"] == len(body["rows"])
    pdf = await client.get(f"/api/v1/reports/{name}/pdf")
    assert pdf.status_code == 200
    assert pdf.content.startswith(b"%PDF")


async def test_totals_reconcile_with_summary_and_registry(client: AsyncClient) -> None:
    await sign_in(client, "bureau")
    summary = (await client.get("/api/v1/portfolio/summary")).json()

    regions = (await client.get("/api/v1/reports/region-exposure")).json()
    assert regions["totals"]["count"] == summary["held_count"]
    assert regions["totals"]["amount_paise"] == summary["held_paise"]

    banks = (await client.get("/api/v1/reports/bank-exposure")).json()
    assert banks["totals"]["amount_paise"] == summary["held_paise"]

    pending = (await client.get("/api/v1/reports/pending-verifications")).json()
    assert pending["totals"]["rows"] == summary["pending_verification_count"]
    registry = (
        await client.get(
            "/api/v1/instruments",
            params=[("status", "submitted"), ("status", "under_scrutiny"), ("limit", 1)],
        )
    ).json()
    assert registry["total"] == summary["pending_verification_count"]


async def test_reports_are_scoped_and_unknown_names_404(client: AsyncClient) -> None:
    await sign_in(client, "regional")
    r = (await client.get("/api/v1/reports/region-exposure")).json()
    assert {row["region"] for row in r["rows"]} <= {"Western Region"}
    assert (await client.get("/api/v1/reports/nothing")).status_code == 404

    client.cookies.clear()
    client.headers.pop("x-csrf-token", None)
    await sign_in(client, "institution")
    assert (await client.get("/api/v1/reports")).status_code == 403
