"""Household, sign-in, overview, schedule, invites and annual cost (T05)."""
import pytest
from fastapi.testclient import TestClient

from app.db import Store
from app.db.core import reset
from app.main import app
from app.routers.session import get_store

JORDAN, ALEX, MAYA, NOAH = "m-jordan", "m-alex", "m-maya", "m-noah"
HH = "hh-rivera"


@pytest.fixture()
def client(tmp_path):
    path = tmp_path / "t.db"
    reset(path)
    store = Store(path)
    app.dependency_overrides[get_store] = lambda: store
    yield TestClient(app)
    app.dependency_overrides.clear()


def login(client, member_id):
    r = client.post("/auth/demo-login", json={"member_id": member_id})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def by_service(overview):
    return {e["service"]: e for e in overview["eligibility"]}


# ---- sign-in ----
def test_demo_accounts_lists_logins_only(client):
    ids = {a["member_id"] for a in client.get("/auth/demo-accounts").json()}
    assert ids == {JORDAN, ALEX, NOAH}  # Maya is managed, no login


def test_demo_login_returns_token_member_household(client):
    r = client.post("/auth/demo-login", json={"member_id": JORDAN}).json()
    assert r["member"]["id"] == JORDAN and r["token"]
    assert r["household"]["plan_tier"]["id"] == "preferred"
    assert len(r["household"]["members"]) == 4
    adult = client.post("/auth/demo-login", json={"member_id": ALEX}).json()
    assert [m["id"] for m in adult["household"]["members"]] == [ALEX]


def test_demo_login_unknown_or_managed_member(client):
    assert client.post("/auth/demo-login", json={"member_id": "m-nobody"}).status_code == 404
    assert client.post("/auth/demo-login", json={"member_id": MAYA}).status_code == 404


def test_missing_or_forged_token_is_401(client):
    assert client.get(f"/households/{HH}").status_code == 401
    bad = {"Authorization": "Bearer bTphbGV4.deadbeef"}
    assert client.get(f"/households/{HH}", headers=bad).status_code == 401


# ---- visibility ----
def test_primary_reads_whole_household(client):
    r = client.get(f"/households/{HH}", headers=login(client, JORDAN))
    assert r.status_code == 200
    assert {m["id"] for m in r.json()["members"]} == {JORDAN, ALEX, MAYA, NOAH}


def test_adult_reads_only_self(client):
    h = login(client, ALEX)
    members = client.get(f"/households/{HH}", headers=h).json()["members"]
    assert [m["id"] for m in members] == [ALEX]
    assert client.get(f"/members/{ALEX}/overview", headers=h).status_code == 200
    for other in (JORDAN, MAYA, NOAH):
        assert client.get(f"/members/{other}/overview", headers=h).status_code == 403
        assert client.get(f"/members/{other}/schedule", headers=h).status_code == 403


def test_primary_reads_any_member(client):
    h = login(client, JORDAN)
    for m in (JORDAN, ALEX, MAYA, NOAH):
        assert client.get(f"/members/{m}/overview", headers=h).status_code == 200


def test_unknown_ids(client):
    h = login(client, JORDAN)
    assert client.get("/members/m-nobody/overview", headers=h).status_code == 404
    assert client.get("/households/hh-nope", headers=h).status_code in (403, 404)


# ---- overview ----
def test_alex_overview_400_left_in_november(client):
    o = client.get(f"/members/{ALEX}/overview", headers=login(client, ALEX)).json()
    assert o["plan_tier"]["id"] == "preferred" and o["plan_tier"]["annual_max"] == 1500
    assert o["usage"]["max_used"] == 1100 and o["usage"]["deductible_met"] == 50
    assert o["benefits"]["max_remaining"] == 400
    assert o["benefits"]["deductible_remaining"] == 0
    assert o["reminder"] and "$400" in o["reminder"]
    cleaning = next(f for f in o["benefits"]["frequencies"] if f["code"] == "D1110")
    assert (cleaning["used"], cleaning["remaining"]) == (1, 1)
    assert o["as_of"] == "2026-11-01"


def test_overview_is_per_person_not_household_total(client):
    h = login(client, JORDAN)
    jordan = client.get(f"/members/{JORDAN}/overview", headers=h).json()
    maya = client.get(f"/members/{MAYA}/overview", headers=h).json()
    noah = client.get(f"/members/{NOAH}/overview", headers=h).json()
    assert jordan["benefits"]["max_remaining"] == 1500 - 210
    assert maya["benefits"]["max_remaining"] == 1500 - 260
    assert noah["benefits"]["max_remaining"] == 1500


def test_overview_eligibility(client):
    h = login(client, JORDAN)
    jordan = by_service(client.get(f"/members/{JORDAN}/overview", headers=h).json())
    assert jordan["preventive"]["covered"] and jordan["preventive"]["plan_share"] == 1.0
    assert jordan["major"]["plan_share"] == 0.5 and jordan["major"]["deductible_applies"]
    assert not jordan["orthodontia"]["covered"]  # adult
    maya = by_service(client.get(f"/members/{MAYA}/overview", headers=h).json())
    assert maya["orthodontia"]["covered"] and maya["orthodontia"]["plan_share"] == 0.5
    noah = client.get(f"/members/{NOAH}/overview", headers=h).json()
    assert noah["member"]["status"] == "pending"
    assert not any(e["covered"] for e in noah["eligibility"])


# ---- schedule ----
def test_schedule_per_member(client):
    s = client.get(f"/members/{ALEX}/schedule", headers=login(client, ALEX)).json()
    assert [e["due_date"] for e in s] == ["2026-12-15"] and s[0]["kind"] == "reminder"
    s = client.get(f"/members/{JORDAN}/schedule", headers=login(client, JORDAN)).json()
    assert s[0]["title"] == "Cleaning and exam" and s[0]["member_name"] == "Jordan Rivera"


# ---- invites ----
def test_primary_creates_pending_invite(client):
    h = login(client, JORDAN)
    r = client.post(f"/households/{HH}/invites", headers=h, json={"email": "new@example.test"})
    assert r.status_code == 201
    assert r.json()["status"] == "pending" and r.json()["invited_by"] == JORDAN


def test_invite_rules(client):
    h = login(client, JORDAN)
    r = client.post(f"/households/{HH}/invites", headers=h,
                    json={"email": "m@example.test", "member_id": MAYA})
    assert r.status_code == 422  # a child profile cannot get a login
    assert client.post(f"/households/{HH}/invites", headers=h, json={"email": "nope"}).status_code == 422
    r = client.post(f"/households/{HH}/invites", headers=login(client, ALEX),
                    json={"email": "x@example.test"})
    assert r.status_code == 403  # adults cannot invite
    assert client.post(f"/households/{HH}/invites", json={"email": "x@example.test"}).status_code == 401


# ---- annual cost ----
def test_annual_cost_matches_hand_calculation(client):
    # Preferred, 2 people, each: 2 cleanings + 1 filling.
    # Premiums 44 x 12 x 2 = 1056. Filling: $50 deductible + 20% of $150 = $80 (G2).
    # Cleanings $0. Care you pay = 2 x 80 = 160. Total = 1216.
    body = {"tier_id": "preferred", "covered_people": 2,
            "expected_care": [{"code": "D1110", "count": 2}, {"code": "D2392"}]}
    r = client.post("/annual-cost", json=body)
    assert r.status_code == 200
    d = r.json()
    assert d["premiums"] == 1056 and d["out_of_pocket_care"] == 160 and d["total_cost"] == 1216
    assert d["plan_pays"] == 720  # 2 x (120 + 120 + 120)
    assert [p["you_pay"] for p in d["per_person"]] == [80, 80]
    assert d["assumptions"] and "estimate" in d["disclaimer"]


def test_annual_cost_maximum_is_per_person(client):
    # A crown each at $1,200: plan pays $575 per person (G4), nothing shared.
    d = client.post("/annual-cost", json={"tier_id": "preferred", "covered_people": 4,
                                          "expected_care": [{"code": "D2740"}]}).json()
    assert d["plan_pays"] == 4 * 575 and d["out_of_pocket_care"] == 4 * 625


def test_annual_cost_out_of_network_and_errors(client):
    d = client.post("/annual-cost", json={"tier_id": "preferred", "covered_people": 1,
                                          "expected_care": [{"code": "D2740"}],
                                          "in_network": False}).json()
    assert d["out_of_pocket_care"] == 925  # G5
    assert client.post("/annual-cost", json={"tier_id": "gold"}).status_code == 404
    assert client.post("/annual-cost", json={"tier_id": "basic",
                                             "expected_care": [{"code": "X9"}]}).status_code == 422
    assert client.post("/annual-cost", json={"tier_id": "basic", "covered_people": 0}).status_code == 422


def test_openapi_lists_new_endpoints(client):
    paths = client.get("/openapi.json").json()["paths"]
    for p in ("/auth/demo-accounts", "/auth/demo-login", "/households/{household_id}",
              "/households/{household_id}/invites", "/members/{member_id}/overview",
              "/members/{member_id}/schedule", "/annual-cost"):
        assert p in paths
