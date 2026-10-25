"""Scores the plain-language interpreter on the 60-query set (tests/fixtures/search_queries.json).

    uv run python -m scripts.search_eval            # rule parser
    uv run python -m scripts.search_eval --model    # Bedrock (needs BEDROCK_ENABLED and access)

A query counts as correct only when every filter matches exactly. Results go to
../../docs/search-eval.json. The set was written by the team, so it measures coverage of the
phrasings we anticipated, not how officers actually phrase requests (EVALUATION.md).
"""

import argparse
import json
from datetime import date
from pathlib import Path
from typing import Any

from app.services.search import Filters, interpret, parse

TODAY = date(2026, 10, 25)
ROOT = Path(__file__).resolve().parents[1]
SET = ROOT / "tests" / "fixtures" / "search_queries.json"
# Written after the parser was tuned on SET and scored once, untuned, as a generalisation check.
HELDOUT = ROOT / "tests" / "fixtures" / "search_queries_heldout.json"
OUT = ROOT.parents[1] / "docs" / "search-eval.json"
FIELDS = list(Filters.model_fields)


def normalise(f: Filters) -> dict[str, Any]:
    d = f.model_dump(mode="json")
    return {k: sorted(v) if isinstance(v, list) else v for k, v in d.items()}


def score(use_model: bool, path: Path = SET) -> dict[str, Any]:
    cases = json.loads(path.read_text(encoding="utf-8"))
    misses, field_hits = [], dict.fromkeys(FIELDS, 0)
    for c in cases:
        got = interpret(c["query"], TODAY) if use_model else parse(c["query"], TODAY)
        g, e = normalise(got.filters), normalise(Filters.model_validate(c["expected"]))
        for k in FIELDS:
            field_hits[k] += g[k] == e[k]
        if g != e:
            misses.append(
                {
                    "query": c["query"],
                    "expected": {k: v for k, v in e.items() if v not in (None, [])},
                    "got": {k: v for k, v in g.items() if v not in (None, [])},
                }
            )
    n = len(cases)
    return {
        "interpreter": "model" if use_model else "rules",
        "today": TODAY.isoformat(),
        "queries": n,
        "exact_match": round((n - len(misses)) / n, 3),
        "field_accuracy": {k: round(v / n, 3) for k, v in field_hits.items()},
        "misses": misses,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", action="store_true")
    use_model = parser.parse_args().model
    result = score(use_model)
    held = score(use_model, HELDOUT)
    result["heldout"] = {k: held[k] for k in ("queries", "exact_match", "misses")}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"exact match {result['exact_match']:.1%} on {result['queries']} queries")
    print(f"held-out exact match {held['exact_match']:.1%} on {held['queries']} queries")
    for m in result["misses"]:
        print("-", m["query"], "\n    expected", m["expected"], "\n    got     ", m["got"])
