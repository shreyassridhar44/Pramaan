from httpx import AsyncClient

from tests.conftest import sign_in


async def test_drill_breaks_the_chain_and_restore_mends_it(client: AsyncClient) -> None:
    await sign_in(client, "auditor")
    assert (await client.post("/api/v1/audit/verify")).json()["valid"] is True

    drill = (await client.post("/api/v1/demo/tamper-drill")).json()
    assert drill["active"] and drill["before"] != drill["after"]
    assert (await client.post("/api/v1/demo/tamper-drill")).status_code == 409

    broken = (await client.post("/api/v1/audit/verify")).json()
    assert broken["valid"] is False
    assert broken["first_bad_id"] == drill["entry_id"]

    restored = (await client.post("/api/v1/demo/tamper-drill/restore")).json()
    assert restored["entry_id"] == drill["entry_id"] and restored["after"] == drill["before"]
    assert (await client.post("/api/v1/audit/verify")).json()["valid"] is True


async def test_drill_needs_an_audit_role(client: AsyncClient) -> None:
    await sign_in(client, "institution")
    assert (await client.post("/api/v1/demo/tamper-drill")).status_code == 403
