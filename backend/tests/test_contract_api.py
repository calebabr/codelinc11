"""API contract and golden numbers through the HTTP layer (T13).

Checks that every documented endpoint exists in /openapi.json, that the key responses have the
shapes the frontend reads, that who-can-see-what holds, and that the golden numbers from
docs/FEATURES.md section 2 come back exactly. No network, no model, no key.
"""
import pytest
from fastapi.testclient import TestClient

from app.db import Store
from app.db.core import reset
from app.main import app
from app.routers.session import get_store

JORDAN, ALEX, MAYA, NOAH = "m-jordan", "m-alex", "m-maya", "m-noah"
HH = "hh-rivera"
ALEX_USAGE = {"max_used": 1100, "deductible_met": 50, "history": []}

EXPECTED_ROUTES = {
    ("get", "/health"), ("get", "/plans"), ("get", "/plans/{plan_id}"), ("get", "/procedures"),
    ("post", "/estimate"), ("post", "/schedule"), ("post", "/benefits-status"),
    ("get", "/reminders.ics"), ("post", "/savings-tips"), ("post", "/questions"),
    ("post", "/treatment-plan/parse"), ("post", "/chat"),
    ("get", "/auth/demo-accounts"), ("post", "/auth/demo-login"),
    ("get", "/households/{household_id}"), ("get", "/members/{member_id}/overview"),
    ("get", "/members/{member_id}/schedule"), ("post", "/households/{household_id}/invites"),
    ("post", "/annual-cost"), ("get", "/chat/suggestions"), ("post", "/chat/attachments"),
}


@pytest.fixture()
def client(tmp_path):
    path = tmp_path / "contract.db"
    reset(path)
    store = Store(path)
    app.dependency_overrides[get_store] = lambda: store
    yield TestClient(app)
    app.dependency_overrides.clear()


def login(client, member_id):
    r = client.post("/auth/demo-login", json={"member_id": member_id})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def keys(obj, *names):
    missing = [n for n in names if n not in obj]
    assert not missing, f"missing keys {missing} in {sorted(obj)}"


# ---------------------------------------------------------------- endpoints exist
def test_every_documented_endpoint_is_in_openapi(client):
    paths = client.get("/openapi.json").json()["paths"]
    present = {(method, path) for path, ops in paths.items() for method in ops}
    assert EXPECTED_ROUTES - present == set()


# ---------------------------------------------------------------- shapes
def test_demo_login_shape(client):
    body = client.post("/auth/demo-login", json={"member_id": JORDAN}).json()
    keys(body, "token", "member", "household")
    keys(body["member"], "id", "household_id", "name", "relationship", "age", "role", "has_login", "status")
    keys(body["household"], "id", "name", "plan_tier", "members")
    keys(body["household"]["plan_tier"], "id", "name", "monthly_premium", "annual_max", "deductible",
         "preventive_pct", "basic_pct", "major_pct", "ortho_pct")
    assert body["household"]["plan_tier"]["annual_max"] == 1500
    assert body["household"]["plan_tier"]["deductible"] == 50


def test_household_shape(client):
    body = client.get(f"/households/{HH}", headers=login(client, JORDAN)).json()
    keys(body, "id", "name", "plan_tier", "members")
    assert body["id"] == HH and len(body["members"]) == 4


def test_member_overview_shape_and_alex_has_400_left(client):
    body = client.get(f"/members/{ALEX}/overview", headers=login(client, ALEX)).json()
    keys(body, "member", "plan_tier", "usage", "benefits", "eligibility", "as_of")
    keys(body["usage"], "plan_year", "max_used", "deductible_met", "visits", "cleanings_used")
    assert body["usage"]["max_used"] == 1100
    assert body["benefits"]["max_remaining"] == 400
    assert {e["service"] for e in body["eligibility"]} == {"preventive", "basic", "major", "orthodontia"}
    for e in body["eligibility"]:
        keys(e, "label", "covered", "plan_share", "deductible_applies", "note")


def test_member_schedule_shape(client):
    rows = client.get(f"/members/{ALEX}/schedule", headers=login(client, ALEX)).json()
    assert rows, "AC has a seeded reminder"
    keys(rows[0], "id", "member_id", "member_name", "kind", "due_date", "title")
    assert {r["member_id"] for r in rows} == {ALEX}


def test_estimate_shape(client):
    body = client.post("/estimate", json={"plan_id": "preferred", "code": "D2740"}).json()
    keys(body, "in_network", "out_of_network")
    keys(body["in_network"], "code", "name", "category", "in_network", "covered", "billed", "allowed",
         "deductible_applied", "plan_pays", "you_pay", "balance_bill", "max_used_after", "trace")
    keys(body["in_network"]["trace"][0], "label", "amount", "note")


def test_schedule_shape(client):
    body = client.post("/schedule", json={"plan_id": "preferred", "items": [
        {"id": "t1", "code": "D2740"}], "usage": ALEX_USAGE, "current_month": 11}).json()
    keys(body, "items", "years", "total_you_pay", "baseline_you_pay", "savings", "baseline_items", "reasons")
    keys(body["items"][0], "id", "code", "name", "category", "year_offset", "month")
    keys(body["years"][0], "year_offset", "label", "plan_pays", "you_pay", "max_used_end", "max_remaining_end")


def test_annual_cost_shape(client):
    body = client.post("/annual-cost", json={"tier_id": "preferred", "covered_people": 2,
                                             "expected_care": []}).json()
    keys(body, "tier_id", "tier_name", "covered_people", "premiums", "plan_pays", "out_of_pocket_care",
         "total_cost", "per_person", "assumptions", "disclaimer")
    assert len(body["per_person"]) == 2
    assert body["premiums"] == 44 * 12 * 2  # monthly premium x 12 x people
    assert body["disclaimer"].startswith("This is an estimate.")


# ---------------------------------------------------------------- visibility
def test_primary_sees_all_adult_only_self(client):
    primary = login(client, JORDAN)
    assert {m["id"] for m in client.get(f"/households/{HH}", headers=primary).json()["members"]} == {
        JORDAN, ALEX, MAYA, NOAH}
    for m in (JORDAN, ALEX, MAYA, NOAH):
        assert client.get(f"/members/{m}/overview", headers=primary).status_code == 200

    alex = login(client, ALEX)
    assert [m["id"] for m in client.get(f"/households/{HH}", headers=alex).json()["members"]] == [ALEX]
    assert client.get(f"/members/{ALEX}/overview", headers=alex).status_code == 200
    for other in (JORDAN, MAYA, NOAH):
        assert client.get(f"/members/{other}/overview", headers=alex).status_code == 403


def test_maya_cannot_sign_in_and_unknown_member_is_404(client):
    assert client.post("/auth/demo-login", json={"member_id": MAYA}).status_code == 404
    assert client.post("/auth/demo-login", json={"member_id": "m-nobody"}).status_code == 404
    assert MAYA not in {a["member_id"] for a in client.get("/auth/demo-accounts").json()}


def test_no_token_and_forged_token_are_401(client):
    assert client.get(f"/members/{ALEX}/overview").status_code == 401
    forged = {"Authorization": "Bearer bS1hbGV4.0000"}
    assert client.get(f"/members/{ALEX}/overview", headers=forged).status_code == 401


def test_overviews_do_not_mix_between_members(client):
    primary = login(client, JORDAN)
    used = {m: client.get(f"/members/{m}/overview", headers=primary).json()["usage"]["max_used"]
            for m in (JORDAN, ALEX, MAYA, NOAH)}
    assert used == {JORDAN: 210, ALEX: 1100, MAYA: 260, NOAH: 0}


# ---------------------------------------------------------------- golden numbers over HTTP
def est(client, code, usage=None, **extra):
    body = {"plan_id": "preferred", "code": code, **extra}
    if usage:
        body["usage"] = usage
    r = client.post("/estimate", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def test_g1_cleaning_costs_zero(client):
    r = est(client, "D1110")["in_network"]
    assert (r["plan_pays"], r["you_pay"]) == (120, 0)


def test_g2_filling_fresh_year_costs_80(client):
    r = est(client, "D2392")["in_network"]
    assert (r["deductible_applied"], r["plan_pays"], r["you_pay"]) == (50, 120, 80)


def test_g3_crown_with_1100_used_costs_800(client):
    r = est(client, "D2740", {"max_used": 1100, "deductible_met": 0, "history": []})["in_network"]
    assert (r["plan_pays"], r["you_pay"]) == (400, 800)


def test_g4_crown_fresh_year_costs_625(client):
    r = est(client, "D2740")["in_network"]
    assert (r["plan_pays"], r["you_pay"]) == (575, 625)


def test_g5_out_of_network_crown_925_with_300_balance_bill(client):
    r = est(client, "D2740")["out_of_network"]
    assert (r["plan_pays"], r["you_pay"], r["balance_bill"]) == (575, 925, 300)


def test_g6_third_cleaning_is_not_covered(client):
    r = est(client, "D1110", {"max_used": 0, "deductible_met": 0, "history": ["D1110", "D1110"]})["in_network"]
    assert r["covered"] is False and r["you_pay"] == 120
    assert any("limit" in s["note"].lower() or "limit" in s["label"].lower() for s in r["trace"])


S2_ITEMS = [
    {"id": "rc", "code": "D3330", "urgency": "urgent"},
    {"id": "cr", "code": "D2740", "urgency": "flexible", "after": "rc"},
    {"id": "f1", "code": "D2392", "urgency": "flexible"},
    {"id": "f2", "code": "D2392", "urgency": "flexible"},
]


def test_s2_plan_my_year_saves_895(client):
    r = client.post("/schedule", json={"plan_id": "preferred", "items": S2_ITEMS, "usage": ALEX_USAGE,
                                       "current_month": 11})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["baseline_you_pay"] == 2300
    assert body["total_you_pay"] == 1405
    assert body["savings"] == 895
    by_id = {i["id"]: i for i in body["items"]}
    assert by_id["rc"]["year_offset"] == 0          # the urgent root canal never moves
    assert by_id["cr"]["year_offset"] == 1          # the crown waits for the fresh year
    assert [y["you_pay"] for y in body["years"]] == [700, 705]
    assert {i["year_offset"] for i in body["baseline_items"]} == {0}


def test_unknown_inputs_get_plain_errors(client):
    assert client.post("/estimate", json={"plan_id": "preferred", "code": "D0000"}).status_code in (404, 422)
    assert client.post("/estimate", json={"plan_id": "nope", "code": "D2740"}).status_code in (404, 422)
    assert client.post("/annual-cost", json={"tier_id": "nope"}).status_code in (404, 422)
