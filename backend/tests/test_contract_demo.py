"""The demo moment end to end through the API (T13): sign in as Alex, see $400 left, run Plan My Year
for the S2 treatment list, then ask the assistant, with a scripted fake provider (no model, no network).
Every dollar figure the assistant says must come from a tool result."""
import json
import re

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.agent.providers import Reply, ToolCall
from app.db import Store
from app.db.core import reset
from app.main import app
from app.routers import chat as chat_router
from app.routers.session import get_store

ALEX = "m-alex"


class Script:
    name = "anthropic"
    supports_documents = False

    def __init__(self, items):
        self.items = list(items)

    def is_available(self):
        return True

    def complete(self, system, turns, tools):
        return self.items.pop(0)


def sse(text):
    out = []
    for block in text.replace("\r\n", "\n").split("\n\n"):
        if block.strip():
            lines = block.split("\n")
            name = next(ln[6:].strip() for ln in lines if ln.startswith("event:"))
            data = "".join(ln[5:].strip() for ln in lines if ln.startswith("data:"))
            out.append((name, json.loads(data)))
    return out


def dollars(text):
    return {int(m.replace(",", "")) for m in re.findall(r"\$([\d,]+)", text)}


def numbers_in(obj):
    found = set()
    if isinstance(obj, dict):
        for v in obj.values():
            found |= numbers_in(v)
    elif isinstance(obj, list):
        for v in obj:
            found |= numbers_in(v)
    elif isinstance(obj, (int, float)) and not isinstance(obj, bool):
        found.add(int(obj))
    return found


@pytest.fixture()
def store(tmp_path):
    path = tmp_path / "demo.db"
    reset(path)
    return Store(path)


def chat_client(store, provider):
    chat_app = FastAPI()
    chat_app.include_router(chat_router.router)
    chat_app.dependency_overrides[get_store] = lambda: store
    chat_app.dependency_overrides[chat_router.get_provider] = lambda: provider
    return TestClient(chat_app)


def test_alex_demo_flow(store):
    app.dependency_overrides[get_store] = lambda: store
    try:
        client = TestClient(app)

        # 1. Sign in as Alex: $400 left.
        login = client.post("/auth/demo-login", json={"member_id": ALEX}).json()
        headers = {"Authorization": f"Bearer {login['token']}"}
        overview = client.get(f"/members/{ALEX}/overview", headers=headers).json()
        assert overview["benefits"]["max_remaining"] == 400

        # 2. Plan My Year with Alex's own usage gives the golden numbers.
        usage = {"max_used": overview["usage"]["max_used"],
                 "deductible_met": overview["usage"]["deductible_met"], "history": []}
        sched = client.post("/schedule", json={
            "plan_id": overview["plan_tier"]["id"], "usage": usage, "current_month": 11, "items": [
                {"id": "rc", "code": "D3330", "urgency": "urgent"},
                {"id": "cr", "code": "D2740", "after": "rc"},
                {"id": "f1", "code": "D2392"}, {"id": "f2", "code": "D2392"}]}).json()
        assert (sched["baseline_you_pay"], sched["total_you_pay"], sched["savings"]) == (2300, 1405, 895)
    finally:
        app.dependency_overrides.clear()

    # 3. The assistant answers from tool results only.
    fake = Script([
        Reply(tool_calls=[ToolCall("a", "estimate_cost", {"code": "D2740"})]),
        Reply(text="A crown would cost you $800 now. This is an estimate, not a guarantee."),
    ])
    r = chat_client(store, fake).post("/chat", headers=headers, json={
        "member_id": ALEX, "messages": [{"role": "user", "content": "What will a crown cost me?"}]})
    events = sse(r.text)
    answer = "".join(d["text"] for n, d in events if n == "token")
    tool_numbers = set()
    for n, d in events:
        if n == "tool_end":
            tool_numbers |= numbers_in(d["result"])
    assert dollars(answer) == {800}
    assert dollars(answer) <= tool_numbers
    assert events[-1] == ("done", {"mode": "anthropic"})


def test_chat_with_no_model_says_so_and_invents_no_numbers(store):
    r = chat_client(store, None).post("/chat", json={"plan_id": "preferred", "messages": [
        {"role": "user", "content": "crown?"}]})
    events = sse(r.text)
    assert events[-1] == ("done", {"mode": "unavailable"})
    assert dollars("".join(d["text"] for n, d in events if n == "token")) == set()
