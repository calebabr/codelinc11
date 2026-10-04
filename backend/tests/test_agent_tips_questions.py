# ruff: noqa: F811
"""Chat tools get_savings_tips and get_dentist_questions: same engines as the Costs page, member
context, number guard, scripted fake model. No network, no real model, no API key."""
import json

from app.agent.context import build_member_context
from app.agent.guard import check_numbers
from app.agent.loop import template_answer
from app.agent.suggestions import suggest_questions
from app.agent.tools import TOOL_SCHEMAS, ToolContext, run_tool
from app.data import load_catalog
from app.engine.tips import savings_tips
from app.models import SavingsTipsRequest, TreatmentItem
from app.questions import build_questions

from .test_agent_assistant import (  # noqa: F401  (fixtures and helpers)
    ALEX,
    JORDAN,
    MAYA,
    FakeProvider,
    _no_key,
    answer_text,
    ask,
    call,
    client_for,
    parse_sse,
    say,
    store,
)

DISC = "This is an estimate, not a guarantee."


def alex_ctx(store):
    return ToolContext.from_member(build_member_context(store, ALEX, ALEX))


def test_tools_are_registered():
    names = {t["function"]["name"] for t in TOOL_SCHEMAS}
    assert {"get_savings_tips", "get_dentist_questions"} <= names


def test_savings_tips_match_the_costs_engine_for_alex_crown(store):
    c = alex_ctx(store)
    got = run_tool("get_savings_tips", {"codes": ["d2740"]}, c)
    req = SavingsTipsRequest(plan=c.plan, usage=c.usage, current_month=c.current_month,
                             items=[TreatmentItem(id="D2740", code="D2740")])
    want = savings_tips(req, c.plan, load_catalog()).model_dump()
    assert got["tips"] == want["tips"] and got["tips"]
    assert got["general"] is False and got["procedures"]
    timing = next(t for t in got["tips"] if t["kind"] == "timing")
    assert timing["before"] == 800 and timing["after"] == 625 and timing["saving"] == 175


def test_urgent_code_is_never_moved(store):
    got = run_tool("get_savings_tips", {"codes": ["D2740"], "urgent_codes": ["D2740"]}, alex_ctx(store))
    assert all(t["kind"] != "timing" for t in got["tips"])


def test_quoted_fee_adds_a_quote_check(store):
    got = run_tool("get_savings_tips", {"codes": ["D2740"], "quoted_fees": {"D2740": 2000}}, alex_ctx(store))
    assert any(t["kind"] == "quote_check" for t in got["tips"])


def test_general_tips_and_questions_without_a_procedure(store):
    c = alex_ctx(store)
    tips = run_tool("get_savings_tips", {}, c)
    assert tips["general"] is True and "error" not in tips
    qs = run_tool("get_dentist_questions", {}, c)
    assert qs["general"] is True and qs["sections"] and qs["safety_note"]


def test_dentist_questions_match_the_costs_engine(store):
    c = alex_ctx(store)
    got = run_tool("get_dentist_questions", {"codes": ["D2740"]}, c)
    want = build_questions(c.plan, c.usage, ["D2740"], c.current_month, load_catalog()).model_dump()
    assert got["sections"] == want["sections"] and got["safety_note"] == want["safety_note"]


def test_unknown_code_is_an_error_not_a_crash(store):
    c = alex_ctx(store)
    assert "error" in run_tool("get_savings_tips", {"codes": ["D9999"]}, c)
    assert "error" in run_tool("get_dentist_questions", {"codes": "D9999"}, c)


def test_guard_accepts_tip_amounts_and_rejects_invented_ones(store):
    res = run_tool("get_savings_tips", {"codes": ["D2740"]}, alex_ctx(store))
    ok = "Waiting until January lowers your cost from $800 to $625, saving $175."
    assert check_numbers(ok, [res]) == []
    assert check_numbers("You would save $999.", [res]) == ["$999"]


def test_chat_calls_savings_tool_and_passes_the_guard(client_for):
    fake = FakeProvider([
        say("Ways to save on the crown:\n- Wait until January: $800 now, $625 then, about $175 less.\n"
            "If it hurts or is urgent, see your dentist right away. " + DISC)])
    ev = parse_sse(ask(client_for(fake), ALEX, "How can I save money on this crown?").text)
    assert "get_savings_tips" in [d["name"] for n, d in ev if n == "tool_start"]
    assert ev[-1][1]["mode"] == "anthropic" and "$175" in answer_text(ev)
    names = {t["function"]["name"] for t in fake.calls[0]["tools"]}
    assert "get_savings_tips" in names
    system = fake.calls[0]["system"]
    assert "get_savings_tips" in system and "get_dentist_questions" in system
    assert "urgent or painful" in system


def test_chat_calls_questions_tool(client_for):
    fake = FakeProvider([call("get_dentist_questions", codes=["D3330"]),
                         say("Questions to ask:\n- Which codes will you bill?\n" + DISC)])
    ev = parse_sse(ask(client_for(fake), ALEX, "What should I ask before the root canal?").text)
    end = [d for n, d in ev if n == "tool_end"][-1]
    assert end["result"]["sections"] and end["result"]["safety_note"]
    assert ev[-1][1]["mode"] == "anthropic"


def test_invented_tip_amount_falls_back_to_a_template(client_for):
    fake = FakeProvider([call("get_savings_tips", codes=["D2740"]),
                         say("You could save $5,555."), say("Really, $5,555.")])
    ev = parse_sse(ask(client_for(fake), ALEX, "Any tips to lower my bill?").text)
    assert ev[-1][1]["mode"] == "template"
    text = answer_text(ev)
    assert "$5,555" not in text and "ways to save" in text.lower() and DISC in text


def test_template_for_questions(store):
    res = run_tool("get_dentist_questions", {"codes": ["D2740"]}, alex_ctx(store))
    text = template_answer([res])
    assert text and "Questions to ask your dentist" in text and DISC in text
    assert check_numbers(text, [res]) == []


def test_chips_present_for_adults_and_children(store):
    adult = suggest_questions(build_member_context(store, JORDAN, ALEX))
    assert "How can I save on this?" in adult and "What should I ask my dentist?" in adult
    child = suggest_questions(build_member_context(store, JORDAN, MAYA))
    assert any("ask" in q.lower() and "dentist" in q.lower() for q in child)
    assert len(adult) <= 7 and len(child) <= 7
    json.dumps(adult)


# ---------------------------------------------------------------- deterministic pre-step

def _started(ev):
    return [d["name"] for n, d in ev if n == "tool_start"]


def test_prestep_root_canal_questions_never_asks_a_clarifying_question(client_for):
    fake = FakeProvider([say("For a molar root canal, ask:\n- Which codes will you bill?\n" + DISC)])
    ev = parse_sse(ask(client_for(fake), ALEX, "What should I ask my dentist about a root canal?").text)
    assert _started(ev) == ["find_procedure", "get_dentist_questions"]
    end = [d for n, d in ev if n == "tool_end"][1]
    assert end["result"]["procedures"] and end["result"]["sections"]
    assert len(fake.calls) == 1  # the model only wrote the answer
    turns = fake.calls[0]["turns"]
    call_turn = next(t for t in turns if t.get("tool_calls"))
    assert call_turn["tool_calls"][1]["args"] == {"codes": ["D3330"]}
    assert "Do not ask a clarifying" in fake.calls[0]["system"]
    assert ev[-1][1]["mode"] == "anthropic"


def test_prestep_savings_request_for_a_crown(client_for):
    fake = FakeProvider([say("For a crown: wait until January, $800 now or $625 then. " + DISC)])
    ev = parse_sse(ask(client_for(fake), ALEX, "How can I save money on a crown?").text)
    assert _started(ev) == ["find_procedure", "get_savings_tips"]
    assert ev[-1][1]["mode"] == "anthropic" and "$625" in answer_text(ev)


def test_prestep_uses_the_procedure_named_earlier(client_for):
    fake = FakeProvider([say("For a crown, ask:\n- Which codes will you bill?\n" + DISC)])
    body = {"messages": [{"role": "user", "content": "What will a crown cost me?"},
                         {"role": "assistant", "content": "You would pay $800. " + DISC},
                         {"role": "user", "content": "What should I ask my dentist?"}],
            "member_id": ALEX}
    from .test_agent_assistant import auth
    ev = parse_sse(client_for(fake).post("/chat", json=body, headers=auth(ALEX)).text)
    end = [d for n, d in ev if n == "tool_end"][1]
    assert _started(ev)[1] == "get_dentist_questions" and "Crown" in end["result"]["procedures"][0]


def test_prestep_skipped_for_unrelated_or_unmatched_questions(client_for):
    fake = FakeProvider([call("estimate_cost", code="D2740"), say("You would pay $800. " + DISC)])
    ev = parse_sse(ask(client_for(fake), ALEX, "What will a crown cost me?").text)
    assert _started(ev) == ["estimate_cost"]
    # tips intent but no procedure anywhere: normal loop, model decides
    fake = FakeProvider([call("get_savings_tips"), say("Here are general ideas. " + DISC)])
    ev = parse_sse(ask(client_for(fake), ALEX, "Any tips to lower my bill?").text)
    assert _started(ev) == ["get_savings_tips"] and len(fake.calls) == 2
