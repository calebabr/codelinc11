"""Access-layer tests against a temporary database."""

import sqlite3

import pytest

from app.db import AccessDenied, NotFound, Store
from app.db.core import reset, session

JORDAN, ALEX, MAYA, NOAH = "m-jordan", "m-alex", "m-maya", "m-noah"


@pytest.fixture()
def store(tmp_path):
    path = tmp_path / "test.db"
    reset(path)
    return Store(path)


def test_seed_alex_starts_with_1100_used_and_deductible_met(store):
    u = store.get_member_usage(ALEX, ALEX)
    assert u["max_used_cents"] == 110000
    assert u["deductible_met_cents"] == 5000
    tier = store.get_household(JORDAN, "hh-rivera")["plan_tier"]
    assert tier["annual_max_cents"] - u["max_used_cents"] == 40000  # $400 left
    assert tier["deductible_cents"] == 5000 and tier["major_pct"] == 50


def test_alex_usage_matches_his_visit_history(store):
    visits = store.list_visits(ALEX, ALEX)
    assert sum(v["plan_paid_cents"] for v in visits) == 110000


def test_usage_is_per_person(store):
    assert store.get_member_usage(JORDAN, JORDAN)["max_used_cents"] == 21000
    assert store.get_member_usage(JORDAN, ALEX)["max_used_cents"] == 110000
    assert store.get_member_usage(JORDAN, NOAH)["max_used_cents"] == 0
    assert store.get_member_usage(JORDAN, ALEX, 2027)["max_used_cents"] == 0  # separate year


def test_record_visit_updates_only_that_person(store):
    before = {m: store.get_member_usage(JORDAN, m) for m in (JORDAN, ALEX, MAYA, NOAH)}
    after = store.record_visit(
        JORDAN, MAYA, "2026-11-10", "Cleaning", 12000, 12000, 0, procedure_code="D1110"
    )
    assert after["max_used_cents"] == before[MAYA]["max_used_cents"] + 12000
    assert after["visits"] == before[MAYA]["visits"] + 1
    assert after["cleanings_used"] == before[MAYA]["cleanings_used"] + 1
    for m in (JORDAN, ALEX, NOAH):
        assert store.get_member_usage(JORDAN, m) == before[m]


def test_record_visit_in_new_year_creates_that_years_row(store):
    u = store.record_visit(JORDAN, NOAH, "2027-01-05", "Filling", 20000, 12000, 8000,
                           deductible_applied_cents=5000)
    assert (u["plan_year"], u["max_used_cents"], u["deductible_met_cents"]) == (2027, 12000, 5000)
    assert store.get_member_usage(JORDAN, NOAH)["max_used_cents"] == 0  # 2026 untouched


def test_context_isolation_between_members(store):
    store.append_member_context(ALEX, ALEX, "chat", "What does my crown cost?", role="user")
    store.append_member_context(ALEX, ALEX, "must_have", "Keep the same dentist")
    store.append_member_context(JORDAN, MAYA, "chat", "Tad is nervous", role="user")
    alex = store.get_member_context(ALEX, ALEX)
    maya = store.get_member_context(JORDAN, MAYA)
    assert [c["content"] for c in alex["chat_memory"]] == ["What does my crown cost?"]
    assert [c["content"] for c in maya["chat_memory"]] == ["Tad is nervous"]
    assert "Keep the same dentist" in alex["must_haves"]
    assert "Keep the same dentist" not in maya["must_haves"]
    assert alex["name"] == "Mary" and maya["name"] == "Tad"
    # nothing from Mary's history appears under Tad
    assert {v["description"] for v in maya["history"]} == {"Cleaning and sealants"}


def test_context_has_all_four_parts(store):
    ctx = store.get_member_context(ALEX, ALEX)
    assert ctx["plan_highlights"] and ctx["usage"]["max_used_cents"] == 110000
    assert ctx["history"] and ctx["preferences"] and ctx["must_haves"] is not None


def test_primary_reads_everyone(store):
    hh = store.get_household(JORDAN, "hh-rivera")
    assert {m["id"] for m in hh["members"]} == {JORDAN, ALEX, MAYA, NOAH}
    for m in (JORDAN, ALEX, MAYA, NOAH):
        assert store.get_member_context(JORDAN, m)["member_id"] == m
    assert {s["member_id"] for s in store.list_upcoming_schedule(JORDAN)} == {JORDAN, ALEX, MAYA, NOAH}


def test_adult_reads_only_their_own(store):
    assert store.get_member_context(ALEX, ALEX)["member_id"] == ALEX
    for other in (JORDAN, MAYA, NOAH):
        with pytest.raises(AccessDenied):
            store.get_member_context(ALEX, other)
        with pytest.raises(AccessDenied):
            store.get_member_usage(ALEX, other)
        with pytest.raises(AccessDenied):
            store.record_visit(ALEX, other, "2026-11-10", "x", 1, 1, 0)
        with pytest.raises(AccessDenied):
            store.append_member_context(ALEX, other, "preference", "x")
    assert [m["id"] for m in store.get_household(ALEX, "hh-rivera")["members"]] == [ALEX]
    assert {s["member_id"] for s in store.list_upcoming_schedule(ALEX)} == {ALEX}
    assert not store.can_access(NOAH, ALEX) and store.can_access(NOAH, NOAH)


def test_managed_member_has_no_login(store):
    maya = store.get_member(JORDAN, MAYA)
    assert maya["role"] == "managed" and maya["has_login"] == 0
    assert MAYA not in {a["member_id"] for a in store.list_demo_accounts()}
    with pytest.raises(AccessDenied):
        store.get_member(MAYA, MAYA)


def test_database_rejects_managed_or_minor_login(store):
    with pytest.raises(sqlite3.IntegrityError), session(store.path) as conn:
        conn.execute("UPDATE members SET has_login = 1 WHERE id = ?", (MAYA,))


def test_demo_accounts_are_the_three_adults(store):
    accts = store.list_demo_accounts()
    assert [a["member_id"] for a in accts] == [JORDAN, ALEX, NOAH]
    assert store.get_account_member("acct-alex")["id"] == ALEX


def test_noah_is_pending_student(store):
    n = store.get_member(JORDAN, NOAH)
    assert (n["age"], n["status"], n["full_time_student"]) == (23, "pending", 1)


def test_schedule_is_upcoming_only_and_sorted(store):
    items = store.list_upcoming_schedule(JORDAN)
    dates = [i["due_date"] for i in items]
    assert dates == sorted(dates) and all(d >= "2026-11-01" for d in dates)


def test_invites_primary_only_and_adults_only(store):
    inv = store.create_invite(JORDAN, "someone@example.test")
    assert inv["status"] == "pending"
    with pytest.raises(AccessDenied):
        store.create_invite(ALEX, "x@example.test")
    with pytest.raises(ValueError):
        store.create_invite(JORDAN, "kid@example.test", member_id=MAYA)
    with pytest.raises(ValueError):
        store.create_invite(JORDAN, "alex@example.test", member_id=ALEX)  # already has login
    assert len(store.list_invites(JORDAN)) == 1


def test_accept_invite_for_adult_profile(tmp_path):
    path = tmp_path / "t.db"
    reset(path)
    with session(path) as conn:  # an adult profile without a login yet
        conn.execute("UPDATE members SET has_login = 0 WHERE id = ?", (NOAH,))
        conn.execute("DELETE FROM accounts WHERE member_id = ?", (NOAH,))
    s = Store(path)
    inv = s.create_invite(JORDAN, "noah@example.test", member_id=NOAH)
    assert s.accept_invite(inv["token"])["has_login"] == 1
    assert s.get_member(NOAH, NOAH)["id"] == NOAH
    with pytest.raises(NotFound):
        s.accept_invite(inv["token"])  # already used


def test_reset_rebuilds_from_seed(tmp_path):
    path = tmp_path / "r.db"
    reset(path)
    s = Store(path)
    s.record_visit(JORDAN, JORDAN, "2026-11-02", "Filling", 100, 100, 0)
    reset(path)
    assert Store(path).get_member_usage(JORDAN, JORDAN)["max_used_cents"] == 21000
