"""Measures the performance targets in STEPS.md and TEST_PLAN.md against a running local stack.

Run with the API on :8000 and a seeded database:
    uv run python -m scripts.perf_check            # latency, load and document analysis
    uv run python -m scripts.perf_check --seed     # also times a full reseed (resets demo data)
Results are printed and written to ../../docs/perf-results.json.
"""

import argparse
import asyncio
import json
import random
import time
from datetime import date
from pathlib import Path

import httpx

BASE = "http://127.0.0.1:8000"
ASSETS = Path(__file__).resolve().parents[1] / "app" / "demo_assets"
OUT = Path(__file__).resolve().parents[3] / "docs" / "perf-results.json"


def pct(values: list[float], p: float) -> float:
    ordered = sorted(values)
    k = max(0, min(len(ordered) - 1, round(p / 100 * (len(ordered) - 1))))
    return round(ordered[k], 1)


async def signed_in(persona: str) -> httpx.AsyncClient:
    c = httpx.AsyncClient(base_url=BASE, timeout=120)
    r = await c.post(f"/api/v1/auth/persona/{persona}")
    r.raise_for_status()
    c.headers["x-csrf-token"] = c.cookies["pramaan_csrf"]
    return c


async def timed(c: httpx.AsyncClient, method: str, url: str, **kw: object) -> float:
    t = time.perf_counter()
    r = await c.request(method, url, **kw)  # type: ignore[arg-type]
    r.raise_for_status()
    return (time.perf_counter() - t) * 1000


async def latency(c: httpx.AsyncClient, url: str, n: int = 40) -> dict[str, float]:
    await timed(c, "GET", url)  # warm the cache once
    samples = [await timed(c, "GET", url) for _ in range(n)]
    return {"p50_ms": pct(samples, 50), "p95_ms": pct(samples, 95), "n": n}


async def load(users: int, seconds: int, think: tuple[float, float]) -> dict[str, float]:
    """Concurrent officers browsing the registry and opening records. `think` is the pause
    between clicks in seconds; (0, 0) measures saturation rather than browsing."""
    clients = [await signed_in("bureau") for _ in range(users)]
    first = (await clients[0].get("/api/v1/instruments", params={"limit": 50})).json()
    ids = [i["id"] for i in first["items"]]
    samples: list[float] = []
    stop = time.perf_counter() + seconds

    async def user(c: httpx.AsyncClient, k: int) -> None:
        i = k
        rng = random.Random(k)  # noqa: S311 (think times for a load test, not security)
        while time.perf_counter() < stop:
            samples.append(await timed(c, "GET", "/api/v1/instruments", params={"limit": 100}))
            await asyncio.sleep(rng.uniform(*think))
            samples.append(await timed(c, "GET", f"/api/v1/instruments/{ids[i % len(ids)]}"))
            await asyncio.sleep(rng.uniform(*think))
            i += 1

    await asyncio.gather(*(user(c, k) for k, c in enumerate(clients)))
    for c in clients:
        await c.aclose()
    return {
        "users": users,
        "seconds": seconds,
        "think_seconds": list(think),
        "requests": len(samples),
        "p50_ms": pct(samples, 50),
        "p95_ms": pct(samples, 95),
    }


def two_page_pdf() -> bytes:
    """The genuine specimen scanned as a two-page PDF (receipt and its reverse)."""
    from io import BytesIO

    from PIL import Image

    page = Image.open(ASSETS / "specimen_fdr_genuine.jpg").convert("RGB")
    buf = BytesIO()
    page.save(buf, "PDF", save_all=True, append_images=[page.copy()], resolution=200)
    return buf.getvalue()


async def analysis(c: httpx.AsyncClient) -> dict[str, float]:
    out = {}
    samples = {
        "specimen_fdr_genuine.jpg": (ASSETS / "specimen_fdr_genuine.jpg").read_bytes(),
        "specimen_fdr_altered.jpg": (ASSETS / "specimen_fdr_altered.jpg").read_bytes(),
        "two_page_scan.pdf": two_page_pdf(),
    }
    for name, data in samples.items():
        out[name] = round(
            await timed(
                c,
                "POST",
                "/api/v1/documents",
                files={"file": (name, data, "application/octet-stream")},
                data={"kind": "fdr_scan"},
            )
            / 1000,
            2,
        )
    return out


async def main(seed: bool) -> None:
    results: dict[str, object] = {"measured_on": date.today().isoformat(), "machine": "local dev"}
    if seed:
        admin = await signed_in("admin")
        t = time.perf_counter()
        r = await admin.post("/api/v1/demo/reset", timeout=600)
        r.raise_for_status()
        results["seed_seconds"] = round(time.perf_counter() - t, 1)
        results["seed_counts"] = {
            k: v for k, v in r.json()["counts"].items() if k in ("institutions", "instruments")
        }
        await admin.aclose()
    officer = await signed_in("bureau")
    total = (await officer.get("/api/v1/instruments", params={"limit": 1})).json()["total"]
    results["portfolio_summary"] = await latency(officer, "/api/v1/portfolio/summary")
    results["portfolio_summary_past_date"] = await latency(
        officer, "/api/v1/portfolio/summary?as_of=2025-04-01"
    )
    results["registry_first_page"] = {
        **await latency(officer, "/api/v1/instruments?limit=100"),
        "matching_instruments": total,
    }
    results["registry_page_500_rows"] = await latency(officer, "/api/v1/instruments?limit=500", n=20)
    await officer.aclose()
    institution = await signed_in("institution")
    results["document_analysis_seconds"] = await analysis(institution)
    await institution.aclose()
    results["load_20_users_browsing"] = await load(20, 60, (1.0, 3.0))
    results["load_20_users_saturation"] = await load(20, 30, (0.0, 0.0))
    print(json.dumps(results, indent=2))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(results, indent=2) + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", action="store_true", help="also time a full demo reset")
    asyncio.run(main(parser.parse_args().seed))
