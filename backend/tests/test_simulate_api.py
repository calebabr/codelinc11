"""POST /simulate: shape, limits, auth, errors."""
import pytest
from fastapi.testclient import TestClient

from app.db import Store
from app.db.core import reset
from app.main import app
from app.routers.session import get_store, make_token

DISCLAIMER = "This is an estimate. Your actual cost depends on your dentist's charges and claim review."


@pytest.fixture()
def client(tmp_path):
    path = tmp_path / "t.db"
    reset(path)
    store = Store(path)
    app.dependency_overrides[get_store] = lambda: store
    yield TestClient(app)
    app.dependency_overrides.clear()


def auth():
    return {"Authorization": f"Bearer {make_token('m-jordan')}"}


def body(**kw):
    base = {"members": [{"id": "m-alex", "name": "Alex", "age": 34, "care_level": "average",
                         "known_care": [{"code": "D2740", "count": 1}]}],
            "plan_ids": ["basic", "preferred", "premium"], "n": 1000, "seed": 42, "in_network": True}
    base.update(kw)
    return base


def test_returns_contract_shape(client):
    r = client.post("/simulate", json=body(), headers=auth())
    assert r.status_code == 200, r.text
    d = r.json()
    assert set(d) == {"n", "seed", "in_network", "plans", "bin_edges", "winner_plan_id", "reasons",
                      "assumptions", "disclaimer"}
    assert d["n"] == 1000 and d["seed"] == 42 and d["in_network"] is True
    assert d["disclaimer"] == DISCLAIMER
    assert [p["plan_id"] for p in d["plans"]] == ["basic", "preferred", "premium"]
    p = d["plans"][2]
    assert set(p) == {"plan_id", "name", "monthly_premium", "premiums_total", "mean", "median", "p10",
                      "p90", "min", "max", "cheapest_share", "histogram"}
    assert p["monthly_premium"] == 61.0 and p["premiums_total"] == 732.0
    assert sum(x["cheapest_share"] for x in d["plans"]) == 100
    assert all(len(x["histogram"]) == len(d["bin_edges"]) - 1 for x in d["plans"])
    assert d["winner_plan_id"] in {"basic", "preferred", "premium"}


def test_defaults_and_determinism(client):
    minimal = {"members": [{"id": "a", "age": 30}]}
    a = client.post("/simulate", json=minimal, headers=auth()).json()
    b = client.post("/simulate", json=minimal, headers=auth()).json()
    assert a == b and a["n"] == 5000 and a["seed"] == 42 and len(a["plans"]) == 3


@pytest.mark.parametrize("patch", [
    {"n": 20001}, {"n": 99}, {"members": []}, {"members": [{"id": f"m{i}", "age": 30} for i in range(9)]},
    {"members": [{"id": "a", "age": 30, "care_level": "extreme"}]},
    {"members": [{"id": "a", "age": 30, "known_care": [{"code": "D2740", "count": 6}]}]},
    {"members": [{"id": "a", "age": 30, "known_care": [{"code": "D2740"}] * 11}]},
    {"members": [{"id": "a", "age": -1}]},
])
def test_validation_limits_give_422(client, patch):
    assert client.post("/simulate", json=body(**patch), headers=auth()).status_code == 422


def test_unknown_code_is_422_and_unknown_plan_is_404(client):
    bad_code = body(members=[{"id": "a", "age": 30, "known_care": [{"code": "D9999"}]}])
    assert client.post("/simulate", json=bad_code, headers=auth()).status_code == 422
    assert client.post("/simulate", json=body(plan_ids=["gold"]), headers=auth()).status_code == 404


def test_needs_a_valid_token(client):
    assert client.post("/simulate", json=body()).status_code == 401
    assert client.post("/simulate", json=body(), headers={"Authorization": "Bearer nope"}).status_code == 401


def test_upper_limit_accepted(client):
    r = client.post("/simulate", json=body(n=20000), headers=auth())
    assert r.status_code == 200 and r.json()["n"] == 20000


def test_out_of_network_flag(client):
    inn = client.post("/simulate", json=body(), headers=auth()).json()
    oon = client.post("/simulate", json=body(in_network=False), headers=auth()).json()
    assert oon["in_network"] is False and oon["plans"][1]["mean"] > inn["plans"][1]["mean"]
