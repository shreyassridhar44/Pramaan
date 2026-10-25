"""Plain-language search: rule parser accuracy, model output validation and fallback, endpoint."""

from datetime import date
from typing import Any

import pytest
from httpx import AsyncClient

from app.services import search
from scripts.search_eval import HELDOUT, SET, score
from tests.conftest import sign_in

TODAY = date(2026, 10, 25)


@pytest.mark.parametrize("path", [SET, HELDOUT], ids=["set", "heldout"])
def test_rule_parser_on_the_evaluation_sets(path: Any) -> None:
    result = score(use_model=False, path=path)
    assert result["exact_match"] >= 0.95, result["misses"]


def test_outside_banks_are_reported_not_guessed() -> None:
    r = search.parse("SBI deposits in Kerala", TODAY)
    assert r.filters.bank == []
    assert r.filters.region == ["kerala"]
    assert any("SBI" in u for u in r.unrecognised)


class _Stub:
    def __init__(self, reply: dict[str, Any] | Exception) -> None:
        self.reply = reply
        self.calls: list[dict[str, Any]] = []

    def converse(self, **kwargs: Any) -> dict[str, Any]:
        self.calls.append(kwargs)
        if isinstance(self.reply, Exception):
            raise self.reply
        return self.reply


def _tool_reply(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "stopReason": "tool_use",
        "output": {
            "message": {
                "content": [
                    {
                        "toolUse": {
                            "toolUseId": "t1",
                            "name": search.TOOL_NAME,
                            "input": payload,
                        }
                    }
                ]
            }
        },
    }


def test_model_output_is_validated_and_unknown_values_dropped() -> None:
    stub = _Stub(
        _tool_reply(
            {
                "region": ["western", "atlantis"],
                "bank": ["SBIX", "KTBX"],
                "maturity_to": "2027-02-28",
                "assurance": [0, 1, 9],
                "unrecognised": ["SBI"],
            }
        )
    )
    r = search.interpret("Western deposits at SBI and Kaveri Trust", TODAY, client=stub)
    assert r.source == "model"
    assert r.filters.region == ["western"]
    assert r.filters.bank == ["KTBX"]
    assert r.filters.assurance == [0, 1]
    assert r.filters.maturity_to == date(2027, 2, 28)
    assert r.unrecognised == ["SBI"]
    call = stub.calls[0]
    assert call["inferenceConfig"]["maxTokens"] == 400
    assert call["toolConfig"]["toolChoice"] == {"tool": {"name": search.TOOL_NAME}}
    # Only the officer's sentence is sent: no records, no personal data.
    assert call["messages"] == [
        {"role": "user", "content": [{"text": "Western deposits at SBI and Kaveri Trust"}]}
    ]


@pytest.mark.parametrize(
    "reply",
    [
        RuntimeError("Operation not allowed"),
        _tool_reply({"maturity_to": "not a date"}),
        {"stopReason": "end_turn", "output": {"message": {"content": [{"text": "hello"}]}}},
    ],
    ids=["service error", "invalid value", "no tool call"],
)
def test_model_failures_fall_back_to_rules(reply: Any) -> None:
    r = search.interpret("matured deposits in Kerala", TODAY, client=_Stub(reply))
    assert r.source == "rules"
    assert r.note
    assert r.filters.region == ["kerala"]
    assert r.filters.status == ["matured"]


async def test_interpret_endpoint(client: AsyncClient) -> None:
    await sign_in(client, "bureau")
    r = await client.post(
        "/api/v1/search/interpret",
        json={"text": "unconfirmed deposits at Narmada Bank maturing next year"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["source"] == "rules"
    assert body["filters"]["bank"] == ["NARX"]
    assert {c["key"] for c in body["chips"]} >= {"bank", "assurance", "maturity_from"}

    client.cookies.clear()
    client.headers.pop("x-csrf-token", None)
    await sign_in(client, "institution")
    denied = await client.post("/api/v1/search/interpret", json={"text": "anything"})
    assert denied.status_code == 403
