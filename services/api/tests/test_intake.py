"""Intake end to end (R16 scenarios 1 and 5): upload, checks, submission, scrutiny."""

import json
from pathlib import Path

import pytest
from httpx import AsyncClient

from tests.conftest import sign_in

ASSETS = Path(__file__).resolve().parents[1] / "app" / "demo_assets"
SPEC = json.loads((ASSETS / "specimen.json").read_text())
DECLARED_GENUINE = {
    "number": SPEC["number"],
    "ifsc": SPEC["ifsc"],
    "amount": str(SPEC["amount_rupees"]),
    "issue_date": SPEC["issue"],
    "maturity_date": SPEC["maturity"],
}


async def _upload(
    client: AsyncClient, name: str, kind: str, declared: dict[str, str] | None
) -> dict:
    files = {"file": (name, (ASSETS / name).read_bytes(), "application/octet-stream")}
    data = {"kind": kind}
    if declared:
        data["declared"] = json.dumps(declared)
    r = await client.post("/api/v1/documents", files=files, data=data)
    assert r.status_code == 200, r.text
    return r.json()


async def _open_demand(client: AsyncClient) -> int:
    home = (await client.get("/api/v1/portal/home")).json()
    return next(d["id"] for d in home["demands"] if d["status"] == "open")


@pytest.mark.slow
async def test_altered_receipt_is_caught_by_figures_against_words(client: AsyncClient) -> None:
    await sign_in(client, "institution")
    declared = {**DECLARED_GENUINE, "amount": "3500000"}
    result = await _upload(client, "specimen_fdr_altered.jpg", "fdr_scan", declared)
    codes = {c["code"] for c in result["checks"]}
    assert "figures_words_mismatch" in codes
    amount = next(f for f in result["fields"] if f["field"] == "amount")
    assert amount["norm"] == "350000000"
    # The trained localiser marks the inserted digit, and the mark is mapped to the amount.
    marks = [c for c in result["checks"] if c["code"] == "possible_alteration"]
    assert any(c["field"] == "amount" and c["severity"] == "high" for c in marks)


@pytest.mark.slow
async def test_genuine_receipt_gets_no_high_alteration_mark(client: AsyncClient) -> None:
    await sign_in(client, "institution")
    result = await _upload(client, "specimen_fdr_genuine.jpg", "fdr_scan", DECLARED_GENUINE)
    marks = [c for c in result["checks"] if c["code"] == "possible_alteration"]
    assert all(c["severity"] == "low" and c["field"] is None for c in marks)


@pytest.mark.slow
async def test_submission_then_scrutiny(client: AsyncClient) -> None:
    await sign_in(client, "institution")
    wrong = {**DECLARED_GENUINE, "amount": "3500000"}
    scan = await _upload(client, "specimen_fdr_genuine.jpg", "fdr_scan", wrong)
    assert any(c["code"] == "declared_mismatch" and c["field"] == "amount" for c in scan["checks"])
    aff = await _upload(client, "specimen_affidavit_3.pdf", "affidavit_3", None)
    demand_id = await _open_demand(client)
    body = {
        "demand_id": demand_id,
        "declared": {
            "kind": "joint_fdr",
            "bank_code": SPEC["bank"],
            "branch": SPEC["branch"],
            "ifsc": SPEC["ifsc"],
            "number": SPEC["number"],
            "amount_rupees": 3500000,
            "issue_date": SPEC["issue"],
            "maturity_date": SPEC["maturity"],
            "holders": SPEC["holders"],
            "lien": True,
        },
        "fdr_document_id": scan["document_id"],
        "affidavit_document_id": aff["document_id"],
        "declaration_accepted": True,
    }
    r = await client.post("/api/v1/portal/submissions", json=body)
    assert r.status_code == 200, r.text
    instrument_id = r.json()["instrument_id"]
    assert r.json()["signals"] >= 1

    # The same instrument cannot be registered twice.
    again = await client.post("/api/v1/portal/submissions", json=body)
    assert again.status_code == 409

    client.cookies.clear()
    await sign_in(client, "bureau")
    detail = (await client.get(f"/api/v1/instruments/{instrument_id}")).json()
    assert detail["status"] == "submitted"
    assert detail["assurance"] == 0
    assert {d["kind"] for d in detail["documents"]} == {"fdr_scan", "affidavit_3"}
    amount = next(p for p in detail["provenance"] if p["field"] == "amount")
    assert amount["state"] == "conflict"
    assert amount["confirmed"] is None

    refused = await client.post(f"/api/v1/instruments/{instrument_id}/actions/verify", json={})
    assert refused.status_code == 409

    for s in detail["signals"]:
        if s["status"] == "open":
            r = await client.post(
                f"/api/v1/signals/{s['id']}/resolve",
                json={"outcome": "dismissed", "note": "Typing error confirmed by phone"},
            )
            assert r.status_code == 200

    # The declared amount still conflicts with the document, so verification stays refused
    # until the institution corrects it; returning it is the officer's path.
    returned = await client.post(
        f"/api/v1/instruments/{instrument_id}/actions/return",
        json={"reason": "Amount entered does not match the receipt"},
    )
    assert returned.status_code == 200
    assert returned.json()["status"] == "returned"


async def test_institution_cannot_open_another_institutions_document(client: AsyncClient) -> None:
    await sign_in(client, "institution")
    r = await client.get("/api/v1/documents/999999/analysis")
    assert r.status_code == 404


async def test_upload_rejects_non_documents(client: AsyncClient) -> None:
    await sign_in(client, "institution")
    r = await client.post(
        "/api/v1/documents",
        files={"file": ("x.exe", b"MZ\x90\x00binary", "application/octet-stream")},
        data={"kind": "fdr_scan"},
    )
    assert r.status_code == 422
