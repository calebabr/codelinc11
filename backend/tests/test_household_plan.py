"""Household plan switching (T20): primary only, and every plan lookup follows the current tier."""
import pytest
from fastapi.testclient import TestClient

from app.db import AccessDenied, NotFound, Store
from app.db.core import reset
from app.main import app
from app.routers.session import get_store

JORDAN, ALEX = "m-jordan", "m-alex"
HH = "hh-rivera"


@pytest.fixture()
def store(tmp_path):
    path = tmp_path / "t.db"
    reset(path)
    return Store(path)


@pytest.fixture()
def client(store):
    app.dependency_overrides[get_store] = lambda: store
    yield TestClient(app)
    app.dependency_overrides.clear()


def login(client, member_id):
    r = client.post("/auth/demo-login", json={"member_id": member_id})
    return {"Authorization": f"Bearer {r.json()['token']}"}


def switch(client, headers, tier):
    return client.put(f"/households/{HH}/plan", json={"tier_id": tier}, headers=headers)


def test_primary_switches_and_household_matches_get(client):
    h = login(client, JORDAN)
    r = switch(client, h, "basic")
    assert r.status_code == 200
    assert r.json()["plan_tier"]["id"] == "basic" and len(r.json()["members"]) == 4
    assert client.get(f"/households/{HH}", headers=h).json() == r.json()


def test_non_primary_403_unknown_tier_404_no_token_401(client):
    assert switch(client, login(client, ALEX), "basic").status_code == 403
    assert switch(client, login(client, JORDAN), "gold").status_code == 404
    assert client.put(f"/households/{HH}/plan", json={"tier_id": "basic"}).status_code == 401
    assert client.get(f"/households/{HH}", headers=login(client, JORDAN)).json()["plan_tier"]["id"] == "preferred"


def test_store_rules(store):
    with pytest.raises(AccessDenied):
        store.set_household_plan(ALEX, HH, "basic")
    with pytest.raises(NotFound):
        store.set_household_plan(JORDAN, HH, "nope")
    assert store.set_household_plan(JORDAN, HH, "premium")["plan_tier"]["id"] == "premium"


def test_overview_estimate_and_context_follow_current_tier(client):
    jordan, alex = login(client, JORDAN), login(client, ALEX)
    usage = {"max_used": 1100, "deductible_met": 50}
    crown = {"code": "D2740", "usage": usage}

    pref = client.get(f"/members/{ALEX}/overview", headers=alex).json()
    assert pref["plan_tier"]["id"] == "preferred"
    pref_left = pref["benefits"]["max_remaining"]
    assert pref_left == 400
    assert client.post("/estimate", json={**crown, "plan_id": "preferred"}).json()["in_network"]["you_pay"] == 800

    assert switch(client, jordan, "basic").status_code == 200
    basic = client.get(f"/members/{ALEX}/overview", headers=alex).json()
    assert basic["plan_tier"]["id"] == "basic"
    assert basic["plan_tier"]["annual_max"] != pref["plan_tier"]["annual_max"]
    assert basic["benefits"]["max_remaining"] != pref_left
    tier_id = client.get(f"/households/{HH}", headers=alex).json()["plan_tier"]["id"]
    basic_you_pay = client.post("/estimate", json={**crown, "plan_id": tier_id}).json()["in_network"]["you_pay"]
    assert basic_you_pay != 800
    ctx = client.get(f"/members/{ALEX}/assistant-context", headers=alex).json()
    assert "Basic" in str(ctx)

    assert switch(client, jordan, "preferred").status_code == 200
    back = client.get(f"/members/{ALEX}/overview", headers=alex).json()
    assert back["benefits"]["max_remaining"] == pref_left
    assert client.post("/estimate", json={**crown, "plan_id": "preferred"}).json()["in_network"]["you_pay"] == 800
