from httpx import AsyncClient

from tests.conftest import sign_in


async def test_sample_register_reconciles(client: AsyncClient) -> None:
    await sign_in(client, "bureau")
    sample = await client.get("/api/v1/legacy/sample")
    assert sample.status_code == 200
    r = await client.post(
        "/api/v1/legacy/reconcile",
        files={"file": ("register.xlsx", sample.content, "application/octet-stream")},
    )
    assert r.status_code == 200, r.text
    report = r.json()
    c = report["counts"]
    assert report["rows_read"] == sum(c.values())
    assert c["match"] > c["differs"] > 0 and c["new"] >= 28 and c["duplicate"] > 0
    assert report["data_source"] == "synthetic"


async def test_legacy_import_is_for_bureau_roles(client: AsyncClient) -> None:
    await sign_in(client, "institution")
    assert (await client.get("/api/v1/legacy/sample")).status_code == 403
