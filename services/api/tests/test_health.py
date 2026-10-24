from httpx import ASGITransport, AsyncClient

from app.main import create_app


async def test_healthz_reports_ok_and_echoes_request_id() -> None:
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/healthz", headers={"x-request-id": "abc123"})
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.headers["x-request-id"] == "abc123"


async def test_unknown_route_uses_error_envelope() -> None:
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/does-not-exist")
    assert response.status_code == 404
    body = response.json()
    assert body["error"]["code"] == "not_found"
    assert body["error"]["request_id"]


def test_database_url_is_normalised_to_asyncpg() -> None:
    from app.config import Settings

    for url in ("postgresql://u:p@h/db", "postgresql+psycopg://u:p@h/db", "postgres://u:p@h/db"):
        assert Settings(database_url=url).database_url == "postgresql+asyncpg://u:p@h/db"
