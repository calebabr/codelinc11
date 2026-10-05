"""Saved Plan My Year plans (T20): CRUD and per-member visibility."""
import pytest
from fastapi.testclient import TestClient

from app.db import Store
from app.db.core import reset
from app.main import app
from app.routers.session import get_store, make_token

JORDAN, ALEX, MAYA = "m-jordan", "m-alex", "m-maya"
S2 = [
    {"id": "t1", "code": "D3330", "urgency": "urgent", "after": None},
    {"id": "t2", "code": "D2740", "urgency": "flexible", "after": "t1"},
    {"id": "t3", "code": "D2392", "urgency": "flexible", "after": None},
]


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


def url(member, plan=None):
    return f"/members/{member}/saved-plans" + (f"/{plan}" if plan else "")


def test_seeded_plan_for_alex(client):
    r = client.get(url(ALEX), headers=login(client, ALEX))
    assert r.status_code == 200
    plans = r.json()
    assert [p["name"] for p in plans] == ["Root canal, crown and two fillings"]
    assert [i["code"] for i in plans[0]["items"]] == ["D3330", "D2740", "D2392", "D2392"]
    assert plans[0]["items"][1]["after"] == "t1" and plans[0]["member_id"] == ALEX


def test_create_list_update_delete(client):
    h = login(client, ALEX)
    r = client.post(url(ALEX), json={"name": "My plan", "items": S2}, headers=h)
    assert r.status_code == 201
    rec = r.json()
    assert rec["name"] == "My plan" and rec["items"][0]["code"] == "D3330" and rec["id"]
    names = [p["name"] for p in client.get(url(ALEX), headers=h).json()]
    assert names[0] == "My plan" and len(names) == 2  # newest first, seed still there

    r = client.put(url(ALEX, rec["id"]), json={"name": "Renamed"}, headers=h)
    assert r.status_code == 200 and r.json()["name"] == "Renamed" and len(r.json()["items"]) == 3
    r = client.put(url(ALEX, rec["id"]), json={"items": S2[:1]}, headers=h)
    assert r.json()["name"] == "Renamed" and len(r.json()["items"]) == 1

    assert client.delete(url(ALEX, rec["id"]), headers=h).status_code == 204
    assert client.delete(url(ALEX, rec["id"]), headers=h).status_code == 404
    assert client.put(url(ALEX, rec["id"]), json={"name": "x"}, headers=h).status_code == 404
    assert len(client.get(url(ALEX), headers=h).json()) == 1


def test_visibility(client):
    alex, jordan = login(client, ALEX), login(client, JORDAN)
    maya = {"Authorization": f"Bearer {make_token(MAYA)}"}  # managed members cannot sign in
    assert client.get(url(JORDAN), headers=alex).status_code == 403
    assert client.post(url(JORDAN), json={"name": "x", "items": []}, headers=alex).status_code == 403
    assert client.get(url(ALEX), headers=jordan).status_code == 200
    made = client.post(url(MAYA), json={"name": "Tad", "items": []}, headers=jordan)
    assert made.status_code == 201
    assert client.get(url(MAYA), headers=maya).status_code == 403
    assert client.get(url(MAYA), headers=alex).status_code == 403


def test_plan_of_another_member_is_not_found(client):
    jordan = login(client, JORDAN)
    seeded = client.get(url(ALEX), headers=jordan).json()[0]["id"]
    assert client.delete(url(JORDAN, seeded), headers=jordan).status_code == 404
    assert client.get(url(ALEX), headers=jordan).json()[0]["id"] == seeded


def test_unknown_member_404_and_no_token_401(client):
    assert client.get(url("m-nobody"), headers=login(client, JORDAN)).status_code == 404
    assert client.get(url(ALEX)).status_code == 401
    assert client.post(url(ALEX), json={"name": "x", "items": []}).status_code == 401
    assert client.delete(url(ALEX, "sp-x")).status_code == 401


def test_validation_422(client):
    h = login(client, ALEX)
    bad_code = [{"id": "t1", "code": "D9999", "urgency": "flexible"}]
    assert client.post(url(ALEX), json={"name": "x", "items": bad_code}, headers=h).status_code == 422
    bad_urg = [{"id": "t1", "code": "D1110", "urgency": "whenever"}]
    assert client.post(url(ALEX), json={"name": "x", "items": bad_urg}, headers=h).status_code == 422
    assert client.post(url(ALEX), json={"name": "", "items": []}, headers=h).status_code == 422
    assert client.post(url(ALEX), json={"name": "n" * 61, "items": []}, headers=h).status_code == 422
    many = [{"id": f"t{i}", "code": "D1110"} for i in range(21)]
    assert client.post(url(ALEX), json={"name": "x", "items": many}, headers=h).status_code == 422
    dangling = [{"id": "t1", "code": "D1110", "after": "t9"}]
    assert client.post(url(ALEX), json={"name": "x", "items": dangling}, headers=h).status_code == 422
    seeded = client.get(url(ALEX), headers=h).json()[0]["id"]
    assert client.put(url(ALEX, seeded), json={"items": bad_code}, headers=h).status_code == 422
