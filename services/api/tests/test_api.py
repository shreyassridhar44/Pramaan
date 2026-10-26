from httpx import AsyncClient
from sqlalchemy import select, update

from tests.conftest import ANCHOR, sign_in

AS_OF = {"as_of": ANCHOR.isoformat()}


class TestAuth:
    async def test_wrong_password_is_rejected_without_detail(self, client: AsyncClient) -> None:
        r = await client.post(
            "/api/v1/auth/login", json={"email": "ananya.iyer@aicte.demo", "password": "nope"}
        )
        assert r.status_code == 401
        assert r.json()["error"]["message"] == "Email or password is incorrect."

    async def test_password_login_and_me(self, client: AsyncClient) -> None:
        r = await client.post(
            "/api/v1/auth/login",
            json={"email": "ananya.iyer@aicte.demo", "password": "Pramaan@2026"},
        )
        assert r.status_code == 200
        me = await client.get("/api/v1/auth/me")
        assert me.json()["role"] == "bureau_officer"

    async def test_personas_listed_in_demo_mode(self, client: AsyncClient) -> None:
        r = await client.get("/api/v1/auth/personas")
        keys = {p["key"] for p in r.json()}
        assert {"bureau", "regional", "institution", "bank", "pgrc", "auditor"} <= keys

    async def test_unauthenticated_requests_are_refused(self, client: AsyncClient) -> None:
        r = await client.get("/api/v1/portfolio/summary")
        assert r.status_code == 401

    async def test_state_change_without_csrf_header_is_refused(self, client: AsyncClient) -> None:
        await sign_in(client, "auditor")
        del client.headers["x-csrf-token"]
        r = await client.post("/api/v1/audit/verify")
        assert r.status_code == 403


class TestScopes:
    async def test_regional_officer_sees_only_their_region(self, client: AsyncClient) -> None:
        await sign_in(client, "regional")
        summary = (await client.get("/api/v1/portfolio/summary", params=AS_OF)).json()
        regions = (await client.get("/api/v1/portfolio/regions", params=AS_OF)).json()
        assert {r["code"] for r in regions} == {"western"}
        page = (await client.get("/api/v1/instruments", params={**AS_OF, "limit": 500})).json()
        assert page["items"]
        assert {i["region"] for i in page["items"]} == {"western"}
        assert page["total"] == summary["held_count"]

    async def test_regional_officer_cannot_open_other_region_instrument(
        self, client: AsyncClient
    ) -> None:
        await sign_in(client, "bureau")
        page = (
            await client.get("/api/v1/instruments", params={**AS_OF, "region": "southern"})
        ).json()
        other_id = page["items"][0]["id"]
        client.cookies.clear()
        await sign_in(client, "regional")
        r = await client.get(f"/api/v1/instruments/{other_id}", params=AS_OF)
        assert r.status_code == 404

    async def test_institution_user_sees_only_own_instruments(self, client: AsyncClient) -> None:
        me = await sign_in(client, "institution")
        inst_id = (await me.get("/api/v1/auth/me")).json()["institution_id"]
        page = (await client.get("/api/v1/instruments", params=AS_OF)).json()
        assert page["items"]
        assert {i["institution_id"] for i in page["items"]} == {inst_id}

    async def test_institution_user_cannot_read_portfolio(self, client: AsyncClient) -> None:
        await sign_in(client, "institution")
        assert (await client.get("/api/v1/portfolio/summary")).status_code == 403

    async def test_cell_officer_cannot_browse_registry(self, client: AsyncClient) -> None:
        await sign_in(client, "pgrc")
        assert (await client.get("/api/v1/instruments")).status_code == 403


class TestPortfolio:
    async def test_registry_reconciles_with_summary(self, client: AsyncClient) -> None:
        await sign_in(client, "bureau")
        summary = (await client.get("/api/v1/portfolio/summary", params=AS_OF)).json()
        page = (await client.get("/api/v1/instruments", params={**AS_OF, "limit": 1})).json()
        assert page["total"] == summary["held_count"]
        assert page["total_paise"] == summary["held_paise"]
        split = summary["by_assurance_paise"]
        assert sum(int(v) for v in split.values()) == int(summary["held_paise"])

    async def test_action_queue_is_ranked_by_severity(self, client: AsyncClient) -> None:
        await sign_in(client, "bureau")
        items = (
            await client.get("/api/v1/portfolio/action-queue", params={**AS_OF, "limit": 50})
        ).json()
        ranks = [{"high": 0, "medium": 1, "low": 2}[i["severity"]] for i in items]
        assert ranks == sorted(ranks)

    async def test_timeline_has_requested_weeks(self, client: AsyncClient) -> None:
        await sign_in(client, "bureau")
        steps = (
            await client.get(
                "/api/v1/portfolio/timeline", params={"start": ANCHOR.isoformat(), "weeks": 26}
            )
        ).json()
        assert len(steps) == 26
        assert steps[0]["start"] == ANCHOR.isoformat()

    async def test_impact_is_labelled_synthetic(self, client: AsyncClient) -> None:
        await sign_in(client, "bureau")
        impact = (await client.get("/api/v1/portfolio/impact", params=AS_OF)).json()
        assert impact["data_source"] == "synthetic"


class TestInstrumentDetail:
    async def test_conflict_is_shown_per_field_with_diff(self, client: AsyncClient) -> None:
        await sign_in(client, "bureau")
        page = (
            await client.get("/api/v1/instruments", params={**AS_OF, "status": "discrepancy"})
        ).json()
        assert page["items"], "seed should contain at least one discrepancy"
        detail = (
            await client.get(f"/api/v1/instruments/{page['items'][0]['id']}", params=AS_OF)
        ).json()
        assert detail["assurance"] == 0
        conflicts = [p for p in detail["provenance"] if p["state"] == "conflict"]
        assert conflicts
        assert conflicts[0]["confirmed"] is not None
        assert conflicts[0]["declared"]["norm"] != conflicts[0]["confirmed"]["norm"]

    async def test_declared_only_fields_have_no_confirmed_value(self, client: AsyncClient) -> None:
        await sign_in(client, "bureau")
        page = (await client.get("/api/v1/instruments", params={**AS_OF, "assurance": 0})).json()
        for item in page["items"][:5]:
            d = (await client.get(f"/api/v1/instruments/{item['id']}", params=AS_OF)).json()
            for row in d["provenance"]:
                if row["state"] == "pending":
                    assert row["confirmed"] is None


class TestAudit:
    async def test_chain_verifies_and_detects_tampering(self, client: AsyncClient) -> None:
        from app.db import SessionLocal
        from app.models import AuditEntry
        from app.services.audit import verify_chain

        await sign_in(client, "auditor")
        result = (await client.post("/api/v1/audit/verify")).json()
        assert result["valid"] and result["checked"] > 100

        async with SessionLocal() as session:
            target = await session.scalar(
                select(AuditEntry.id).order_by(AuditEntry.id).offset(50).limit(1)
            )
            await session.execute(
                update(AuditEntry)
                .where(AuditEntry.id == target)
                .values(data={"type": "edited outside the application"})
            )
            check = await verify_chain(session)
            await session.rollback()
        assert not check.valid
        assert check.first_bad_id == target


async def test_pulse_counts_daily_activity_in_scope(client: AsyncClient) -> None:
    await sign_in(client, "bureau")
    days = (await client.get("/api/v1/portfolio/pulse", params={**AS_OF, "days": 60})).json()
    assert len(days) == 60 and days[-1]["day"] == ANCHOR.isoformat()
    assert sum(d["bank"] + d["submitted"] + d["checked"] + d["reminders"] for d in days) > 0
    await sign_in(client, "institution")
    assert (await client.get("/api/v1/portfolio/pulse")).status_code == 403
