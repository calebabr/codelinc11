"""The compare_plans assistant tool: same numbers as simulate(), visibility, number guard."""
import pytest

from app.agent.context import build_member_context
from app.agent.guard import check_numbers
from app.agent.loop import run_chat, template_answer
from app.agent.providers import Reply, ToolCall
from app.agent.suggestions import suggest_questions
from app.agent.tools import TOOL_SCHEMAS, ToolContext, compare_plans, run_tool
from app.data import load_catalog, load_plans
from app.db import Store
from app.db.core import reset
from app.engine.simulate import simulate
from app.models import ChatMessage, ChatRequest, SimulateMember, SimulateRequest

JORDAN, ALEX = "m-jordan", "m-alex"


@pytest.fixture()
def store(tmp_path):
    path = tmp_path / "t.db"
    reset(path)
    return Store(path)


def ctx_for(store, viewer, member):
    return ToolContext.from_member(build_member_context(store, viewer, member))


def share(result, plan_id):
    return next(p["cheapest_share"] for p in result["plans"] if p["plan_id"] == plan_id)


def test_schema_is_registered():
    assert "compare_plans" in {t["function"]["name"] for t in TOOL_SCHEMAS}


def test_matches_simulate_for_the_rivera_household(store):
    out = run_tool("compare_plans", {}, ctx_for(store, JORDAN, JORDAN))
    household = build_member_context(store, JORDAN, JORDAN).household
    people = [SimulateMember(id=p["id"], name=p["name"], age=p["age"]) for p in household]
    want = simulate(SimulateRequest(members=people, n=5000, seed=42), load_plans(), load_catalog())
    assert len(people) == 4 and [m["name"] for m in out["members"]] == [p.name for p in people]
    assert out["plans"] == [p.model_dump() for p in want.plans]
    assert out["winner_plan_id"] == want.winner_plan_id and out["reasons"] == want.reasons
    assert "synthetic" in out["note"]


def test_adult_sees_only_themself(store):
    out = compare_plans(ctx=ctx_for(store, ALEX, ALEX))
    assert [m["name"] for m in out["members"]] == ["Mary"]


def test_overrides_and_known_codes_change_the_result(store):
    ctx = ctx_for(store, JORDAN, ALEX)
    base = compare_plans(ctx=ctx)
    with_crown = compare_plans(known_codes=["d2740"], ctx=ctx)
    assert share(with_crown, "premium") > share(base, "premium")
    alex = [m["known_care"] for m in with_crown["members"] if m["name"] == "Mary"]
    assert alex == [["D2740"]]
    high = compare_plans(care_levels={"Mary": "high", "m-maya": "low"}, ctx=ctx)
    levels = {m["name"]: m["care_level"] for m in high["members"]}
    assert levels["Mary"] == "high" and levels["Tad"] == "low"
    assert levels["Abraham Lincoln"] == "average"


def test_bad_input_returns_errors(store):
    ctx = ctx_for(store, JORDAN, JORDAN)
    assert "error" in compare_plans(care_levels={"Mary": "wild"}, ctx=ctx)
    assert "error" in compare_plans(known_codes=["D9999"], ctx=ctx)


def test_guard_accepts_tool_numbers_and_rejects_invented_ones(store):
    out = run_tool("compare_plans", {}, ctx_for(store, JORDAN, JORDAN))
    w = next(p for p in out["plans"] if p["plan_id"] == out["winner_plan_id"])
    good = f"A typical year costs ${w['median']:,.0f} and a bad year ${w['p90']:,.0f}."
    assert check_numbers(good, [out]) == []
    assert check_numbers("A typical year costs $1,234,567.", [out]) == ["$1,234,567"]


def test_template_answer_from_the_tool_result(store):
    out = run_tool("compare_plans", {}, ctx_for(store, JORDAN, JORDAN))
    text = template_answer([out])
    assert "synthetic" in text and "This is an estimate" in text
    assert f"{max(p['cheapest_share'] for p in out['plans'])}%" in text
    assert check_numbers(text, [out]) == []


class Scripted:
    name = "anthropic"
    supports_documents = False

    def __init__(self, script):
        self.script = list(script)

    def is_available(self):
        return True

    def complete(self, system, turns, tools):
        return self.script.pop(0)


def test_chat_loop_uses_the_tool_and_falls_back_to_template_on_invented_numbers(store):
    req = ChatRequest(messages=[ChatMessage(role="user", content="Which plan should we pick?")])
    ctx = build_member_context(store, JORDAN, JORDAN)
    bad = Reply(text="Premium costs $99,999 a year.")
    call = Reply(text="", tool_calls=[ToolCall(id="1", name="compare_plans", args={})])
    events = list(run_chat(req, Scripted([call, bad, bad]), context=ctx))
    assert any(e["event"] == "tool_start" and e["data"]["name"] == "compare_plans" for e in events)
    assert events[-1]["data"]["mode"] == "template"
    said = "".join(e["data"]["text"] for e in events if e["event"] == "token")
    assert "99,999" not in said and "synthetic" in said


def test_primary_gets_the_suggestion_chip(store):
    chips = suggest_questions(build_member_context(store, JORDAN, JORDAN))
    assert "Which plan should we pick?" in chips
