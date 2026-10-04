"""Rate limiting (T37): sliding windows, 429 + Retry-After, household isolation, global chat cap."""
import pytest
from fastapi.testclient import TestClient

from app import ratelimit
from app.db import Store
from app.db.core import reset
from app.main import app
from app.routers.session import get_store, make_token

CHAT_BODY = {"messages": [{"role": "user", "content": "hi"}]}


class Clock:
    def __init__(self):
        self.t = 1000.0

    def __call__(self):
        return self.t


@pytest.fixture()
def clock(monkeypatch):
    c = Clock()
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "1")
    monkeypatch.setattr(ratelimit.limiter, "clock", c)
    yield c


@pytest.fixture()
def client(tmp_path, clock):
    path = tmp_path / "t.db"
    reset(path)
    store = Store(path)
    app.dependency_overrides[get_store] = lambda: store
    yield TestClient(app)
    app.dependency_overrides.clear()


def auth(member_id):
    return {"Authorization": f"Bearer {make_token(member_id)}"}


def test_window_blocks_then_expires(clock):
    lim = ratelimit.SlidingWindowLimiter(clock)
    assert [lim.hit("x", "k", [(2, 60)]) for _ in range(2)] == [0, 0]
    assert lim.hit("x", "k", [(2, 60)]) == 60
    clock.t += 30
    assert lim.hit("x", "k", [(2, 60)]) == 30
    clock.t += 31
    assert lim.hit("x", "k", [(2, 60)]) == 0  # the first two hits have aged out


def test_refused_hits_are_not_counted(clock):
    lim = ratelimit.SlidingWindowLimiter(clock)
    lim.hit("x", "k", [(1, 10)])
    for _ in range(5):
        assert lim.hit("x", "k", [(1, 10)]) > 0
    clock.t += 10
    assert lim.hit("x", "k", [(1, 10)]) == 0


def test_chat_429_has_retry_after_and_friendly_body(client, monkeypatch, clock):
    monkeypatch.setenv("RATE_CHAT_PER_MINUTE", "2")
    h = auth("m-jordan")
    for _ in range(2):
        assert client.post("/chat", json=CHAT_BODY, headers=h).status_code == 200
    r = client.post("/chat", json=CHAT_BODY, headers=h)
    assert r.status_code == 429
    assert r.headers["Retry-After"] == "60"
    body = r.json()
    assert body["retry_after"] == 60 and "wait" in body["detail"].lower()
    clock.t += 61
    assert client.post("/chat", json=CHAT_BODY, headers=h).status_code == 200


def test_household_shared_but_other_households_isolated(client, monkeypatch):
    monkeypatch.setenv("RATE_CHAT_PER_MINUTE", "1")
    assert client.post("/chat", json=CHAT_BODY, headers=auth("m-jordan")).status_code == 200
    # AC is in the same household as Marc, so shares the budget
    assert client.post("/chat", json=CHAT_BODY, headers=auth("m-alex")).status_code == 429
    # a caller with no household falls back to its IP key and is counted separately
    assert client.post("/chat", json=CHAT_BODY).status_code != 429


def test_global_chat_cap_applies_across_households(client, monkeypatch):
    monkeypatch.setenv("CHAT_GLOBAL_DAILY_CAP", "2")
    assert client.post("/chat", json=CHAT_BODY, headers=auth("m-jordan")).status_code == 200
    assert client.post("/chat", json=CHAT_BODY).status_code != 429  # a different key, still counted
    r = client.post("/chat", json=CHAT_BODY, headers=auth("m-jordan"))
    assert r.status_code == 429 and "busy" in r.json()["detail"]


def test_daily_chat_limit(client, monkeypatch, clock):
    monkeypatch.setenv("RATE_CHAT_PER_MINUTE", "100")
    monkeypatch.setenv("RATE_CHAT_PER_DAY", "3")
    h = auth("m-jordan")
    for _ in range(3):
        assert client.post("/chat", json=CHAT_BODY, headers=h).status_code == 200
        clock.t += 120
    assert client.post("/chat", json=CHAT_BODY, headers=h).status_code == 429
    clock.t += 86400
    assert client.post("/chat", json=CHAT_BODY, headers=h).status_code == 200


def test_reset_and_visit_and_compute_limits(client, monkeypatch):
    monkeypatch.setenv("RATE_RESET_PER_MINUTE", "1")
    h = auth("m-jordan")
    assert client.post("/demo/reset", headers=h).status_code == 200
    assert client.post("/demo/reset", headers=h).status_code == 429
    monkeypatch.setenv("RATE_COMPUTE_PER_MINUTE", "1")
    v = {"code": "D1110"}
    assert client.post("/members/m-alex/visits", json=v, headers=h).status_code == 201
    assert client.post("/members/m-alex/visits", json=v, headers=h).status_code == 429
    est = {"plan_id": "preferred", "code": "D1110"}
    assert client.post("/estimate", json=est).status_code == 200  # IP key: its own budget
    assert client.post("/estimate", json=est).status_code == 429


def test_attachments_limit_runs_before_the_upload(client, monkeypatch):
    monkeypatch.setenv("RATE_ATTACH_PER_MINUTE", "1")
    h = auth("m-jordan")
    url = "/chat/attachments?member_id=m-jordan"
    assert client.post(url, content=b"x", headers=h).status_code == 415  # counted, then refused as non-PDF
    assert client.post(url, content=b"x", headers=h).status_code == 429


def test_sandbox_login_limit_per_ip_and_trust_proxy(client, monkeypatch):
    monkeypatch.setenv("RATE_LOGIN_PER_MINUTE", "2")

    def fake(ip):
        scope = {"type": "http", "headers": [(b"x-forwarded-for", f"{ip}, 10.0.0.1".encode())],
                 "client": ("9.9.9.9", 1)}
        from starlette.requests import Request
        return Request(scope)

    # without TRUST_PROXY the socket address is used, whatever the header says
    ratelimit.check_sandbox_login(fake("1.1.1.1"))
    ratelimit.check_sandbox_login(fake("2.2.2.2"))
    with pytest.raises(ratelimit.RateLimited) as exc:
        ratelimit.check_sandbox_login(fake("3.3.3.3"))
    assert exc.value.retry_after == 60
    # with TRUST_PROXY the LAST X-Forwarded-For hop (added by the nearest proxy) is the key; the first
    # hop is whatever the caller sent, so changing it no longer gives a new budget
    monkeypatch.setenv("TRUST_PROXY", "1")

    def behind(ip):
        scope = {"type": "http", "headers": [(b"x-forwarded-for", f"{ip}, 10.0.0.1".encode())],
                 "client": ("9.9.9.9", 1)}
        from starlette.requests import Request
        return Request(scope)
    ratelimit.limiter.reset()
    ratelimit.check_sandbox_login(behind("4.4.4.4"))
    ratelimit.check_sandbox_login(behind("5.5.5.5"))
    with pytest.raises(ratelimit.RateLimited):
        ratelimit.check_sandbox_login(behind("6.6.6.6"))


def test_plain_login_is_not_limited(client, monkeypatch):
    monkeypatch.setenv("RATE_LOGIN_PER_MINUTE", "1")
    for _ in range(3):
        assert client.post("/auth/demo-login", json={"member_id": "m-alex"}).status_code == 200


def test_disabled_flag_and_zero_means_unlimited(client, monkeypatch):
    monkeypatch.setenv("RATE_CHAT_PER_MINUTE", "1")
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "0")
    for _ in range(3):
        assert client.post("/chat", json=CHAT_BODY, headers=auth("m-jordan")).status_code == 200
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "1")
    monkeypatch.setenv("RATE_CHAT_PER_MINUTE", "0")
    monkeypatch.setenv("RATE_CHAT_PER_DAY", "0")
    for _ in range(3):
        assert client.post("/chat", json=CHAT_BODY, headers=auth("m-jordan")).status_code == 200
