# ruff: noqa: F811
"""One regression test per bug that has been fixed in this project (story T1).

Each docstring says what the bug was and when it was found. If one of these fails, an old bug is
back. Never loosen an assertion here to make code pass, and never change a golden number: fix the code.
"""
import pytest
from fastapi.testclient import TestClient

from app import treatment_parser
from app.agent.context import build_member_context
from app.agent.guard import check_numbers, check_percents
from app.agent.tools import ToolContext, run_tool
from app.db import Store
from app.db.core import migrate, reset, seed_if_empty
from app.engine.estimate import estimate
from app.main import app
from app.models import Usage
from app.routers import session
from app.routers.session import get_store

from .test_agent_assistant import (  # noqa: F401  (fixtures and helpers)
    FakeProvider,
    _no_key,
    ask,
    client_for,
    parse_sse,
    say,
    store,
)

JORDAN, ALEX, MAYA = "m-jordan", "m-alex", "m-maya"
HH = "hh-rivera"
DISC = "This is an estimate, not a guarantee."


class _NoOllama:
    def is_available(self) -> bool:
        return False


@pytest.fixture()
def db_store(tmp_path):
    path = tmp_path / "reg.db"
    reset(path)
    return Store(path)


@pytest.fixture()
def api(db_store):
    app.dependency_overrides[get_store] = lambda: db_store
    yield TestClient(app)
    app.dependency_overrides.clear()


def login(c, member_id, **extra):
    r = c.post("/auth/demo-login", json={"member_id": member_id, **extra})
    assert r.status_code == 200, r.text
    return r.json(), {"Authorization": f"Bearer {r.json()['token']}"}


# ------------------------------------------------------------------ quote parser

def test_regression_quote_parser_ignores_header_date_and_totals(monkeypatch):
    """Bug (found 2026-10-02): the quote reader turned the header 'Exam date: 10/02/2026' and the
    'Total estimate' line into procedures, with 2026 as the fee. They must make no items."""
    monkeypatch.setattr(treatment_parser, "OllamaClient", _NoOllama)
    c = TestClient(app)
    quote = ("Patient: Alex Rivera     Exam date: 10/02/2026\n"
             "  #19   D2740   Crown, porcelain/ceramic    $1,600.00\n"
             "Subtotal: $1,600\nTotal estimate: $1,600.00\n")
    r = c.post("/treatment-plan/parse", json={"text": quote})
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    assert [i["code"] for i in items] == ["D2740"]
    assert items[0]["quoted_fee"] == 1600
    assert all(i["quoted_fee"] != 2026 for i in items)


# ------------------------------------------------------------------ plan ids

def test_regression_stale_plan_ids_do_not_exist():
    """Bug (found 2026-10-02): old ids 'demo_ppo' and 'basic_ppo' lingered in code and data.
    GET /plans must return exactly the three tiers, and the old ids must be 404."""
    c = TestClient(app)
    r = c.get("/plans")
    assert r.status_code == 200
    assert sorted(p["id"] for p in r.json()) == ["basic", "preferred", "premium"]
    for old in ("demo_ppo", "basic_ppo"):
        assert c.get(f"/plans/{old}").status_code == 404
        assert c.post("/estimate", json={"plan_id": old, "code": "D2740"}).status_code == 404


# ------------------------------------------------------------------ number and percent guards

def test_regression_assistant_cannot_invent_dollar_amounts():
    """Bug class (guard added 2026-10-01): the assistant stated amounts that no tool returned.
    Any dollar figure not in the tool results (within $1) must be flagged."""
    results = [{"you_pay": 800, "plan_pays": 400}]
    assert check_numbers("You pay $800 and the plan pays $400.", results) == []
    assert check_numbers("You pay $950.", results) == ["$950"]


def test_regression_assistant_cannot_state_wrong_coverage_percent(store):
    """Bug (found 2026-10-02): the assistant said 'Basic fillings 80%' when Basic pays 50% of fillings
    (80% is Preferred). The percent guard must reject it and accept the plan's real term."""
    sim = run_tool("compare_plans", {}, ToolContext.from_member(
        build_member_context(store, JORDAN, JORDAN)))
    assert check_percents("Basic fillings 80%.", [sim]) == ["80%"]
    assert check_percents("Under Basic, fillings are 80%.", [sim]) == ["80%"]
    assert check_percents("Under Basic, the plan pays 50% of fillings.", [sim]) == []
    assert check_percents("Under Preferred, fillings are covered at 80%.", [sim]) == []


# ------------------------------------------------------------------ the $NaN bug

def test_regression_visit_estimate_is_flat_numeric_so_home_never_shows_nan(api):
    """Bug (found 2026-10-03, frontend fix F1 in progress): the Home page showed $NaN after logging a
    visit because it read numbers from the wrong place. POST /members/{id}/visits must return a flat
    'estimate' whose money fields are real numbers and whose in_network is a boolean."""
    _, h = login(api, JORDAN)
    r = api.post(f"/members/{ALEX}/visits", json={"code": "D2392"}, headers=h)
    assert r.status_code == 201, r.text
    body = r.json()
    est = body["estimate"]
    for key in ("billed", "allowed", "deductible_applied", "plan_pays", "you_pay", "balance_bill",
                "max_used_after"):
        assert isinstance(est[key], (int, float)) and not isinstance(est[key], bool), key
        assert est[key] == est[key], f"{key} is NaN"
    assert isinstance(est["in_network"], bool)
    assert isinstance(est["covered"], bool)
    for key in ("max_used", "deductible_met"):
        assert isinstance(body["usage"][key], (int, float)), key


# ------------------------------------------------------------------ golden numbers

def _s2_body():
    return {
        "plan_id": "preferred",
        "items": [
            {"id": "t1", "code": "D3330", "urgency": "urgent"},
            {"id": "t2", "code": "D2740", "urgency": "flexible", "after": "t1"},
            {"id": "t3", "code": "D2392"},
            {"id": "t4", "code": "D2392"},
        ],
        "usage": {"max_used": 1100, "deductible_met": 50},
        "current_month": 11,
    }


def test_regression_plan_year_golden_numbers_2300_to_1405_saves_895():
    """Golden S2 (FEATURES.md section 2): everything now costs $2,300, the optimized plan $1,405,
    saving $895, and the urgent root canal stays in the current year."""
    r = TestClient(app).post("/schedule", json=_s2_body())
    assert r.status_code == 200, r.text
    b = r.json()
    assert (b["baseline_you_pay"], b["total_you_pay"], b["savings"]) == (2300, 1405, 895)
    assert next(i for i in b["items"] if i["id"] == "t1")["year_offset"] == 0


def test_regression_preferred_crown_625_800_925(catalog, plans):
    """Golden G3, G4, G5 on the Preferred plan: crown $625 fresh year, $800 with only $400 of the
    yearly maximum left, $925 out of network ($300 of it balance billing)."""
    crown, preferred = catalog["D2740"], plans["preferred"]
    assert estimate(crown, preferred, Usage()).you_pay == 625
    assert estimate(crown, preferred, Usage(max_used=1100, deductible_met=0)).you_pay == 800
    oon = estimate(crown, preferred, Usage(), in_network=False)
    assert (oon.you_pay, oon.balance_bill) == (925, 300)


# ------------------------------------------------------------------ sign-in, tokens, seeding

def test_regression_chat_requires_a_token(api, monkeypatch):
    """Bug class (found 2026-10-02): /chat answered anonymous callers. With no token or a bad token
    it must return 401 unless ASSISTANT_ALLOW_ANONYMOUS is set."""
    monkeypatch.delenv("ASSISTANT_ALLOW_ANONYMOUS", raising=False)
    body = {"messages": [{"role": "user", "content": "hi"}], "plan_id": "preferred"}
    assert api.post("/chat", json=body).status_code == 401
    assert api.post("/chat", json=body, headers={"Authorization": "Bearer junk"}).status_code == 401


def test_regression_tokens_expire(monkeypatch):
    """Bug class (found 2026-10-02): session tokens never expired. After the lifetime (12 hours by
    default) a token must be rejected."""
    token = session.make_token(JORDAN)
    assert session.read_token(token) == JORDAN
    now = session._now()
    monkeypatch.setattr(session, "_now", lambda: now + 12 * 3600 + 1)
    assert session.read_token(token) is None


def test_regression_empty_database_seeds_itself(tmp_path):
    """Bug (found 2026-10-02): a fresh, migrated but empty database left the login screen with no
    accounts. seed_if_empty must fill it once and only once."""
    path = tmp_path / "empty.db"
    migrate(path)
    assert Store(path).list_demo_accounts() == []
    assert seed_if_empty(path) is True
    assert len(Store(path).list_demo_accounts()) == 3
    assert seed_if_empty(path) is False


def test_regression_sandbox_reset_only_affects_its_own_family(api):
    """Bug class (found 2026-10-02): resetting a demo family must not touch the template family or
    another visitor's private copy."""
    a, ha = login(api, JORDAN, sandbox=True)
    b, hb = login(api, JORDAN, sandbox=True)
    ja, jb = a["member"]["id"], b["member"]["id"]
    assert a["sandbox"]["household_id"] != b["sandbox"]["household_id"]
    visits_a = api.get(f"/members/{ja}/overview", headers=ha).json()["usage"]["visits"]
    api.post(f"/members/{ja}/visits", json={"code": "D2740"}, headers=ha)
    api.post(f"/members/{jb}/visits", json={"code": "D1110"}, headers=hb)
    b_usage = api.get(f"/members/{jb}/overview", headers=hb).json()["usage"]
    assert api.post("/demo/reset", headers=ha).status_code == 200
    assert api.get(f"/members/{ja}/overview", headers=ha).json()["usage"]["visits"] == visits_a
    assert api.get(f"/members/{jb}/overview", headers=hb).json()["usage"] == b_usage
    _, h0 = login(api, JORDAN)
    assert api.get(f"/households/{HH}", headers=h0).status_code == 200


def test_regression_demo_accounts_expose_member_status(api):
    """Bug (found 2026-10-02): the login screen could not tell who was still pending approval.
    /auth/demo-accounts must carry each person's status."""
    accounts = api.get("/auth/demo-accounts").json()
    assert {a["display_name"].split()[0]: a["status"] for a in accounts} == {
        "Jordan": "active", "Alex": "active", "Noah": "pending"}


# ------------------------------------------------------------------ assistant behavior

def test_regression_dentist_questions_request_is_not_a_clarifying_turn(client_for):
    """Bug (found 2026-10-02): 'What should I ask my dentist about a root canal?' got a clarifying
    question back instead of the question list. The deterministic pre-step must call the tools first."""
    fake = FakeProvider([say("For a molar root canal, ask:\n- Which codes will you bill?\n" + DISC)])
    ev = parse_sse(ask(client_for(fake), ALEX, "What should I ask my dentist about a root canal?").text)
    started = [d["name"] for n, d in ev if n == "tool_start"]
    assert started == ["find_procedure", "get_dentist_questions"]
    assert len(fake.calls) == 1
    assert "Do not ask a clarifying" in fake.calls[0]["system"]


def test_regression_compare_plans_what_if_applies_only_to_the_named_member(store):
    """Bug (found 2026-10-02): 'Alex needs a crown' was applied to every family member in the plan
    comparison. Known care must land only on the named person."""
    ctx = ToolContext.from_member(build_member_context(store, JORDAN, JORDAN))
    out = run_tool("compare_plans", {"known_care_by_member": {"Alex": ["D2740"]}}, ctx)
    known = {m["name"]: m["known_care"] for m in out["members"]}
    assert known["Alex Rivera"] == ["D2740"]
    assert all(v == [] for k, v in known.items() if k != "Alex Rivera")
