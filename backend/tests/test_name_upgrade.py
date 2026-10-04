"""Upgrade of the renamed template family in an already-seeded database (core.upgrade_template_names).
Temporary database, no network."""
import pytest
from fastapi.testclient import TestClient

from app.db import Store
from app.db.core import connect, migrate, reset, upgrade_template_names
from app.main import app
from app.routers.session import get_store

OLD = [
    ("households", "hh-rivera", "name", "Rivera household"),
    ("members", "m-jordan", "name", "Jordan Rivera"),
    ("members", "m-alex", "name", "Alex Rivera"),
    ("members", "m-maya", "name", "Maya Rivera"),
    ("members", "m-noah", "name", "Noah Rivera"),
    ("members", "m-jordan", "email", "jordan.rivera@example.test"),
    ("members", "m-alex", "email", "alex.rivera@example.test"),
    ("members", "m-noah", "email", "noah.rivera@example.test"),
    ("accounts", "acct-jordan", "display_name", "Jordan Rivera"),
    ("accounts", "acct-alex", "display_name", "Alex Rivera"),
    ("accounts", "acct-noah", "display_name", "Noah Rivera"),
    ("accounts", "acct-jordan", "email", "jordan.rivera@example.test"),
    ("accounts", "acct-alex", "email", "alex.rivera@example.test"),
    ("accounts", "acct-noah", "email", "noah.rivera@example.test"),
]


def make_old(path):
    """A fresh seeded database, then put the old default names back (a database seeded before the rename)."""
    reset(path)
    with connect(path) as c:
        for table, rid, col, old in OLD:
            c.execute(f"UPDATE {table} SET {col} = ? WHERE id = ?", (old, rid))
        c.execute("UPDATE appointments SET note = 'Needed to keep Noah covered.' WHERE member_id = 'm-noah'")
        c.commit()


def snapshot(path):
    with connect(path) as c:
        return {t: [dict(r) for r in c.execute(f"SELECT * FROM {t} ORDER BY 1")]
                for t in ("households", "members", "accounts", "appointments")}


@pytest.fixture()
def path(tmp_path):
    return tmp_path / "up.db"


@pytest.fixture()
def client(path):
    store = Store(path)
    app.dependency_overrides[get_store] = lambda: store
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_old_names_become_new_on_migrate(path, client):
    make_old(path)
    assert "Jordan Rivera" in str(client.get("/auth/demo-accounts").json())
    migrate(path)
    accounts = client.get("/auth/demo-accounts").json()
    names = {a["member_id"]: (a["display_name"], a["email"]) for a in accounts}
    assert names["m-jordan"] == ("Marc Halog", "marc.halog@example.test")
    assert names["m-alex"] == ("AC", "ac.halog@example.test")
    assert names["m-noah"] == ("Hannah", "hannah.halog@example.test")
    assert not any("Rivera" in str(a) for a in accounts)
    d = client.post("/auth/demo-login", json={"member_id": "m-jordan"}).json()
    assert d["household"]["name"] == "Halog household"
    assert sorted(m["name"] for m in d["household"]["members"]) == ["AC", "Hannah", "Marc Halog", "Sophia"]
    headers = {"Authorization": f"Bearer {d['token']}"}
    ov = client.get("/members/m-jordan/overview", headers=headers)
    assert ov.status_code == 200 and "Rivera" not in ov.text
    with connect(path) as c:
        assert c.execute("SELECT note FROM appointments WHERE member_id='m-noah'").fetchone()[0] == \
            "Needed to keep Hannah covered."


def test_ids_do_not_change(path):
    make_old(path)
    with connect(path) as c:
        before = ([r[0] for r in c.execute("SELECT id FROM households")],
                  [r[0] for r in c.execute("SELECT id FROM members ORDER BY id")],
                  [r[0] for r in c.execute("SELECT id FROM accounts ORDER BY id")])
    assert upgrade_template_names(path) == len(OLD) + 1
    with connect(path) as c:
        after = ([r[0] for r in c.execute("SELECT id FROM households")],
                 [r[0] for r in c.execute("SELECT id FROM members ORDER BY id")],
                 [r[0] for r in c.execute("SELECT id FROM accounts ORDER BY id")])
    assert before == after and after[0] == ["hh-rivera"]


def test_running_twice_changes_nothing_more(path):
    make_old(path)
    migrate(path)
    once = snapshot(path)
    assert upgrade_template_names(path) == 0
    migrate(path)
    assert snapshot(path) == once


def test_a_value_changed_on_purpose_is_not_overwritten(path):
    make_old(path)
    with connect(path) as c:
        c.execute("UPDATE members SET name = 'Jordan R. Custom' WHERE id = 'm-jordan'")
        c.execute("UPDATE households SET name = 'Our family' WHERE id = 'hh-rivera'")
        c.commit()
    migrate(path)
    with connect(path) as c:
        assert c.execute("SELECT name FROM members WHERE id='m-jordan'").fetchone()[0] == "Jordan R. Custom"
        assert c.execute("SELECT name FROM households WHERE id='hh-rivera'").fetchone()[0] == "Our family"
        assert c.execute("SELECT name FROM members WHERE id='m-alex'").fetchone()[0] == "AC"


def test_fresh_seed_is_untouched(path):
    reset(path)
    before = snapshot(path)
    assert upgrade_template_names(path) == 0
    assert snapshot(path) == before


def test_sandbox_created_after_upgrade_has_new_names(path, client):
    make_old(path)
    migrate(path)
    r = client.post("/auth/demo-login", json={"member_id": "m-jordan", "sandbox": True})
    assert r.status_code == 200
    d = r.json()
    assert d["household"]["name"] == "Halog household"
    assert "Rivera" not in str(d["household"]["members"])
    # sandbox rows are never touched by the upgrade (they come from the new seed file already)
    sb = d["sandbox"]["household_id"]
    snap = snapshot(path)
    migrate(path)
    assert snapshot(path) == snap
    with connect(path) as c:
        assert c.execute("SELECT name FROM households WHERE id = ?", (sb,)).fetchone()[0] == "Halog household"
