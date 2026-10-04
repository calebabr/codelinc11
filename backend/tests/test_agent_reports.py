# ruff: noqa: F811
"""Assistant for reports (T44): scope "reports" on POST /chat, tools get_reports and explain_report,
deterministic pre-steps, number guard, visibility and privacy. Scripted fake model; no network, no
real model, no API key."""
import json

from app.agent.context import build_member_context
from app.agent.guard import check_numbers
from app.agent.loop import REPORTS_PROMPT, reports_followups, run_chat, template_answer
from app.agent.tools import REPORT_TOOL_SCHEMAS, TOOL_SCHEMAS, ToolContext, run_tool
from app.models import ChatMessage, ChatRequest
from app.reports import get_sample, list_samples, parse_document

from .test_agent_assistant import (  # noqa: F401  (fixtures and helpers)
    ALEX,
    JORDAN,
    MAYA,
    FakeProvider,
    _no_key,
    answer_text,
    ask,
    auth,
    call,
    client_for,
    parse_sse,
    say,
    store,
)

DISC = "This is an estimate, not a guarantee."


def sample_rows():
    """All five sample documents as stored rows (amounts in cents), no database needed."""
    rows = []
    for n, s in enumerate(list_samples(), start=1):
        item = parse_document(s.text, [])
        rows.append({**item, "id": f"ri-t{n}", "member_id": ALEX, "created_at": "2026-10-04"})
    return rows


def ctx_with(rows):
    c = ToolContext.default()
    c.reports = rows
    return c


def rid(rows, sample_id):
    n = [s.id for s in list_samples()].index(sample_id) + 1
    return next(r["id"] for r in rows if r["id"] == f"ri-t{n}")


def started(ev):
    return [d["name"] for n, d in ev if n == "tool_start"]


def ends(ev):
    return [d for n, d in ev if n == "tool_end"]


def ask_reports(client, member, text, viewer=None):
    return ask(client, member, text, viewer=viewer, scope="reports")


# ---------------------------------------------------------------- tools

def test_report_tools_are_separate_from_the_general_tools():
    assert {t["function"]["name"] for t in REPORT_TOOL_SCHEMAS} == {"get_reports", "explain_report"}
    assert not {"get_reports", "explain_report"} & {t["function"]["name"] for t in TOOL_SCHEMAS}


def test_get_reports_returns_stored_values_and_engine_totals():
    rows = sample_rows()
    res = run_tool("get_reports", {}, ctx_with(rows))
    assert res["count"] == 5
    assert [i["service_date"] for i in res["items"]] == sorted(i["service_date"] for i in res["items"])
    t = res["report_totals"]
    # unpaid: filling EOB 80 + out-of-network crown EOB 925 + copay 25 (the claims have no balance)
    assert t["you_owe_open"] == 1030.0 and t["you_paid"] == 0.0
    eob = next(i for i in res["items"] if i["code"] == "D2740")
    assert (eob["billed"], eob["allowed"], eob["plan_paid"], eob["balance_billing"], eob["you_owe"]) == (
        1500.0, 1200.0, 575.0, 300.0, 925.0)
    assert sum(u["you_owe"] for u in res["unpaid_items"]) == 1030.0


def test_get_reports_filters_and_validates():
    c = ctx_with(sample_rows())
    assert run_tool("get_reports", {"kind": "eob"}, c)["count"] == 2
    assert run_tool("get_reports", {"kind": "EOB"}, c)["count"] == 2
    assert run_tool("get_reports", {"from": "2026-10-01", "to": "2026-10-31"}, c)["count"] == 3
    assert "error" in run_tool("get_reports", {"kind": "invoice"}, c)
    assert "error" in run_tool("get_reports", {"from": "last week"}, c)
    empty = run_tool("get_reports", {}, ToolContext.default())
    assert empty["count"] == 0 and empty["report_totals"]["you_owe_open"] == 0.0


def test_explain_report_matches_the_reports_page_explanation():
    from app.reports import explain
    rows = sample_rows()
    got = run_tool("explain_report", {"id": rid(rows, "sample-eob-out-of-network")}, ctx_with(rows))
    want = explain(next(r for r in rows if r["code"] == "D2740")).model_dump()
    assert got == want and got["balance_billing_note"] and got["lines_add_up"] is True
    assert "error" in run_tool("explain_report", {"id": "ri-nope"}, ctx_with(rows))
    assert "error" in run_tool("explain_report", {}, ctx_with(rows))


def test_no_contact_details_notes_or_raw_text_reach_the_model():
    rows = sample_rows()
    c = ctx_with(rows)
    blob = json.dumps([run_tool("get_reports", {}, c)]
                      + [run_tool("explain_report", {"id": r["id"]}, c) for r in rows])
    for secret in ("@", "phone", "email", "MOLAR MONEY SAMPLE DOCUMENT", "Provider:", "data_json"):
        assert secret not in blob
    for forbidden in ("provider_id", "member_id", "created_at"):
        assert forbidden not in blob


# ---------------------------------------------------------------- guard

def test_guard_accepts_amounts_from_cents_in_both_forms_and_blocks_invented_ones():
    rows = sample_rows()
    c = ctx_with(rows)
    res = [run_tool("explain_report", {"id": rid(rows, "sample-eob-out-of-network")}, c)]
    assert check_numbers("You owe $925, which is $925.00 in all.", res) == []
    assert check_numbers("That includes $300 of balance billing and the plan paid $575.", res) == []
    assert check_numbers("You owe $1,925.", res) == ["$1,925"]
    tot = [run_tool("get_reports", {}, c)]
    assert check_numbers("You owe $1,030 in total.", tot) == []
    assert check_numbers("You owe $1,040.", tot) == ["$1,040"]


# ---------------------------------------------------------------- scope plumbing and chat loop

def test_scope_is_accepted_and_uses_the_reports_prompt_and_tools(client_for):
    fake = FakeProvider([call("get_reports"),
                         say("Your saved documents are made-up samples. Jordan has one EOB. " + DISC)])
    r = ask_reports(client_for(fake), JORDAN, "Show my documents")
    assert r.status_code == 200
    ev = parse_sse(r.text)
    assert started(ev) == ["get_reports"] and ev[-1][1]["mode"] == "anthropic"
    first = fake.calls[0]
    assert first["system"].startswith(REPORTS_PROMPT[:60]) and "made-up sample" in first["system"]
    assert {t["function"]["name"] for t in first["tools"]} == {"get_reports", "explain_report"}


def test_unknown_scope_is_a_422_and_no_scope_is_the_general_assistant(client_for):
    fake = FakeProvider([say("You have $400 left. " + DISC)])
    assert ask(client_for(fake), ALEX, "hi", scope="billing").status_code == 422
    ask(client_for(fake), ALEX, "What is left?")
    assert any(t["function"]["name"] == "estimate_cost" for t in fake.calls[0]["tools"])
    assert "get_reports" not in fake.calls[0]["system"]


def test_a_tool_outside_the_reports_scope_is_refused(client_for):
    fake = FakeProvider([call("estimate_cost", code="D2740"), say("I can only help with documents. " + DISC)])
    ev = parse_sse(ask_reports(client_for(fake), ALEX, "What does a crown cost?").text)
    end = ends(ev)[0]
    assert "error" in end["result"] and "not available" in end["result"]["error"]


def test_the_model_never_sees_contact_details_or_other_chats(client_for, store):
    store.append_member_context(ALEX, ALEX, "chat", "my phone is 555-0100", role="user")
    fake = FakeProvider([say("Nothing is owed. " + DISC)])
    parse_sse(ask_reports(client_for(fake), ALEX, "What do I owe right now?").text)
    seen = json.dumps(fake.calls[0])
    for bad in ("555-0100", "@", "phone", "Plan highlights", "Visits this plan year"):
        assert bad not in seen
    assert "The person asking: Alex." in fake.calls[0]["system"]


def test_reports_chat_is_not_saved_to_general_memory(client_for, store):
    before = len(build_member_context(store, ALEX, ALEX).chat_memory)
    fake = FakeProvider([say("Nothing is owed. " + DISC)])
    parse_sse(ask_reports(client_for(fake), ALEX, "What do I owe right now?").text)
    assert len(build_member_context(store, ALEX, ALEX).chat_memory) == before


# ---------------------------------------------------------------- pre-steps ("What do I owe right now?")

def test_prestep_what_do_i_owe_uses_the_database_totals_for_jordan(client_for):
    fake = FakeProvider([say("You owe $90 on one EOB, a filling. These are made-up samples. " + DISC)])
    ev = parse_sse(ask_reports(client_for(fake), JORDAN, "What do I owe right now?").text)
    assert started(ev) == ["get_reports"]
    end = ends(ev)[0]["result"]
    assert end["report_totals"]["you_owe_open"] == 90.0 and end["unpaid_items"][0]["you_owe"] == 90.0
    assert len(fake.calls) == 1                      # the model only wrote the answer
    assert "Do not ask a clarifying question" in fake.calls[0]["system"]
    assert ev[-1][1]["mode"] == "anthropic" and "$90" in answer_text(ev)


def test_prestep_unpaid_visits_and_nothing_owed(client_for):
    fake = FakeProvider([say("Nothing is owed on your saved documents. " + DISC)])
    ev = parse_sse(ask_reports(client_for(fake), ALEX, "Which visits are still unpaid?").text)
    assert started(ev) == ["get_reports"]
    end = ends(ev)[0]["result"]
    assert end["report_totals"]["you_owe_open"] == 0.0 and end["unpaid_items"] == []
    assert ev[-1][1]["mode"] == "anthropic"


def test_prestep_explain_last_eob_picks_the_newest(client_for):
    fake = FakeProvider([say("This EOB shows the extraction. You owe $190. These are made-up samples. " + DISC)])
    ev = parse_sse(ask_reports(client_for(fake), ALEX, "Explain my last EOB").text)
    assert started(ev) == ["get_reports", "explain_report"]
    turns = fake.calls[0]["turns"]
    call_turn = next(t for t in turns if t.get("tool_calls"))
    assert call_turn["tool_calls"][1]["args"] == {"id": "ri-alex-5"}      # the August extraction
    assert ev[-1][1]["mode"] == "anthropic" and "$190" in answer_text(ev)


def test_prestep_denied_claim_and_no_denied_claim(store):
    rows = sample_rows()
    req = ChatRequest(messages=[ChatMessage(role="user", content="Why was this claim denied?")])
    c = build_member_context(store, ALEX, ALEX)
    fake = FakeProvider([say("The plan covers 2 cleanings per plan year, so the third was denied. "
                             "Ask the office to resubmit it. " + DISC)])
    ev = list(run_chat(req, fake, context=c, scope="reports", reports=rows))
    names = [e["data"]["name"] for e in ev if e["event"] == "tool_start"]
    assert names == ["get_reports", "explain_report"]
    call_turn = next(t for t in fake.calls[0]["turns"] if t.get("tool_calls"))
    assert call_turn["tool_calls"][1]["args"] == {"id": rid(rows, "sample-denied-claim")}
    # no denied claim: only the list is fetched and the model is told to say so
    fake = FakeProvider([say("None of your saved claims was denied. " + DISC)])
    ev = list(run_chat(req, fake, context=c, scope="reports", reports=[r for r in rows if r["code"] != "D1110"]))
    assert [e["data"]["name"] for e in ev if e["event"] == "tool_start"] == ["get_reports"]
    assert "no claim was denied" in fake.calls[0]["system"].lower()


def test_unrelated_reports_question_lets_the_model_choose_the_tool(client_for):
    fake = FakeProvider([call("get_reports", kind="copay"), say("You have one copay visit. " + DISC)])
    ev = parse_sse(ask_reports(client_for(fake), ALEX, "Do I have any copay visits?").text)
    assert started(ev) == ["get_reports"] and len(fake.calls) == 2


# ---------------------------------------------------------------- fallbacks and failures

def test_invented_amount_in_a_reports_answer_falls_back_to_a_template(client_for):
    fake = FakeProvider([say("You owe $9,999."), say("Really, $9,999.")])
    ev = parse_sse(ask_reports(client_for(fake), JORDAN, "What do I owe right now?").text)
    assert ev[-1][1]["mode"] == "template"
    text = answer_text(ev)
    assert "$9,999" not in text and "$90" in text and "made-up" in text and DISC in text


def test_template_for_an_explanation_and_for_totals():
    rows = sample_rows()
    c = ctx_with(rows)
    ex = run_tool("explain_report", {"id": rid(rows, "sample-eob-out-of-network")}, c)
    text = template_answer([ex])
    assert text and "balance billing" in text.lower() and "$925" in text and DISC in text
    assert check_numbers(text, [ex]) == []
    tot = run_tool("get_reports", {}, c)
    text = template_answer([tot])
    assert text and "$1,030" in text and check_numbers(text, [tot]) == []
    # the list is only context when one document was explained
    both = template_answer([tot, ex])
    assert both and "You still owe" not in both


def test_no_model_says_so_plainly_for_reports(client_for):
    ev = parse_sse(ask_reports(client_for(None), ALEX, "What do I owe right now?").text)
    assert ev[-1][1]["mode"] == "unavailable" and "not available" in answer_text(ev)


# ---------------------------------------------------------------- visibility

def test_a_member_only_gets_reports_they_may_see(client_for):
    fake = FakeProvider([say("Nothing here. " + DISC)])
    # an adult cannot chat about someone else's reports
    assert ask_reports(client_for(fake), JORDAN, "What do I owe?", viewer=ALEX).status_code == 403
    assert ask_reports(client_for(fake), ALEX, "What do I owe?", viewer=MAYA).status_code in (401, 403)
    # a primary can; the tool only ever sees that member's rows
    fake = FakeProvider([say("Nothing is owed. " + DISC)])
    ev = parse_sse(ask_reports(client_for(fake), ALEX, "What do I owe right now?", viewer=JORDAN).text)
    end = ends(ev)[0]["result"]
    assert end["count"] == 5 and all(i["id"].startswith("ri-alex") for i in end["items"])
    # Alex cannot see Jordan's EOB id, even by name
    fake = FakeProvider([call("explain_report", id="ri-jordan-1"), say("I could not find it. " + DISC)])
    ev = parse_sse(ask_reports(client_for(fake), ALEX, "Show ri-jordan-1").text)
    assert "error" in ends(ev)[0]["result"]


def test_unauthenticated_reports_chat_is_refused(client_for):
    r = client_for(FakeProvider([])).post("/chat", json={
        "messages": [{"role": "user", "content": "hi"}], "member_id": ALEX, "scope": "reports"})
    assert r.status_code == 401


# ---------------------------------------------------------------- follow-ups and golden numbers

def test_followups_for_reports(client_for):
    fake = FakeProvider([say("You owe $90. These are made-up samples. " + DISC)])
    ev = parse_sse(ask_reports(client_for(fake), JORDAN, "What do I owe right now?").text)
    chips = ev[-1][1]["followups"]
    assert chips[0] == "What do I owe right now?" and "Explain my last EOB" in chips
    assert "Why was this claim denied?" not in chips and len(chips) <= 4
    allchips = reports_followups(sample_rows())
    assert allchips == ["What do I owe right now?", "Explain my last EOB", "Why was this claim denied?",
                        "Which visits are still unpaid?"]
    assert reports_followups([]) == ["What do I owe right now?"]


def test_the_sample_crown_numbers_still_match_the_golden_g5():
    s = get_sample("sample-eob-out-of-network")
    assert s is not None
    d = parse_document(s.text, [])["data"]
    # G5: plan pays $575, billed $1,500, balance billing $300, you pay $925
    assert (d["plan_paid_cents"], d["billed_cents"], d["balance_billing_cents"], d["you_owe_cents"]) == (
        57500, 150000, 30000, 92500)
