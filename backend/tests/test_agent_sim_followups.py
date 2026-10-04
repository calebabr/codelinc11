"""Follow-up questions about the plan comparison: pre-steps, what-ifs, method text, followups chips."""
import pytest

from app.agent.context import build_member_context
from app.agent.guard import check_numbers
from app.agent.loop import (
    SYSTEM_PROMPT,
    build_followups,
    in_simulation_context,
    run_chat,
)
from app.agent.providers import Reply, ToolCall
from app.agent.tools import ToolContext, compare_plans, run_tool
from app.data import load_catalog
from app.db import Store
from app.db.core import reset
from app.engine.simulate import sample_household_years
from app.models import ChatMessage, ChatRequest, SimulateMember

JORDAN = "m-jordan"
EARLIER = [
    ChatMessage(role="user", content="Which dental plan should our family pick?"),
    ChatMessage(role="assistant", content="Basic is cheapest in 82% of simulated years. "
                                          "These are synthetic odds."),
]


@pytest.fixture()
def store(tmp_path):
    path = tmp_path / "t.db"
    reset(path)
    return Store(path)


class Spy:
    name = "anthropic"
    supports_documents = False

    def __init__(self, script):
        self.script = list(script)
        self.systems: list[str] = []
        self.turns: list[list[dict]] = []

    def is_available(self):
        return True

    def complete(self, system, turns, tools):
        self.systems.append(system)
        self.turns.append([dict(t) for t in turns])
        return self.script.pop(0)


def chat(store, text, history=EARLIER, script=None):
    req = ChatRequest(messages=[*history, ChatMessage(role="user", content=text)])
    spy = Spy(script or [Reply(text="Here is the answer. This is an estimate, not a guarantee.")])
    ctx = build_member_context(store, JORDAN, JORDAN)
    return list(run_chat(req, spy, context=ctx)), spy


def started(events):
    return [e["data"]["name"] for e in events if e["event"] == "tool_start"]


def share(result, plan_id):
    return next(p["cheapest_share"] for p in result["plans"] if p["plan_id"] == plan_id)


def test_context_detection():
    def req(*msgs):
        return ChatRequest(messages=[ChatMessage(role=r, content=c) for r, c in msgs])
    assert in_simulation_context(req(("user", "Is Preferred worth it?")))
    assert in_simulation_context(req(("user", "What is a bad year?")))
    assert in_simulation_context(req(("assistant", "Basic is cheapest in 80%"), ("user", "ok")))
    assert not in_simulation_context(req(("user", "What will a crown cost me?")))
    old = [("assistant", "synthetic odds"), ("user", "a"), ("assistant", "x"), ("user", "b"),
           ("assistant", "y"), ("user", "What will a crown cost me?")]
    assert not in_simulation_context(req(*old))


def test_improve_followup_runs_both_prestep_tools_and_does_not_just_ask(store):
    events, spy = chat(store, "What can I do to improve?")
    assert started(events) == ["compare_plans", "get_savings_tips"]
    assert len(spy.turns) == 1                       # one model call: the answer
    tool_turns = [t for t in spy.turns[0] if t["role"] == "tool"]
    assert len(tool_turns) == 1 and len(tool_turns[0]["results"]) == 2
    assert "Never ask a clarifying question first" in spy.systems[0]
    assert "pre-treatment" in spy.systems[0] and "delaying urgent" in spy.systems[0]
    assert events[-1]["event"] == "done" and events[-1]["data"]["mode"] == "anthropic"


def test_why_basic_is_cheapest_uses_the_results(store):
    events, spy = chat(store, "Why is Basic cheapest?")
    assert started(events) == ["compare_plans"]
    sent = spy.turns[0][-1]["results"][0]["content"]
    assert "winner_plan_id" in sent and "reasons" in sent


def test_method_question_needs_no_tool_and_prompt_has_the_method(store):
    events, spy = chat(store, "How does this simulation work?")
    assert started(events) == []
    for phrase in ("5,000 possible years", "own deductible and yearly maximum", "starts fresh",
                   "monthly premium times 12", "synthetic placeholders", "waiting periods"):
        assert phrase in spy.systems[0]
        assert phrase in SYSTEM_PROMPT
    assert "followups" not in events[-1]["data"]


def test_alex_crown_what_if_applies_to_alex_only(store):
    ctx = ToolContext.from_member(build_member_context(store, JORDAN, JORDAN))
    base = compare_plans(ctx=ctx)
    out = run_tool("compare_plans", {"known_care_by_member": {"Alex": ["D2740"]}}, ctx)
    known = {m["name"]: m["known_care"] for m in out["members"]}
    assert known["Alex Rivera"] == ["D2740"]
    assert all(v == [] for k, v in known.items() if k != "Alex Rivera")
    assert share(out, "premium") > share(base, "premium")
    # Maya's simulated years are identical with and without Alex's known care.
    household = ctx.household
    cat = load_catalog()
    plain = [SimulateMember(id=p["id"], name=p["name"], age=p["age"]) for p in household]
    from app.models import SimulateKnownCare
    crown = [m.model_copy(update={"known_care": [SimulateKnownCare(code="D2740")]})
             if m.name == "Alex Rivera" else m for m in plain]
    a = sample_household_years(plain, 200, 42, cat)
    b = sample_household_years(crown, 200, 42, cat)
    maya = next(i for i, m in enumerate(plain) if m.name == "Maya Rivera")
    alex = next(i for i, m in enumerate(plain) if m.name == "Alex Rivera")
    assert [y[maya] for y in a] == [y[maya] for y in b]
    assert [y[alex] for y in a] != [y[alex] for y in b]


def test_out_of_network_and_unknown_person(store):
    ctx = ToolContext.from_member(build_member_context(store, JORDAN, JORDAN))
    out = compare_plans(in_network=False, ctx=ctx)
    assert out["in_network"] is False
    assert compare_plans(ctx=ctx)["in_network"] is True
    assert "error" in compare_plans(known_care_by_member={"Zed": ["D2740"]}, ctx=ctx)
    assert "error" in compare_plans(known_care_by_member={"Alex": ["D9999"]}, ctx=ctx)


def test_done_carries_followups_after_a_comparison_only(store):
    events, _ = chat(store, "Why is Basic cheapest?")
    fu = events[-1]["data"]["followups"]
    assert 1 <= len(fu) <= 4
    assert "Why is Basic cheapest?" in fu
    assert any("needs a crown" in q for q in fu) and "How does this simulation work?" in fu
    assert not any("Maya" in q or "Riley" in q for q in fu)   # first adult, not a child
    events, _ = chat(store, "What do I have left this year?", history=[])
    assert events[-1]["event"] == "done" and "followups" not in events[-1]["data"]


def test_followups_when_the_model_calls_compare_plans_itself(store):
    call = Reply(text="", tool_calls=[ToolCall(id="1", name="compare_plans", args={})])
    events, _ = chat(store, "Compare the plans for our family",
                     history=[], script=[call, Reply(text="Done. This is an estimate, not a guarantee.")])
    assert "followups" in events[-1]["data"]


def test_build_followups_without_a_comparison():
    assert build_followups([{"max_remaining": 400}], []) == []


def test_guard_still_rejects_an_invented_figure_in_a_followup(store):
    bad = Reply(text="You would save $98,765 a year.")
    events, _ = chat(store, "What can I do to improve?", script=[bad, bad])
    said = "".join(e["data"]["text"] for e in events if e["event"] == "token")
    assert "98,765" not in said
    assert events[-1]["data"]["mode"] == "template"
    sim = run_tool("compare_plans", {}, ToolContext.from_member(build_member_context(store, JORDAN, JORDAN)))
    assert check_numbers("A bad year costs $98,765.", [sim]) == ["$98,765"]


def _sim(store):
    return run_tool("compare_plans", {}, ToolContext.from_member(build_member_context(store, JORDAN, JORDAN)))


def test_result_carries_each_plans_terms(store):
    terms = {t["plan_id"]: t for t in _sim(store)["plan_terms"]}
    assert terms["basic"]["plan_pays_percent"]["basic"] == 50
    assert terms["basic"]["plan_pays_percent"]["major"] == 0
    assert terms["preferred"]["plan_pays_percent"]["basic"] == 80
    assert {"monthly_premium", "deductible", "annual_max", "frequency_limits_per_year"} <= set(terms["basic"])


def test_percent_guard_rejects_wrong_coverage_and_accepts_real_terms(store):
    from app.agent.guard import check_percents
    sim = _sim(store)
    assert check_percents("Under Basic, fillings are 80%.", [sim]) == ["80%"]
    assert check_percents("Under Basic, the plan pays 50% of fillings.", [sim]) == []
    assert check_percents("Under Preferred, fillings are covered at 80%.", [sim]) == []
    assert check_percents("Basic pays 0% on crowns.", [sim]) == []
    assert check_percents("You would pay 50% of a filling on Basic.", [sim]) == []
    assert check_percents("It is 73.5% of the time.", [sim]) == ["73.5%"]
    top = max(sim["plans"], key=lambda p: p["cheapest_share"])
    assert check_percents(f"{top['name']} is cheapest in {top['cheapest_share']}% of years. "
                          "That is about 1 in 10 years for a bad year.", [sim]) == []
    assert check_percents("No percent here, 5,000 years.", [sim]) == []


def test_loop_rewrites_then_falls_back_on_a_wrong_percentage(store):
    bad = Reply(text="Fillings are 80% under Basic, so Basic is cheapest.")
    events, _ = chat(store, "Why is Basic cheapest?", script=[bad, bad])
    said = "".join(e["data"]["text"] for e in events if e["event"] == "token")
    assert "80% under Basic" not in said and events[-1]["data"]["mode"] == "template"
    good = Reply(text="Under Basic the plan pays 50% of fillings. This is an estimate, not a guarantee.")
    events, _ = chat(store, "Why is Basic cheapest?", script=[bad, good])
    assert events[-1]["data"]["mode"] == "anthropic"


def test_prompt_forbids_an_agreeing_opener_and_requires_plan_terms():
    assert "Never open an answer with agreement" in SYSTEM_PROMPT
    assert "let me correct that" in SYSTEM_PROMPT
    assert "plan_terms" in SYSTEM_PROMPT
