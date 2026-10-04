"""Saved "Which plan fits us?" comparisons (T34): CRUD, server-side summary, visibility."""
import pytest
from fastapi.testclient import TestClient

from app.data import load_catalog, load_plans
from app.db import Store
from app.db.core import reset
from app.engine.simulate import simulate
from app.main import app
from app.models import SimulateRequest
from app.routers.session import get_store, make_token

JORDAN, ALEX, MAYA = "m-jordan", "m-alex", "m-maya"
REQ = {
    "members": [{"id": "m-alex", "name": "Alex", "age": 39, "care_level": "average",
                 "known_care": [{"code": "D2740", "count": 1}]}],
    "plan_ids": ["basic", "preferred", "premium"], "n": 500, "seed": 42, "in_network": True,
}


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
    return {"Authorization": f"Bearer {r.json()['token']}"}


def url(member, sim=None):
    return f"/members/{member}/saved-simulations" + (f"/{sim}" if sim else "")


def test_create_list_rename_delete(client):
    h = login(client, ALEX)
    assert client.get(url(ALEX), headers=h).json() == []
    r = client.post(url(ALEX), json={"name": "  First  ", "request": REQ}, headers=h)
    assert r.status_code == 201
    rec = r.json()
    assert rec["id"].startswith("ss-") and rec["name"] == "First" and rec["member_id"] == ALEX
    assert rec["request"]["members"][0]["known_care"] == [{"code": "D2740", "count": 1}]
    assert rec["request"]["n"] == 500 and rec["created_at"] and rec["updated_at"]
    assert rec["summary"]["current_plan_id"] == "preferred"

    second = client.post(url(ALEX), json={"name": "Second", "request": REQ}, headers=h).json()
    assert [s["name"] for s in client.get(url(ALEX), headers=h).json()] == ["Second", "First"]

    r = client.put(url(ALEX, rec["id"]), json={"name": "Renamed"}, headers=h)
    assert r.status_code == 200 and r.json()["name"] == "Renamed"
    assert r.json()["summary"] == rec["summary"] and r.json()["request"] == rec["request"]

    assert client.delete(url(ALEX, rec["id"]), headers=h).status_code == 204
    assert client.delete(url(ALEX, rec["id"]), headers=h).status_code == 404
    assert client.put(url(ALEX, rec["id"]), json={"name": "x"}, headers=h).status_code == 404
    assert [s["id"] for s in client.get(url(ALEX), headers=h).json()] == [second["id"]]


def test_summary_is_computed_by_the_server(client):
    h = login(client, ALEX)
    expected = simulate(SimulateRequest(**REQ), load_plans(), load_catalog())
    forged = {"name": "Forged", "request": REQ,
              "summary": {"winner_plan_id": "premium", "winner_name": "Premium", "winner_share": 100,
                          "plans": [], "current_plan_id": "basic"}}
    rec = client.post(url(ALEX), json=forged, headers=h).json()
    s = rec["summary"]
    assert s["winner_plan_id"] == expected.winner_plan_id
    by_id = {p.plan_id: p for p in expected.plans}
    w = by_id[expected.winner_plan_id]
    assert s["winner_name"] == w.name and s["winner_share"] == w.cheapest_share
    assert [p["plan_id"] for p in s["plans"]] == [p.plan_id for p in expected.plans]
    for p in s["plans"]:
        e = by_id[p["plan_id"]]
        assert (p["name"], p["cheapest_share"], p["median"], p["p90"]) == (
            e.name, e.cheapest_share, e.median, e.p90)
    assert s["current_plan_id"] == "preferred"  # the household's plan, not the client's claim


def test_update_request_recomputes_summary(client):
    h = login(client, ALEX)
    rec = client.post(url(ALEX), json={"name": "A", "request": REQ}, headers=h).json()
    new_req = {**REQ, "members": [{**REQ["members"][0], "known_care": []}]}
    r = client.put(url(ALEX, rec["id"]), json={"request": new_req}, headers=h)
    assert r.status_code == 200 and r.json()["name"] == "A"
    expected = simulate(SimulateRequest(**new_req), load_plans(), load_catalog())
    assert r.json()["summary"]["winner_plan_id"] == expected.winner_plan_id
    assert r.json()["request"]["members"][0]["known_care"] == []
    assert r.json()["summary"] != rec["summary"]


def test_visibility(client):
    alex, jordan = login(client, ALEX), login(client, JORDAN)
    maya = {"Authorization": f"Bearer {make_token(MAYA)}"}
    body = {"name": "x", "request": REQ}
    assert client.get(url(JORDAN), headers=alex).status_code == 403
    assert client.post(url(JORDAN), json=body, headers=alex).status_code == 403
    assert client.get(url(ALEX), headers=jordan).status_code == 200
    assert client.post(url(MAYA), json=body, headers=jordan).status_code == 201
    assert client.get(url(MAYA), headers=maya).status_code == 403
    assert client.get(url(MAYA), headers=alex).status_code == 403
    assert client.get(url("m-nobody"), headers=jordan).status_code == 404


def test_other_members_comparison_is_not_found(client):
    alex, jordan = login(client, ALEX), login(client, JORDAN)
    rec = client.post(url(ALEX), json={"name": "x", "request": REQ}, headers=alex).json()
    assert client.put(url(JORDAN, rec["id"]), json={"name": "y"}, headers=jordan).status_code == 404
    assert client.delete(url(JORDAN, rec["id"]), headers=jordan).status_code == 404
    assert client.delete(url(ALEX, rec["id"]), headers=jordan).status_code == 204


def test_validation(client):
    h = login(client, ALEX)
    bad = [
        {"name": "", "request": REQ},
        {"name": "x" * 61, "request": REQ},
        {"name": "   ", "request": REQ},
        {"name": "x", "request": {**REQ, "n": 50}},
        {"name": "x", "request": {**REQ, "members": []}},
        {"name": "x", "request": {**REQ, "plan_ids": ["nope"]}},
        {"name": "x", "request": {**REQ, "members": [{**REQ["members"][0],
                                                      "known_care": [{"code": "D9999", "count": 1}]}]}},
        {"name": "x"},
    ]
    for body in bad:
        assert client.post(url(ALEX), json=body, headers=h).status_code == 422, body
    rec = client.post(url(ALEX), json={"name": "ok", "request": REQ}, headers=h).json()
    assert client.put(url(ALEX, rec["id"]), json={"name": ""}, headers=h).status_code == 422
    assert client.put(url(ALEX, rec["id"]), json={"request": {**REQ, "plan_ids": ["nope"]}},
                      headers=h).status_code == 422
    assert len(client.get(url(ALEX), headers=h).json()) == 1


def test_requires_token(client):
    assert client.get(url(ALEX)).status_code == 401
    assert client.post(url(ALEX), json={"name": "x", "request": REQ}).status_code == 401
    assert client.put(url(ALEX, "ss-1"), json={"name": "x"}).status_code == 401
    assert client.delete(url(ALEX, "ss-1")).status_code == 401


def test_cap_of_20(client):
    h = login(client, ALEX)
    fast = {**REQ, "n": 100}
    for i in range(20):
        assert client.post(url(ALEX), json={"name": f"s{i}", "request": fast}, headers=h).status_code == 201
    assert client.post(url(ALEX), json={"name": "21", "request": fast}, headers=h).status_code == 422
    jordan = login(client, JORDAN)  # the cap is per member
    assert client.post(url(JORDAN), json={"name": "j", "request": fast}, headers=jordan).status_code == 201
    first = client.get(url(ALEX), headers=h).json()[-1]["id"]
    assert client.delete(url(ALEX, first), headers=h).status_code == 204
    assert client.post(url(ALEX), json={"name": "again", "request": fast}, headers=h).status_code == 201
