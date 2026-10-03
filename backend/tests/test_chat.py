import json

import pytest

from app.agent.guard import check_numbers
from app.agent.loop import run_chat
from app.agent.ollama_client import OllamaUnavailable
from app.models import ChatMessage, ChatRequest, Usage


@pytest.fixture(autouse=True)
def _no_api_key(monkeypatch):
    """These tests must never reach a real model, even if backend/.env holds a key."""
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)


def parse_sse(text):
    """Parse an SSE body into a list of (event, data_dict)."""
    events = []
    for block in text.replace("\r\n", "\n").split("\n\n"):
        block = block.strip()
        if not block:
            continue
        name, data = None, []
        for line in block.split("\n"):
            if line.startswith("event:"):
                name = line[len("event:"):].strip()
            elif line.startswith("data:"):
                data.append(line[len("data:"):].strip())
        events.append((name, json.loads("\n".join(data)) if data else None))
    return events


class FakeClient:
    """Scripted Ollama stand-in: `script` is a list of Ollama-style response dicts."""

    def __init__(self, script=None, available=True, raises=False):
        self.script = list(script or [])
        self.available = available
        self.raises = raises
        self.calls = 0

    def is_available(self):
        return self.available

    def chat(self, messages, tools=None):
        self.calls += 1
        if self.raises:
            raise OllamaUnavailable("boom")
        return self.script.pop(0)


def tool_call_response(name, args):
    return {"message": {"role": "assistant", "content": "",
                        "tool_calls": [{"function": {"name": name, "arguments": args}}]}}


def final_response(text):
    return {"message": {"role": "assistant", "content": text}}


def crown_request(usage=None):
    return ChatRequest(
        messages=[ChatMessage(role="user", content="What will a crown cost me?")],
        plan_id="preferred", usage=usage or Usage(max_used=1100))


def collect(req, client):
    return list(run_chat(req, client=client))


def names(events):
    return [e["event"] for e in events]


def text_of(events):
    return "".join(e["data"]["text"] for e in events if e["event"] == "token")


# ---------- guard ----------

def test_guard_accepts_numbers_from_tools():
    assert check_numbers("You pay $800.", [{"you_pay": 800}]) == []


def test_guard_tolerates_one_dollar_and_commas():
    assert check_numbers("About $1,500.50 total", [{"billed": 1500}]) == []
    assert check_numbers("Plan pays $400", [{"nested": {"plan_pays": 399.5}}]) == []


def test_guard_flags_invented_amount():
    bad = check_numbers("You pay $9,999.", [{"you_pay": 800}])
    assert bad
    assert any("9" in b for b in bad)


def test_guard_ignores_text_without_dollars():
    assert check_numbers("You have 2 cleanings left.", [{"x": 1}]) == []


def test_guard_numbers_in_lists():
    assert check_numbers("$120 and $80", [{"items": [{"a": 120}, {"b": 80}]}]) == []
    assert check_numbers("$120 and $81.50", [{"items": [{"a": 120}, {"b": 80}]}]) != []


# ---------- ollama path ----------

def test_ollama_path_tool_then_answer():
    fake = FakeClient([
        tool_call_response("estimate_cost", {"code": "D2740"}),
        final_response("A crown would cost you $800 with your plan. This is an estimate, not a guarantee."),
    ])
    events = collect(crown_request(), fake)
    ns = names(events)
    assert ns[0] == "tool_start"
    assert "tool_end" in ns
    assert ns.index("tool_start") < ns.index("tool_end") < ns.index("token")
    assert ns[-1] == "done"
    assert events[-1]["data"]["mode"] == "ollama"
    assert "error" not in ns
    start = next(e for e in events if e["event"] == "tool_start")
    assert start["data"]["name"] == "estimate_cost"
    end = next(e for e in events if e["event"] == "tool_end")
    assert end["data"]["name"] == "estimate_cost"
    assert end["data"]["result"]
    assert "$800" in text_of(events)


def test_made_up_amount_is_refused_then_answered_from_tool_results():
    fake = FakeClient([
        tool_call_response("estimate_cost", {"code": "D2740"}),
        final_response("A crown will cost you $4,321. This is an estimate, not a guarantee."),
        final_response("A crown will cost you $9,999. This is an estimate, not a guarantee."),
    ])
    events = collect(crown_request(), fake)
    assert events[-1]["event"] == "done"
    assert events[-1]["data"]["mode"] == "template"
    text = text_of(events)
    assert "4,321" not in text and "9,999" not in text
    assert "$800" in text  # the plain template uses only the tool's numbers


# ---------- no model available (decision D3: no keyword fallback) ----------

def test_unavailable_client_says_so_plainly():
    events = collect(crown_request(), FakeClient(available=False))
    ns = names(events)
    assert ns[-1] == "done"
    assert events[-1]["data"]["mode"] == "unavailable"
    assert "tool_start" not in ns
    text = text_of(events)
    assert "not available" in text
    assert "$" not in text
    assert "error" not in ns


def test_client_that_raises_is_unavailable():
    events = collect(crown_request(), FakeClient(raises=True))
    assert events[-1]["data"]["mode"] == "unavailable"
    assert "$" not in text_of(events)


def test_default_client_without_ollama(monkeypatch):
    monkeypatch.setenv("OLLAMA_URL", "http://127.0.0.1:9")
    events = list(run_chat(crown_request()))
    assert events[-1]["data"]["mode"] == "unavailable"


def test_unknown_plan_reports_error():
    req = ChatRequest(messages=[ChatMessage(role="user", content="hi")], plan_id="nope")
    events = collect(req, FakeClient(available=False))
    assert names(events) == ["error", "done"]


def test_tool_functions_still_work_for_the_ai_agent():
    from app.agent.tools import ToolContext, run_tool

    ctx = ToolContext.from_request(crown_request())
    res = run_tool("estimate_cost", {"code": "D2740"}, ctx)
    assert res["in_network"]["you_pay"] == 800
    left = run_tool("get_benefits_status", {}, ctx)
    assert left["max_remaining"] == 400


# ---------- over HTTP ----------

def test_sse_over_http_event_order(monkeypatch):
    monkeypatch.setenv("ASSISTANT_ALLOW_ANONYMOUS", "1")
    from fastapi.testclient import TestClient

    from app.main import app

    r = TestClient(app).post("/chat", json=crown_request().model_dump())
    assert r.headers["content-type"].startswith("text/event-stream")
    events = parse_sse(r.text)
    ns = [n for n, _ in events]
    assert ns[-1] == "done"
    assert "token" in ns
    assert events[-1][1]["mode"] in ("ollama", "unavailable")
    assert set(ns) <= {"tool_start", "tool_end", "token", "done", "error"}
