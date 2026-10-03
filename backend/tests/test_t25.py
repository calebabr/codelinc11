"""T25: persisted visits, demo reset, chat sign-in, caps, token expiry, seed on empty DB."""
import pytest
from fastapi.testclient import TestClient

from app.db import Store
from app.db.core import migrate, reset, seed_if_empty
from app.main import app
from app.routers import session
from app.routers.session import get_store

JORDAN, ALEX, MAYA = "m-jordan", "m-alex", "m-maya"


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


def overview(client, h, member):
    return client.get(f"/members/{member}/overview", headers=h).json()


# ---- seed on empty ----
def test_seed_if_empty_seeds_a_migrated_empty_db(tmp_path):
    path = tmp_path / "e.db"
    migrate(path)
    assert Store(path).list_demo_accounts() == []
    assert seed_if_empty(path) is True
    assert len(Store(path).list_demo_accounts()) == 3
    assert seed_if_empty(path) is False  # not twice


# ---- visits ----
def test_log_visit_uses_engine_and_persists(client):
    h = login(client, JORDAN)
    before = overview(client, h, ALEX)["usage"]
    r = client.post(f"/members/{ALEX}/visits", json={"code": "D2392"}, headers=h)
    assert r.status_code == 201, r.text
    body = r.json()
    est = body["estimate"]
    assert est["code"] == "D2392" and est["in_network"] is True
    assert body["usage"]["visits"] == before["visits"] + 1
    assert body["usage"]["max_used"] == pytest.approx(before["max_used"] + est["plan_pays"])
    after = overview(client, h, ALEX)
    assert after["usage"] == body["usage"]
    assert after["benefits"] == body["benefits"]


def test_log_visit_matches_estimate_endpoint(client):
    h = login(client, JORDAN)
    ov = overview(client, h, ALEX)
    ref = client.post("/estimate", json={
        "plan_id": ov["plan_tier"]["id"], "code": "D2740",
        "usage": {"max_used": ov["usage"]["max_used"], "deductible_met": ov["usage"]["deductible_met"],
                  "history": ["D1110"] * ov["usage"]["cleanings_used"]}}).json()["out_of_network"]
    r = client.post(f"/members/{ALEX}/visits", json={"code": "D2740", "in_network": False}, headers=h)
    assert r.json()["estimate"] == ref


def test_log_visit_rules(client):
    jordan, alex = login(client, JORDAN), login(client, ALEX)
    assert client.post(f"/members/{MAYA}/visits", json={"code": "D1110"}, headers=jordan).status_code == 201
    assert client.post(f"/members/{ALEX}/visits", json={"code": "D1110"}, headers=alex).status_code == 201
    assert client.post(f"/members/{JORDAN}/visits", json={"code": "D1110"}, headers=alex).status_code == 403
    assert client.post(f"/members/{ALEX}/visits", json={"code": "D9999"}, headers=jordan).status_code == 404
    assert client.post(f"/members/{ALEX}/visits", json={"code": "D1110"}).status_code == 401
    assert client.post("/members/m-nobody/visits", json={"code": "D1110"}, headers=jordan).status_code == 404
    assert client.post(f"/members/{ALEX}/visits", json={}, headers=jordan).status_code == 422


def test_visit_uses_current_plan_tier(client):
    h = login(client, JORDAN)
    assert client.put("/households/hh-rivera/plan", json={"tier_id": "basic"}, headers=h).status_code == 200
    r = client.post(f"/members/{MAYA}/visits", json={"code": "D2740"}, headers=h).json()
    ov = overview(client, h, MAYA)
    assert ov["plan_tier"]["id"] == "basic"
    assert r["benefits"] == ov["benefits"]


# ---- demo reset ----
def test_demo_reset_restores_seed_and_keeps_sessions(client):
    h = login(client, JORDAN)
    original = overview(client, h, ALEX)
    client.post(f"/members/{ALEX}/visits", json={"code": "D2740"}, headers=h)
    client.put("/households/hh-rivera/plan", json={"tier_id": "basic"}, headers=h)
    assert overview(client, h, ALEX)["usage"] != original["usage"]
    r = client.post("/demo/reset", headers=h)
    assert r.status_code == 200 and r.json() == {"ok": True}
    assert overview(client, h, ALEX) == original  # same token still works


def test_demo_reset_primary_only(client):
    assert client.post("/demo/reset", headers=login(client, ALEX)).status_code == 403
    assert client.post("/demo/reset").status_code == 401


# ---- chat sign-in and caps ----
BODY = {"messages": [{"role": "user", "content": "hi"}], "plan_id": "preferred"}


def test_chat_requires_sign_in_by_default(client, monkeypatch):
    monkeypatch.delenv("ASSISTANT_ALLOW_ANONYMOUS", raising=False)
    assert client.post("/chat", json=BODY).status_code == 401
    assert client.post("/chat", json=BODY, headers={"Authorization": "Bearer junk"}).status_code == 401
    assert client.post("/chat", json=BODY, headers=login(client, JORDAN)).status_code == 200
    assert client.post("/chat/attachments", params={"member_id": ALEX}, content=b"%PDF-1",
                       headers={"Content-Type": "application/pdf"}).status_code == 401
    assert client.get("/chat/suggestions").status_code == 401


def test_chat_anonymous_allowed_with_env(client, monkeypatch):
    monkeypatch.setenv("ASSISTANT_ALLOW_ANONYMOUS", "1")
    assert client.post("/chat", json=BODY).status_code == 200


def test_chat_size_caps(client, monkeypatch):
    monkeypatch.setenv("ASSISTANT_ALLOW_ANONYMOUS", "1")
    msg = {"role": "user", "content": "x"}
    assert client.post("/chat", json={"messages": [msg] * 21}).status_code == 422
    assert client.post("/chat", json={"messages": [{"role": "user", "content": "x" * 4001}]}).status_code == 422
    assert client.post("/chat", json={"messages": [{"role": "user", "content": "x" * 4000}],
                                      "plan_id": "preferred"}).status_code == 200


# ---- tokens ----
def test_token_round_trip_expiry_and_tamper(monkeypatch):
    t = session.make_token(JORDAN)
    assert session.read_token(t) == JORDAN
    now = session._now()
    monkeypatch.setattr(session, "_now", lambda: now + 12 * 3600 + 1)
    assert session.read_token(t) is None  # expired
    monkeypatch.setattr(session, "_now", lambda: now)
    body, sig = t.split(".")
    other = session.make_token(ALEX).split(".")[0]
    assert session.read_token(f"{other}.{sig}") is None  # tampered body
    assert session.read_token(body + "." + "0" * 32) is None
    assert session.read_token("garbage") is None


def test_ttl_env_negative_expires_at_once(monkeypatch):
    monkeypatch.setenv("SESSION_TTL_HOURS", "-1")
    assert session.read_token(session.make_token(JORDAN)) is None


def test_secret_is_saved_and_reused(tmp_path, monkeypatch):
    monkeypatch.delenv("SESSION_SECRET", raising=False)
    monkeypatch.setattr(session, "SECRET_FILE", tmp_path / "sub" / ".session_secret")
    first = session._load_secret()
    assert first and session._load_secret() == first
    monkeypatch.setenv("SESSION_SECRET", "fixed")
    assert session._load_secret() == "fixed"
