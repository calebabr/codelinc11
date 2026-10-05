"""Per-person assistant: providers, tool loop with a scripted fake model, number check, member
isolation, visibility, suggestions, attachments. No network, no real model, no API key."""
import base64
import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.agent import providers
from app.agent.context import build_member_context
from app.agent.guard import check_numbers
from app.agent.loop import NO_DOCUMENTS, UNAVAILABLE, run_chat, template_answer
from app.agent.providers import (
    AnthropicProvider,
    OllamaProvider,
    ProviderError,
    Reply,
    ToolCall,
    select_provider,
)
from app.agent.suggestions import suggest_questions
from app.db import Store
from app.db.core import reset
from app.models import ChatMessage, ChatRequest
from app.routers import chat as chat_router
from app.routers.session import get_store, make_token

JORDAN, ALEX, MAYA, NOAH = "m-jordan", "m-alex", "m-maya", "m-noah"
PDF = b"%PDF-1.4\n% sample document\n%%EOF"


@pytest.fixture(autouse=True)
def _no_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setenv("ASSISTANT_PROVIDER", "none")


class FakeProvider:
    """Scripted model. `script` items are Reply objects (or an exception to raise)."""

    name = "anthropic"

    def __init__(self, script, documents=True, available=True):
        self.script = list(script)
        self.supports_documents = documents
        self.available = available
        self.calls: list[dict] = []

    def is_available(self):
        return self.available

    def complete(self, system, turns, tools):
        self.calls.append({"system": system, "turns": json.loads(json.dumps(turns)), "tools": tools})
        item = self.script.pop(0)
        if isinstance(item, Exception):
            raise item
        return item


def call(name, **args):
    return Reply(tool_calls=[ToolCall(f"id_{name}", name, args)])


def say(text):
    return Reply(text=text)


@pytest.fixture()
def store(tmp_path):
    path = tmp_path / "t.db"
    reset(path)
    return Store(path)


@pytest.fixture()
def client_for(store):
    """Returns a function: provider -> TestClient wired to the chat router and the temp database."""
    def make(provider):
        app = FastAPI()
        app.include_router(chat_router.router)
        app.dependency_overrides[get_store] = lambda: store
        app.dependency_overrides[chat_router.get_provider] = lambda: provider
        return TestClient(app)
    return make


def auth(member_id):
    return {"Authorization": f"Bearer {make_token(member_id)}"}


def parse_sse(text):
    events = []
    for block in text.replace("\r\n", "\n").split("\n\n"):
        if not block.strip():
            continue
        name, data = None, []
        for line in block.split("\n"):
            if line.startswith("event:"):
                name = line[6:].strip()
            elif line.startswith("data:"):
                data.append(line[5:].strip())
        events.append((name, json.loads("\n".join(data))))
    return events


def answer_text(events):
    return "".join(d["text"] for n, d in events if n == "token")


def ask(client, member, text, viewer=None, **extra):
    body = {"messages": [{"role": "user", "content": text}], "member_id": member, **extra}
    r = client.post("/chat", json=body, headers=auth(viewer or member))
    return r


# ---------------------------------------------------------------- providers

def test_select_provider_by_key_and_setting():
    assert isinstance(select_provider({"ANTHROPIC_API_KEY": "k"}), AnthropicProvider)
    assert select_provider({"ASSISTANT_PROVIDER": "none", "ANTHROPIC_API_KEY": "k"}) is None
    assert select_provider({"ASSISTANT_PROVIDER": "anthropic"}) is None  # no key: not available


def test_select_provider_falls_back_to_ollama_only_when_reachable(monkeypatch):
    monkeypatch.setattr(providers.OllamaClient, "is_available", lambda self: True)
    assert isinstance(select_provider({}), OllamaProvider)
    monkeypatch.setattr(providers.OllamaClient, "is_available", lambda self: False)
    assert select_provider({}) is None


def test_anthropic_request_shape_and_reply(monkeypatch):
    seen = {}

    class Resp:
        def raise_for_status(self):
            pass

        def json(self):
            return {"content": [{"type": "text", "text": "Hi"},
                                {"type": "tool_use", "id": "tu1", "name": "estimate_cost",
                                 "input": {"code": "D2740"}}]}

    def fake_post(url, json=None, headers=None, timeout=None):
        seen.update(url=url, payload=json, headers=headers)
        return Resp()

    monkeypatch.setattr(providers.httpx, "post", fake_post)
    p = AnthropicProvider(api_key="test-key", model="m")
    from app.agent.tools import TOOL_SCHEMAS
    turns = [{"role": "user", "content": "hello", "documents": [{"media_type": "application/pdf", "data": "QQ=="}]},
             {"role": "assistant", "content": "", "tool_calls": [{"id": "a", "name": "x", "args": {}}]},
             {"role": "tool", "results": [{"id": "a", "name": "x", "content": "{}"}]}]
    reply = p.complete("sys", turns, TOOL_SCHEMAS)
    assert reply.text == "Hi" and reply.tool_calls[0].args == {"code": "D2740"}
    assert seen["headers"]["x-api-key"] == "test-key"
    msgs = seen["payload"]["messages"]
    assert [m["role"] for m in msgs] == ["user", "assistant", "user"]
    assert msgs[0]["content"][0]["type"] == "document"
    assert msgs[2]["content"][0]["type"] == "tool_result"
    assert {t["name"] for t in seen["payload"]["tools"]} >= {"estimate_cost", "plan_year_schedule"}


def test_anthropic_failure_never_leaks_the_key(monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("secret-key-value in message")

    monkeypatch.setattr(providers.httpx, "post", boom)
    with pytest.raises(ProviderError) as exc:
        AnthropicProvider(api_key="secret-key-value").complete("s", [{"role": "user", "content": "x"}], [])
    assert "secret-key-value" not in str(exc.value)


# ---------------------------------------------------------------- loop with member context

def test_crown_for_alex_in_november_is_800(client_for):
    fake = FakeProvider([call("estimate_cost", code="D2740"),
                         say("A crown would cost you $800 in network. This is an estimate, not a guarantee.")])
    r = ask(client_for(fake), ALEX, "What will a crown cost me?")
    ev = parse_sse(r.text)
    names = [n for n, _ in ev]
    assert names[0] == "tool_start" and names[-1] == "done"
    assert ev[-1][1]["mode"] == "anthropic"
    assert "$800" in answer_text(ev)
    end = next(d for n, d in ev if n == "tool_end")
    assert end["result"]["in_network"]["you_pay"] == 800  # engine number, from Mary's own usage


def test_wait_until_january_returns_625_versus_800(client_for):
    fake = FakeProvider([call("plan_year_schedule", items=[{"code": "D2740", "urgency": "flexible"}]),
                         say("Waiting until January: you would pay $625 instead of $800. "
                             "This is an estimate, not a guarantee.")])
    ev = parse_sse(ask(client_for(fake), ALEX, "What if I wait until January?").text)
    assert "$625" in answer_text(ev) and "$800" in answer_text(ev)
    assert ev[-1][1]["mode"] == "anthropic"


def test_invented_amount_is_regenerated_once(client_for):
    fake = FakeProvider([call("estimate_cost", code="D2740"),
                         say("It will cost $4,321."),
                         say("A crown would cost you $800. This is an estimate, not a guarantee.")])
    ev = parse_sse(ask(client_for(fake), ALEX, "crown?").text)
    assert "4,321" not in answer_text(ev)
    assert "$800" in answer_text(ev)
    assert ev[-1][1]["mode"] == "anthropic"
    retry_turn = fake.calls[2]["turns"][-1]
    assert retry_turn["role"] == "user" and "$4,321" in retry_turn["content"]


def test_two_bad_answers_fall_back_to_a_template_from_tool_results(client_for):
    fake = FakeProvider([call("estimate_cost", code="D2740"), say("About $4,321."), say("Maybe $9,999.")])
    ev = parse_sse(ask(client_for(fake), ALEX, "crown?").text)
    text = answer_text(ev)
    assert "4,321" not in text and "9,999" not in text
    assert "$800" in text and "This is an estimate" in text
    assert ev[-1][1]["mode"] == "template"


def test_bad_answer_with_no_tool_results_says_it_will_not_guess(client_for):
    fake = FakeProvider([say("It is $123."), say("It is $456.")])
    ev = parse_sse(ask(client_for(fake), ALEX, "hi").text)
    assert "$" not in answer_text(ev)
    assert "not going to guess" in answer_text(ev)
    assert ev[-1][1]["mode"] == "unavailable"


def test_number_check_accepts_rounding_and_stored_facts():
    assert check_numbers("You pay $800.00 and $1,500.50", [{"a": 800, "b": 1500}]) == []
    assert check_numbers("You pay $799", [{"a": 800}]) == []   # within a dollar
    assert check_numbers("You pay $790", [{"a": 800}]) != []


def test_template_answer_covers_each_result_shape():
    sched = {"total_you_pay": 625.0, "baseline_you_pay": 800.0, "savings": 175.0}
    text = template_answer([sched, {"max_remaining": 400.0, "months_left": 2}])
    assert "$625" in text and "$800" in text and "$175" in text and "$400" in text
    assert template_answer([{"error": "x"}]) is None


def test_no_provider_says_unavailable_with_no_scripted_answer(client_for):
    ev = parse_sse(ask(client_for(None), ALEX, "What will a crown cost me?").text)
    assert ev[-1][1]["mode"] == "unavailable"
    assert answer_text(ev).startswith(UNAVAILABLE[:30])
    assert "$" not in answer_text(ev)
    assert "tool_start" not in [n for n, _ in ev]


def test_provider_that_fails_is_unavailable(client_for):
    ev = parse_sse(ask(client_for(FakeProvider([ProviderError("down")])), ALEX, "hi").text)
    assert ev[-1][1]["mode"] == "unavailable"


def test_stateless_chat_uses_the_request_plan_and_saves_nothing(client_for, store, monkeypatch):
    monkeypatch.setenv("ASSISTANT_ALLOW_ANONYMOUS", "1")
    fake = FakeProvider([call("estimate_cost", code="D2740"), say("You pay $800. This is an estimate, not a guarantee.")])
    r = client_for(fake).post("/chat", json={"messages": [{"role": "user", "content": "crown?"}],
                                             "plan_id": "preferred", "usage": {"max_used": 1100}})
    assert "$800" in answer_text(parse_sse(r.text))
    assert store.get_member_context(ALEX, ALEX)["chat_memory"] == []


# ---------------------------------------------------------------- per-person context and memory

def test_prompt_has_only_the_active_members_context(client_for):
    fake = FakeProvider([say("Hello, Mary. This is an estimate, not a guarantee.")])
    ask(client_for(fake), ALEX, "hi")
    system = fake.calls[0]["system"]
    assert "Mary" in system and "stay with the current dentist" in system
    assert "Likes morning appointments" not in system       # Abraham's preference
    assert "Tad" not in system and "Nervous at the dentist" not in system
    assert "Abraham" not in system


def test_memory_is_saved_per_person_and_never_crosses(client_for, store):
    c = client_for(FakeProvider([say("Sure, Mary. This is an estimate, not a guarantee.")]))
    ask(c, ALEX, "I always forget my cleaning")
    mem = store.get_member_context(ALEX, ALEX)["chat_memory"]
    assert [m["role"] for m in mem] == ["user", "assistant"]
    assert store.get_member_context(JORDAN, JORDAN)["chat_memory"] == []
    fake = FakeProvider([say("Hi Abraham. This is an estimate, not a guarantee.")])
    ask(client_for(fake), JORDAN, "hello")
    assert "forget my cleaning" not in fake.calls[0]["system"]
    # Mary's own next chat does see her memory
    fake2 = FakeProvider([say("Welcome back. This is an estimate, not a guarantee.")])
    ask(client_for(fake2), ALEX, "hello again")
    assert "forget my cleaning" in fake2.calls[0]["system"]


def test_clear_chat_deletes_only_that_persons_memory(client_for, store):
    c = client_for(FakeProvider([say("Hi Mary. This is an estimate, not a guarantee."),
                                 say("Hi Abraham. This is an estimate, not a guarantee.")]))
    ask(c, ALEX, "hello")
    ask(c, JORDAN, "hello")
    r = c.delete(f"/members/{ALEX}/chat", headers=auth(ALEX))
    assert r.status_code == 200 and r.json() == {"ok": True, "removed": 2}
    assert store.get_member_context(ALEX, ALEX)["chat_memory"] == []
    assert len(store.get_member_context(JORDAN, JORDAN)["chat_memory"]) == 2


def test_clear_chat_follows_access_rules(client_for):
    c = client_for(None)
    assert c.delete(f"/members/{JORDAN}/chat", headers=auth(ALEX)).status_code == 403
    assert c.delete(f"/members/{ALEX}/chat").status_code == 401
    assert c.delete(f"/members/{MAYA}/chat", headers=auth(JORDAN)).status_code == 200


def test_failed_answers_are_not_saved(client_for, store):
    ask(client_for(None), ALEX, "hello")
    assert store.get_member_context(ALEX, ALEX)["chat_memory"] == []


def test_context_loads_that_persons_plan_usage_and_history(store):
    ctx = build_member_context(store, ALEX, ALEX)
    assert ctx.plan_id == "preferred"
    assert ctx.usage.max_used == 1100 and ctx.usage.deductible_met == 50
    assert "D1110" in ctx.usage.history
    assert [p["name"] for p in ctx.household] == ["Mary"]   # an adult sees only themself
    assert len(build_member_context(store, JORDAN, MAYA).household) == 4  # the primary sees all


# ---------------------------------------------------------------- visibility

def test_primary_may_chat_about_a_child_but_an_adult_may_not_about_others(client_for):
    ok = ask(client_for(FakeProvider([say("Tad's plan covers checkups. This is an estimate, not a guarantee.")])),
             MAYA, "What is covered?", viewer=JORDAN)
    assert ok.status_code == 200
    assert ask(client_for(FakeProvider([])), JORDAN, "x", viewer=ALEX).status_code == 403
    assert ask(client_for(FakeProvider([])), MAYA, "x", viewer=NOAH).status_code == 403


def test_member_chat_needs_a_session(client_for):
    r = client_for(FakeProvider([])).post(
        "/chat", json={"messages": [{"role": "user", "content": "hi"}], "member_id": ALEX})
    assert r.status_code == 401


def test_managed_member_has_no_login(client_for):
    assert ask(client_for(FakeProvider([])), MAYA, "hi", viewer=MAYA).status_code == 403


def test_unknown_member_is_404(client_for):
    assert ask(client_for(FakeProvider([])), "m-nobody", "hi", viewer=JORDAN).status_code == 404


# ---------------------------------------------------------------- suggestions and context panel

def test_suggestions_differ_by_member(client_for, store):
    c = client_for(FakeProvider([]))
    got = {m: c.get("/chat/suggestions", params={"member_id": m}, headers=auth(JORDAN)).json()["suggestions"]
           for m in (JORDAN, ALEX, MAYA, NOAH)}
    assert "Who's covered on my plan?" in got[JORDAN]
    assert "Who's covered on my plan?" not in got[ALEX]
    assert "What if I wait until January?" in got[ALEX]
    assert got[MAYA] != got[JORDAN] and any("braces" in q for q in got[MAYA])
    assert any("stay covered" in q for q in got[NOAH])
    assert all(1 <= len(v) <= 7 for v in got.values())


def test_suggestions_default_to_the_viewer_and_respect_visibility(client_for):
    c = client_for(FakeProvider([]))
    me = c.get("/chat/suggestions", headers=auth(ALEX)).json()
    assert me["member_id"] == ALEX
    assert c.get("/chat/suggestions", params={"member_id": MAYA}, headers=auth(ALEX)).status_code == 403
    assert c.get("/chat/suggestions", params={"member_id": ALEX}).status_code == 401


def test_assistant_context_panel(client_for):
    c = client_for(FakeProvider([]))
    ok = c.get(f"/members/{ALEX}/assistant-context", headers=auth(ALEX)).json()
    assert ok["name"] == "Mary" and ok["usage"]["max_used"] == 1100
    assert ok["must_haves"] and "Abraham" not in json.dumps(ok)
    assert c.get(f"/members/{JORDAN}/assistant-context", headers=auth(ALEX)).status_code == 403
    assert c.get(f"/members/{ALEX}/assistant-context", headers=auth(JORDAN)).status_code == 200


def test_suggestion_rules_without_http(store):
    assert suggest_questions(build_member_context(store, JORDAN, MAYA)) != \
        suggest_questions(build_member_context(store, JORDAN, JORDAN))


# ---------------------------------------------------------------- tools tied to the member

def test_eligibility_and_household_tools(client_for):
    fake = FakeProvider([call("get_member_eligibility"), call("get_household_coverage"),
                         say("Robert's coverage is pending. This is an estimate, not a guarantee.")])
    ev = parse_sse(ask(client_for(fake), NOAH, "Am I covered?").text)
    results = [d["result"] for n, d in ev if n == "tool_end"]
    assert results[0]["status"] == "pending" and results[0]["covered_now"] is False
    assert [m["name"] for m in results[1]["members"]] == ["Robert"]


# ---------------------------------------------------------------- attachments (sample PDFs)

def upload(c, member, viewer, body=PDF, ctype="application/pdf"):
    return c.post("/chat/attachments", params={"member_id": member, "filename": "sample quote.pdf"},
                  content=body, headers={**auth(viewer), "Content-Type": ctype})


def test_pdf_upload_limits_and_type(client_for):
    c = client_for(FakeProvider([]))
    ok = upload(c, ALEX, ALEX)
    assert ok.status_code == 200 and ok.json()["attachment_id"].startswith("att-")
    assert "sample" in ok.json()["notice"].lower()
    assert upload(c, ALEX, ALEX, ctype="text/plain").status_code == 415
    assert upload(c, ALEX, ALEX, body=b"not a pdf at all").status_code == 415
    assert upload(c, ALEX, ALEX, body=PDF + b"0" * (chat_router.MAX_PDF_BYTES + 1)).status_code == 413
    assert upload(c, JORDAN, ALEX).status_code == 403


def test_attachment_reaches_a_document_capable_provider(client_for):
    fake = FakeProvider([say("It looks like a dental quote with a crown. This is an estimate, not a guarantee.")])
    c = client_for(fake)
    aid = upload(c, ALEX, ALEX).json()["attachment_id"]
    ev = parse_sse(ask(c, ALEX, "What is in this?", attachment_ids=[aid]).text)
    assert ev[-1][1]["mode"] == "anthropic"
    docs = fake.calls[0]["turns"][-1]["documents"]
    assert base64.b64decode(docs[0]["data"]) == PDF


def test_attachment_of_another_person_is_not_found(client_for):
    c = client_for(FakeProvider([]))
    aid = upload(c, ALEX, ALEX).json()["attachment_id"]
    r = ask(c, JORDAN, "x", attachment_ids=[aid])
    assert r.status_code == 404


def test_provider_without_document_support_says_so(client_for):
    fake = FakeProvider([], documents=False)
    c = client_for(fake)
    aid = upload(c, ALEX, ALEX).json()["attachment_id"]
    ev = parse_sse(ask(c, ALEX, "read this", attachment_ids=[aid]).text)
    assert answer_text(ev).startswith(NO_DOCUMENTS[:30])
    assert fake.calls == []


# ---------------------------------------------------------------- Ollama adapter

def test_ollama_provider_wraps_an_ollama_style_client():
    class OllamaLike:
        def is_available(self):
            return True

        def chat(self, messages, tools=None):
            assert messages[0]["role"] == "system"
            return {"message": {"content": "", "tool_calls": [
                {"function": {"name": "get_benefits_status", "arguments": "{}"}}]}}

    reply = OllamaProvider(OllamaLike()).complete("sys", [{"role": "user", "content": "hi"}], [])
    assert reply.tool_calls[0].name == "get_benefits_status"


def test_run_chat_accepts_a_plain_request_and_fake(store):
    req = ChatRequest(messages=[ChatMessage(role="user", content="left?")], plan_id="preferred")
    fake = FakeProvider([call("get_benefits_status"), say("You have $1,500 left. This is an estimate, not a guarantee.")])
    ev = list(run_chat(req, client=fake))
    assert ev[-1]["data"]["mode"] == "anthropic"
