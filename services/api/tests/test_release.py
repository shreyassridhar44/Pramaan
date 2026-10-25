"""Release workflow end to end (R16 scenario 6): clearances, authorisation, letter, verification."""

from datetime import date
from pathlib import Path

from httpx import AsyncClient
from sqlalchemy import select

from app.db import SessionLocal
from app.models import Institution, Letter, ReleaseCase
from app.services import letters
from tests.conftest import sign_in

ASSETS = Path(__file__).resolve().parents[1] / "app" / "demo_assets"


async def _story_case(open_only: bool = False) -> int:
    async with SessionLocal() as db:
        case_id = await db.scalar(
            select(ReleaseCase.id)
            .join(Institution, Institution.id == ReleaseCase.institution_id)
            .where(
                Institution.name == "Sahyadri College of Engineering, Nashik",
                ReleaseCase.status == "in_clearance" if open_only else ReleaseCase.id > 0,
            )
            .order_by(ReleaseCase.id)
            .limit(1)
        )
    assert case_id is not None
    return case_id


async def _as(client: AsyncClient, persona: str) -> AsyncClient:
    client.cookies.clear()
    client.headers.pop("x-csrf-token", None)
    return await sign_in(client, persona)


async def test_release_story_end_to_end(client: AsyncClient) -> None:
    case_id = await _story_case(open_only=True)

    await _as(client, "bureau")
    detail = (await client.get(f"/api/v1/releases/{case_id}")).json()
    pgrc = next(c for c in detail["checks"] if c["code"] == "clearance_pgrc")
    assert pgrc["state"] == "pending"
    assert "complaint" in pgrc["detail"]
    assert detail["can_authorise"] is False
    refused = await client.post(f"/api/v1/releases/{case_id}/authorise", json={})
    assert refused.status_code == 403

    await _as(client, "authority")
    early = await client.post(f"/api/v1/releases/{case_id}/authorise", json={})
    assert early.status_code == 409
    assert "PGRC" in early.json()["error"]["message"]

    await _as(client, "vigilance")
    wrong_cell = await client.post(
        f"/api/v1/releases/{case_id}/clearances/pgrc",
        json={"decision": "clear", "reason": "Not my cell"},
    )
    assert wrong_cell.status_code == 403

    await _as(client, "pgrc")
    queue = (await client.get("/api/v1/clearances")).json()
    assert case_id in {q["row"]["id"] for q in queue}
    blocked = await client.post(
        f"/api/v1/releases/{case_id}/clearances/pgrc",
        json={"decision": "clear", "reason": "No grievance pending"},
    )
    assert blocked.status_code == 409
    for c in detail["complaints"]:
        if c["status"] == "open":
            r = await client.post(
                f"/api/v1/complaints/{c['id']}/resolve",
                json={"note": "Fee refunded, complainant confirmed"},
            )
            assert r.status_code == 204
    cleared = await client.post(
        f"/api/v1/releases/{case_id}/clearances/pgrc",
        json={"decision": "clear", "reason": "Complaint resolved"},
    )
    assert cleared.status_code == 200, cleared.text
    assert cleared.json()["row"]["ready"] is True

    await _as(client, "authority")
    ok = await client.post(
        f"/api/v1/releases/{case_id}/authorise", json={"note": "All conditions met"}
    )
    assert ok.status_code == 200, ok.text
    body = ok.json()
    assert body["detail"]["row"]["status"] in ("authorised", "closed")
    letter = body["letter"]
    assert letter["reference"].startswith("AICTE/RB/SD/")
    token = letter["verify_url"].rsplit("/", 1)[1]

    pdf = await client.get(f"/api/v1/letters/{letter['id']}/pdf")
    assert pdf.status_code == 200
    assert pdf.content.startswith(b"%PDF")

    client.cookies.clear()
    v = (await client.get(f"/api/v1/public/verify/{token}")).json()
    assert v["result"] == "genuine"
    assert v["letter"]["reference"] == letter["reference"]

    tampered = token[:-3] + ("AAA" if not token.endswith("AAA") else "BBB")
    assert (await client.get(f"/api/v1/public/verify/{tampered}")).json()[
        "result"
    ] == "not_recognised"
    assert (await client.get("/api/v1/public/verify/garbage")).json()["result"] == "not_recognised"

    await _as(client, "authority")
    rv = await client.post(
        f"/api/v1/letters/{letter['id']}/revoke", json={"reason": "Issued against wrong branch"}
    )
    assert rv.status_code == 200
    client.cookies.clear()
    after = (await client.get(f"/api/v1/public/verify/{token}")).json()
    assert after["result"] == "revoked"
    assert "wrong branch" in after["letter"]["status_note"]


async def test_reissue_supersedes_earlier_letter(seeded: None) -> None:
    async with SessionLocal() as db:
        old = await db.scalar(select(Letter).where(Letter.status == "issued").limit(1))
        assert old is not None
        new = await letters.issue(
            db,
            kind=old.kind,
            entity_type=old.entity_type,
            entity_id=old.entity_id,
            institution_id=old.institution_id,
            recipient=old.recipient,
            fields=dict(old.fields),
            actor_id=None,
            actor_label="test",
            on=date(2026, 10, 25),
        )
        assert old.status == "superseded"
        assert old.fields["superseded_by"] == new.reference
        token = letters.make_token(old.token_id)
        assert letters.read_token(token) == old.token_id
        await db.rollback()


async def test_token_from_another_key_is_not_recognised() -> None:
    from base64 import urlsafe_b64encode

    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

    message = f"{letters.issuer_key().fingerprint}.abc"
    sig = Ed25519PrivateKey.generate().sign(message.encode())
    forged = f"{message}.{urlsafe_b64encode(sig).rstrip(b'=').decode()}"
    assert letters.read_token(forged) is None


async def test_institution_sees_only_its_letters_and_cases(client: AsyncClient) -> None:
    await _as(client, "institution")
    r = await client.get("/api/v1/letters")
    assert r.status_code == 200
    home = (await client.get("/api/v1/portal/home")).json()
    assert all(lt["institution_id"] == home["institution_id"] for lt in r.json())
    other = await _story_case()
    assert (await client.get(f"/api/v1/portal/releases/{other}")).status_code == 404
    assert (await client.get("/api/v1/releases")).status_code == 403
    portal = (await client.get("/api/v1/portal/releases")).json()
    assert {d["kind"] for d in portal["required_documents"]} >= {"affidavit_6"}


async def test_cannot_apply_before_term_completes(client: AsyncClient) -> None:
    await _as(client, "institution")
    portal = (await client.get("/api/v1/portal/releases")).json()
    early = next(i for i in portal["instruments"] if not i["can_apply"])
    r = await client.post(
        "/api/v1/portal/releases",
        json={"instrument_ids": [early["id"]], "declaration_accepted": True},
    )
    assert r.status_code == 409


async def test_only_cell_officers_decide_clearances(client: AsyncClient) -> None:
    case_id = await _story_case()
    await _as(client, "section_head")
    r = await client.post(
        f"/api/v1/releases/{case_id}/clearances/grants",
        json={"decision": "clear", "reason": "Trying"},
    )
    assert r.status_code == 403


async def test_portal_application_through_desk_discharge(client: AsyncClient) -> None:
    await _as(client, "institution")
    portal = (await client.get("/api/v1/portal/releases")).json()
    target = next(i for i in portal["instruments"] if i["can_apply"])
    doc_ids = []
    for kind, name in (
        ("application_letter", "specimen_release_application.pdf"),
        ("affidavit_6", "specimen_affidavit_6.pdf"),
        ("instrument_copy", "specimen_fdr_genuine.jpg"),
        ("latest_loa_eoa", "specimen_latest_loa.pdf"),
    ):
        r = await client.post(
            "/api/v1/documents",
            files={"file": (name, (ASSETS / name).read_bytes(), "application/octet-stream")},
            data={"kind": kind},
        )
        assert r.status_code == 200, r.text
        doc_ids.append(r.json()["document_id"])
    body = {"instrument_ids": [target["id"]], "document_ids": doc_ids, "declaration_accepted": True}
    preview = (await client.post("/api/v1/portal/releases/preview", json=body)).json()
    docs_check = next(c for c in preview["checks"] if c["code"] == "documents")
    assert docs_check["state"] == "pass"
    applied = await client.post("/api/v1/portal/releases", json=body)
    assert applied.status_code == 200, applied.text
    case_id = applied.json()["case_id"]
    again = await client.post("/api/v1/portal/releases", json=body)
    assert again.status_code in (404, 409)

    for cell in ("pgrc", "vigilance", "grants"):
        await _as(client, cell)
        detail = (await client.get(f"/api/v1/releases/{case_id}")).json()
        for c in detail["complaints"]:
            if c["status"] == "open" and cell == "pgrc":
                await client.post(
                    f"/api/v1/complaints/{c['id']}/resolve", json={"note": "Resolved in test"}
                )
        r = await client.post(
            f"/api/v1/releases/{case_id}/clearances/{cell}",
            json={"decision": "clear", "reason": "No objection"},
        )
        assert r.status_code == 200, r.text

    await _as(client, "authority")
    ok = (await client.post(f"/api/v1/releases/{case_id}/authorise", json={})).json()
    assert ok["detail"]["row"]["status"] == "authorised"
    assert ok["awaiting_bank"] == 1

    await _as(client, "bank")
    inbox = (await client.get("/api/v1/bank/requests")).json()
    req = next(i for i in inbox if i["kind"] == "discharge")
    signed = await client.post(
        f"/api/v1/bank/requests/{req['id']}/respond", json={"action": "discharge"}
    )
    assert signed.status_code == 200, signed.text

    await _as(client, "institution")
    final = (await client.get(f"/api/v1/portal/releases/{case_id}")).json()
    assert final["row"]["status"] == "closed"
    assert final["instruments_detail"][0]["released_on"]
