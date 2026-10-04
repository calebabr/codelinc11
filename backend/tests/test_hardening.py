"""Public-demo hardening: forged-header rate limits, unguessable family ids, bounded uploads,
SQLite WAL and busy timeout, expired-family cleanup. Temporary databases, no network."""
import asyncio
import re
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from starlette.requests import Request

from app import ratelimit
from app.db import Store, sandbox
from app.db import core as dbcore
from app.db.core import connect, migrate, reset
from app.main import app
from app.routers import chat as chat_router
from app.routers.session import get_store, make_token

CHAT_BODY = {"messages": [{"role": "user", "content": "hi"}]}
LOGIN = {"member_id": "m-jordan", "sandbox": True}


class Clock:
    def __init__(self):
        self.t = 1000.0

    def __call__(self):
        return self.t


@pytest.fixture(autouse=True)
def _fresh(monkeypatch):
    monkeypatch.setattr(sandbox, "_last_cleanup", None)
    chat_router._ATTACHMENTS.clear()
    yield
    chat_router._ATTACHMENTS.clear()


@pytest.fixture()
def clock(monkeypatch):
    c = Clock()
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "1")
    monkeypatch.setattr(ratelimit.limiter, "clock", c)
    return c


@pytest.fixture()
def store(tmp_path):
    path = tmp_path / "h.db"
    reset(path)
    return Store(path)


@pytest.fixture()
def client(store, clock):
    app.dependency_overrides[get_store] = lambda: store
    yield TestClient(app)
    app.dependency_overrides.clear()


def req(headers=None, peer="9.9.9.9"):
    raw = [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()]
    return Request({"type": "http", "headers": raw, "client": (peer, 1)})


def auth(member_id):
    return {"Authorization": f"Bearer {make_token(member_id)}"}


# ---- 1. client identification and the bypass ---------------------------------------------------

def test_headers_are_ignored_unless_trust_proxy(monkeypatch):
    r = req({"X-Forwarded-For": "1.1.1.1, 2.2.2.2", "X-Nf-Client-Connection-Ip": "3.3.3.3"})
    assert ratelimit.client_ip(r) == "9.9.9.9"
    monkeypatch.setenv("TRUST_PROXY", "0")
    assert ratelimit.client_ip(r) == "9.9.9.9"


def test_trust_proxy_uses_last_hop_and_prefers_netlify(monkeypatch):
    monkeypatch.setenv("TRUST_PROXY", "1")
    assert ratelimit.client_ip(req({"X-Forwarded-For": "6.6.6.6, 1.1.1.1, 2.2.2.2"})) == "2.2.2.2"
    both = {"X-Forwarded-For": "6.6.6.6, 2.2.2.2", "X-Nf-Client-Connection-Ip": "3.3.3.3"}
    assert ratelimit.client_ip(req(both)) == "3.3.3.3"
    assert ratelimit.client_ip(req()) == "9.9.9.9"   # no header at all: the socket address


def test_forged_first_hop_does_not_reset_the_login_limit(client, monkeypatch):
    monkeypatch.setenv("TRUST_PROXY", "1")
    monkeypatch.setenv("RATE_LOGIN_PER_MINUTE", "2")
    codes = [client.post("/auth/demo-login", json=LOGIN,
                         headers={"X-Forwarded-For": f"10.0.0.{i}, 7.7.7.7"}).status_code
             for i in range(3)]
    assert codes == [200, 200, 429]


def test_forged_header_is_ignored_without_trust_proxy(client, monkeypatch):
    monkeypatch.setenv("RATE_LOGIN_PER_MINUTE", "2")
    codes = [client.post("/auth/demo-login", json=LOGIN,
                         headers={"X-Forwarded-For": f"10.0.0.{i}",
                                  "X-Nf-Client-Connection-Ip": f"11.0.0.{i}"}).status_code
             for i in range(3)]
    assert codes == [200, 200, 429]


def test_global_sandbox_creation_cap_returns_429_with_retry_after(client, monkeypatch):
    monkeypatch.setenv("TRUST_PROXY", "1")
    monkeypatch.setenv("DEMO_GLOBAL_LOGIN_PER_MINUTE", "3")
    monkeypatch.setenv("RATE_LOGIN_PER_MINUTE", "1000")
    monkeypatch.setenv("RATE_LOGIN_PER_HOUR", "1000")
    # a different (forged or real) address every time: only the global cap can stop this
    codes = [client.post("/auth/demo-login", json=LOGIN, headers={"X-Nf-Client-Connection-Ip": f"8.8.8.{i}"})
             for i in range(4)]
    assert [r.status_code for r in codes] == [200, 200, 200, 429]
    assert codes[3].headers["Retry-After"] == "60" and codes[3].json()["retry_after"] == 60


def test_global_sandbox_hourly_cap(client, monkeypatch, clock):
    monkeypatch.setenv("DEMO_GLOBAL_LOGIN_PER_MINUTE", "100")
    monkeypatch.setenv("DEMO_GLOBAL_LOGIN_PER_HOUR", "2")
    monkeypatch.setenv("RATE_LOGIN_PER_MINUTE", "100")
    monkeypatch.setenv("RATE_LOGIN_PER_HOUR", "100")
    assert [client.post("/auth/demo-login", json=LOGIN).status_code for _ in range(2)] == [200, 200]
    r = client.post("/auth/demo-login", json=LOGIN)
    assert r.status_code == 429 and int(r.headers["Retry-After"]) > 60
    clock.t += 3601
    assert client.post("/auth/demo-login", json=LOGIN).status_code == 200


def test_chat_is_limited_per_address_across_families(client, store, monkeypatch):
    monkeypatch.setenv("RATE_CHAT_PER_MINUTE", "100")
    monkeypatch.setenv("RATE_CHAT_PER_IP_PER_MINUTE", "2")
    other = store.create_sandbox()["household_id"].split(".")[1]
    heads = [auth("m-jordan"), auth(f"m-jordan.{other}")]
    assert client.post("/chat", json=CHAT_BODY, headers=heads[0]).status_code == 200
    assert client.post("/chat", json=CHAT_BODY, headers=heads[1]).status_code == 200
    r = client.post("/chat", json=CHAT_BODY, headers=heads[0])
    assert r.status_code == 429 and "Retry-After" in r.headers


def test_chat_socket_address_is_counted_even_with_forged_headers(client, monkeypatch):
    monkeypatch.setenv("TRUST_PROXY", "1")
    monkeypatch.setenv("RATE_CHAT_PER_MINUTE", "1000")
    monkeypatch.setenv("RATE_CHAT_PER_IP_PER_MINUTE", "1")   # the shared socket bucket allows 10x
    h = auth("m-jordan")
    codes = [client.post("/chat", json=CHAT_BODY, headers={**h, "X-Forwarded-For": f"5.5.5.{i}"}).status_code
             for i in range(11)]
    assert codes[:10] == [200] * 10 and codes[10] == 429


def test_existing_per_family_chat_limit_still_applies(client, monkeypatch):
    monkeypatch.setenv("RATE_CHAT_PER_MINUTE", "1")
    h = auth("m-jordan")
    assert client.post("/chat", json=CHAT_BODY, headers=h).status_code == 200
    assert client.post("/chat", json=CHAT_BODY, headers=h).status_code == 429


def _at(monkeypatch, hours):
    t0 = datetime(2030, 1, 1, tzinfo=timezone.utc)
    monkeypatch.setattr(sandbox, "_utcnow", lambda: t0 + timedelta(hours=hours))


def test_cap_evicts_oldest_only_beyond_the_cap(store, monkeypatch):
    monkeypatch.setenv("DEMO_MAX_SANDBOXES", "3")
    ids = []
    for h in (0, 1, 2):
        _at(monkeypatch, h)
        ids.append(store.create_sandbox()["household_id"])
    assert all(store.get_sandbox(i) for i in ids)          # at the cap: nobody is evicted
    _at(monkeypatch, 3)
    new = store.create_sandbox()["household_id"]
    assert store.get_sandbox(ids[0]) is None and store.get_sandbox(ids[1]) and store.get_sandbox(ids[2])
    assert store.get_sandbox(new)


def test_cap_prefers_expired_over_live_families(store, monkeypatch):
    monkeypatch.setenv("DEMO_MAX_SANDBOXES", "3")
    ids = []
    for h in (0, 20, 21):
        _at(monkeypatch, h)
        ids.append(store.create_sandbox()["household_id"])
    _at(monkeypatch, 25)    # the first one is 25 hours old (expired), the others are live
    new = store.create_sandbox()["household_id"]
    assert store.get_sandbox(ids[1]) and store.get_sandbox(ids[2]) and store.get_sandbox(new)


# ---- 2. family ids -------------------------------------------------------------------------------

def test_new_family_ids_are_16_hex_and_old_6_hex_ids_still_work(client, monkeypatch):
    r = client.post("/auth/demo-login", json=LOGIN).json()
    hid = r["sandbox"]["household_id"]
    assert re.fullmatch(r"hh-rivera\.[0-9a-f]{16}", hid)
    assert re.fullmatch(r"m-jordan\.[0-9a-f]{16}", r["member"]["id"])
    monkeypatch.setattr(sandbox, "SID_BYTES", 3)             # how families were made before
    legacy = client.post("/auth/demo-login", json=LOGIN).json()
    lid = legacy["sandbox"]["household_id"]
    assert re.fullmatch(r"hh-rivera\.[0-9a-f]{6}", lid)
    again = client.post("/auth/demo-login", json={**LOGIN, "household_id": lid})
    assert again.status_code == 200 and again.json()["member"]["id"] == legacy["member"]["id"]
    assert sandbox.split_id(legacy["member"]["id"])[1] == lid.split(".")[1]
    assert sandbox.split_id(r["member"]["id"])[1] == hid.split(".")[1]
    h = {"Authorization": f"Bearer {legacy['token']}"}
    assert client.get(f"/members/{legacy['member']['id']}/overview", headers=h).status_code == 200


def test_unknown_and_expired_ids_answer_identically(client, monkeypatch):
    hid = client.post("/auth/demo-login", json=LOGIN).json()["sandbox"]["household_id"]
    monkeypatch.setattr(sandbox, "_utcnow", lambda: datetime.now(timezone.utc) + timedelta(hours=30))
    expired = client.post("/auth/demo-login", json={**LOGIN, "household_id": hid})
    unknown = client.post("/auth/demo-login", json={**LOGIN, "household_id": "hh-rivera." + "0" * 16})
    assert (expired.status_code, expired.json()) == (unknown.status_code, unknown.json())
    assert expired.status_code == 410
    e2 = client.get("/auth/demo-accounts", params={"household_id": hid})
    u2 = client.get("/auth/demo-accounts", params={"household_id": "hh-rivera." + "1" * 16})
    assert (e2.status_code, e2.json()) == (u2.status_code, u2.json())


def test_probing_unknown_ids_is_limited_per_address(client, monkeypatch, clock):
    monkeypatch.setenv("RATE_PROBE_PER_MINUTE", "3")
    real = client.post("/auth/demo-login", json=LOGIN).json()["sandbox"]["household_id"]
    for i in range(3):
        r = client.post("/auth/demo-login", json={**LOGIN, "household_id": f"hh-rivera.{i:016x}"})
        assert r.status_code == 410
    r = client.post("/auth/demo-login", json={**LOGIN, "household_id": "hh-rivera." + "f" * 16})
    assert r.status_code == 429 and r.headers["Retry-After"] == "60"
    # once over, even a real id gets no answer (a guess that hit would otherwise be confirmed)
    assert client.post("/auth/demo-login", json={**LOGIN, "household_id": real}).status_code == 429
    assert client.get("/auth/demo-accounts", params={"household_id": real}).status_code == 429
    clock.t += 61
    assert client.post("/auth/demo-login", json={**LOGIN, "household_id": real}).status_code == 200


def test_successful_lookups_are_not_counted_as_probes(client, monkeypatch):
    monkeypatch.setenv("RATE_PROBE_PER_MINUTE", "2")
    real = client.post("/auth/demo-login", json=LOGIN).json()["sandbox"]["household_id"]
    for _ in range(6):
        assert client.get("/auth/demo-accounts", params={"household_id": real}).status_code == 200


def test_probe_counter_is_not_reset_by_a_forged_header(client, monkeypatch):
    monkeypatch.setenv("TRUST_PROXY", "1")
    monkeypatch.setenv("RATE_PROBE_PER_MINUTE", "2")
    codes = [client.get("/auth/demo-accounts", params={"household_id": f"hh-rivera.{i:016x}"},
                        headers={"X-Forwarded-For": f"4.4.4.{i}, 3.3.3.3"}).status_code for i in range(3)]
    assert codes == [410, 410, 429]


# ---- 3. uploads --------------------------------------------------------------------------------

PDF = b"%PDF-1.4\n" + b"x" * 100


def put_pdf(client, member="m-jordan", data=PDF):
    return client.post("/chat/attachments", params={"member_id": member}, content=data,
                       headers={**auth("m-jordan"), "Content-Type": "application/pdf"})


def test_declared_oversize_is_refused_before_reading(client):
    big = b"%PDF-" + b"x" * (chat_router.MAX_PDF_BYTES + 1)
    r = put_pdf(client, data=big)
    assert r.status_code == 413 and not chat_router._ATTACHMENTS


def test_body_without_content_length_is_read_in_bounded_chunks():
    consumed = []

    async def stream():
        for i in range(1000):
            consumed.append(i)
            yield b"x" * 10

    fake = SimpleNamespace(headers={}, stream=stream)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(chat_router.read_limited_body(fake, 25, "too big"))
    assert exc.value.status_code == 413 and len(consumed) <= 3     # stopped at the third chunk

    async def small():
        yield b"ab"
        yield b"cd"
    ok = asyncio.run(chat_router.read_limited_body(SimpleNamespace(headers={}, stream=small), 25, "x"))
    assert ok == b"abcd"
    declared = SimpleNamespace(headers={"content-length": "999"}, stream=stream)
    consumed.clear()
    with pytest.raises(HTTPException):
        asyncio.run(chat_router.read_limited_body(declared, 25, "too big"))
    assert consumed == []     # nothing was read


def test_reports_upload_over_20kb_is_refused(client):
    from app.reports import MAX_UPLOAD_BYTES
    r = client.post("/members/m-jordan/reports/upload", content=b"a" * (MAX_UPLOAD_BYTES + 1),
                    headers={**auth("m-jordan"), "Content-Type": "text/plain"})
    assert r.status_code == 413


def test_per_family_attachment_cap_drops_the_oldest(client):
    ids = [put_pdf(client).json()["attachment_id"] for _ in range(4)]
    assert set(chat_router._ATTACHMENTS) == set(ids[1:])


def test_total_attachment_cap(client, store, monkeypatch):
    monkeypatch.setattr(chat_router, "MAX_ATTACHMENTS_TOTAL", 2)
    ids = [put_pdf(client).json()["attachment_id"]]
    sb = store.create_sandbox()["household_id"].split(".")[1]
    heads = {**auth(f"m-jordan.{sb}"), "Content-Type": "application/pdf"}
    for _ in range(2):
        r = client.post("/chat/attachments", params={"member_id": f"m-jordan.{sb}"}, content=PDF, headers=heads)
        ids.append(r.json()["attachment_id"])
    assert set(chat_router._ATTACHMENTS) == set(ids[1:])


def test_attachments_expire_after_the_ttl(client, monkeypatch):
    now = [100.0]
    monkeypatch.setattr(chat_router, "_clock", lambda: now[0])
    monkeypatch.setenv("ATTACHMENT_TTL_MINUTES", "30")
    aid = put_pdf(client).json()["attachment_id"]
    now[0] += 29 * 60
    assert chat_router._find_attachment(aid) is not None
    now[0] += 2 * 60
    assert chat_router._find_attachment(aid) is None
    body = {**CHAT_BODY, "member_id": "m-jordan", "attachment_ids": [aid]}
    assert client.post("/chat", json=body, headers=auth("m-jordan")).status_code == 404


def test_attachments_go_when_the_family_resets_or_expires(client, store, monkeypatch):
    r = client.post("/auth/demo-login", json=LOGIN).json()
    mid, h = r["member"]["id"], {"Authorization": f"Bearer {r['token']}"}
    aid = client.post("/chat/attachments", params={"member_id": mid}, content=PDF,
                      headers={**h, "Content-Type": "application/pdf"}).json()["attachment_id"]
    assert aid in chat_router._ATTACHMENTS
    assert client.post("/demo/reset", headers=h).status_code == 200
    assert aid not in chat_router._ATTACHMENTS
    aid = client.post("/chat/attachments", params={"member_id": mid}, content=PDF,
                      headers={**h, "Content-Type": "application/pdf"}).json()["attachment_id"]
    monkeypatch.setattr(sandbox, "_utcnow", lambda: datetime.now(timezone.utc) + timedelta(hours=30))
    assert sandbox.cleanup_expired(store.path, force=True) == 1
    assert aid not in chat_router._ATTACHMENTS


# ---- 4. SQLite -------------------------------------------------------------------------------

def test_connection_pragmas(tmp_path):
    path = tmp_path / "p.db"
    reset(path)
    with connect(path) as c:
        assert c.execute("PRAGMA journal_mode").fetchone()[0] == "wal"
        assert c.execute("PRAGMA busy_timeout").fetchone()[0] == 5000
        assert c.execute("PRAGMA synchronous").fetchone()[0] == 1        # NORMAL
        assert c.execute("PRAGMA foreign_keys").fetchone()[0] == 1


def test_readers_are_not_blocked_by_a_writer(tmp_path):
    path = tmp_path / "w.db"
    reset(path)
    writer, reader = connect(path), connect(path)
    try:
        writer.execute("BEGIN IMMEDIATE")
        writer.execute("UPDATE households SET name = 'changed' WHERE id = 'hh-rivera'")
        before = reader.execute("SELECT name FROM households WHERE id = 'hh-rivera'").fetchone()[0]
        assert before != "changed"       # reads the committed state, immediately
        writer.commit()
        assert reader.execute("SELECT name FROM households WHERE id = 'hh-rivera'").fetchone()[0] == "changed"
    finally:
        writer.close()
        reader.close()


def test_polling_notifications_with_nothing_new_does_not_write(client, monkeypatch):
    h = auth("m-jordan")
    assert client.get("/members/m-jordan/notifications", headers=h).status_code == 200
    statements: list[str] = []
    real_connect = dbcore.connect

    def traced(path):
        conn = real_connect(path)
        conn.set_trace_callback(statements.append)
        return conn
    monkeypatch.setattr(dbcore, "connect", traced)
    assert client.get("/members/m-jordan/notifications", headers=h).status_code == 200
    assert statements, "the trace saw nothing"
    writes = [s for s in statements if re.match(r"\s*(BEGIN|INSERT|UPDATE|DELETE|REPLACE)", s, re.IGNORECASE)]
    assert writes == []


def test_new_notifications_are_still_created_and_not_duplicated(store):
    item = {"kind": "test", "title": "t", "body": "b", "dedupe_key": "k1"}
    assert len(store.add_notifications("m-jordan", "m-jordan", [item, dict(item)])) == 1
    assert store.add_notifications("m-jordan", "m-jordan", [item]) == []


def test_reset_removes_stale_wal_files(tmp_path):
    path = tmp_path / "r.db"
    reset(path)
    Path(str(path) + "-wal").write_bytes(b"stale garbage" * 100)
    Path(str(path) + "-shm").write_bytes(b"stale garbage" * 100)
    reset(path)
    with connect(path) as c:
        assert c.execute("SELECT COUNT(*) FROM households").fetchone()[0] >= 1
        assert c.execute("PRAGMA integrity_check").fetchone()[0] == "ok"


def test_remove_database_files_deletes_all_three(tmp_path):
    path = tmp_path / "x.db"
    for suffix in ("", "-wal", "-shm"):
        (tmp_path / f"x.db{suffix}").write_bytes(b"1")
    dbcore.remove_database_files(path)
    assert list(tmp_path.iterdir()) == []


# ---- 5. expired data cleanup ----------------------------------------------------------------------

def count_sandboxes(path):
    c = sqlite3.connect(path)
    try:
        return c.execute("SELECT COUNT(*) FROM sandboxes").fetchone()[0]
    finally:
        c.close()


def test_startup_migrate_deletes_expired_families(store, monkeypatch):
    store.create_sandbox()
    store.create_sandbox()
    assert count_sandboxes(store.path) == 2
    fresh = datetime.now(timezone.utc)
    monkeypatch.setattr(sandbox, "_utcnow", lambda: fresh + timedelta(hours=30))
    migrate(store.path)      # what the server runs at start-up
    assert count_sandboxes(store.path) == 0
    c = sqlite3.connect(store.path)
    try:
        assert c.execute("SELECT COUNT(*) FROM members WHERE id LIKE '%.%'").fetchone()[0] == 0
    finally:
        c.close()


def test_lookup_cleanup_runs_at_most_every_ten_minutes(store, monkeypatch):
    now = [5000.0]
    monkeypatch.setattr(sandbox, "_last_cleanup", None)
    monkeypatch.setattr(sandbox, "time", SimpleNamespace(monotonic=lambda: now[0]))
    start = datetime.now(timezone.utc)
    hours = [0]
    monkeypatch.setattr(sandbox, "_utcnow", lambda: start + timedelta(hours=hours[0]))
    keep = store.create_sandbox()["household_id"]
    old = store.create_sandbox()["household_id"]
    hours[0] = 30
    assert store.get_sandbox(keep) is None          # first lookup: cleanup runs
    assert count_sandboxes(store.path) == 0
    hours[0] = 0
    store.create_sandbox()
    hours[0] = 60
    now[0] += 60
    store.get_sandbox(old)                           # one minute later: skipped
    assert count_sandboxes(store.path) == 1
    now[0] += 600
    store.get_sandbox(old)                           # ten minutes later: runs again
    assert count_sandboxes(store.path) == 0
