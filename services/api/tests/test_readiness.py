from httpx import AsyncClient


async def test_readyz_reports_each_dependency(client: AsyncClient) -> None:
    res = await client.get("/api/v1/readyz")
    assert res.status_code == 200
    body = res.json()
    assert set(body["checks"]) >= {"database", "queue", "storage", "models"}
    assert body["checks"]["database"] == "ok"
    assert body["checks"]["models"] == "ok"
