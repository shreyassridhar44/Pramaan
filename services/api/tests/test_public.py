from httpx import AsyncClient


async def test_public_summary_is_aggregate_only(client: AsyncClient) -> None:
    r = await client.get("/api/v1/public/summary")
    assert r.status_code == 200
    body = r.json()
    assert body["data_source"] == "synthetic"
    assert body["held_count"] > 0 and body["institutions"] > 0 and body["banks"] > 0
    assert 0 <= body["bank_confirmed_share"] <= 1
    regions = body["regions"]
    assert regions and sum(r["held_count"] for r in regions) == body["held_count"]
    assert sum(int(r["held_paise"]) for r in regions) == int(body["held_paise"])
    # Nothing that names an institution or an instrument.
    text = r.text.lower()
    assert "aicte_id" not in text and "institution_id" not in text and "number" not in text
