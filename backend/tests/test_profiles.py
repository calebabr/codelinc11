"""Profiles and family members (sprint 2, B1): PATCH /members/{id}/profile,
POST /households/{id}/members, DELETE /households/{id}/members/{member_id}.
Temporary database, no network, no model, no key."""
import json
import re
import sqlite3
from datetime import date

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.agent.context import build_member_context
from app.agent.providers import Reply, ToolCall
from app.db import DEMO_TODAY, Store
from app.db.core import connect, load_seed_file, migrate, reset
from app.db.store import age_on
from app.main import app
from app.routers import chat as chat_router
from app.routers.session import get_store

TEMPLATE_HH = "hh-rivera"


@pytest.fixture()
def store(tmp_path):
    path = tmp_path / "profiles.db"
    reset(path)
    return Store(path)


@pytest.fixture()
def client(store):
    app.dependency_overrides[get_store] = lambda: store
    yield TestClient(app)
    app.dependency_overrides.clear()


def enter(client, member="m-jordan", household_id=None):
    body = {"member_id": member, "sandbox": True}
    if household_id:
        body["household_id"] = household_id
    r = client.post("/auth/demo-login", json=body)
    assert r.status_code == 200, r.text
    d = r.json()
    return d, {"Authorization": f"Bearer {d['token']}"}


def family(client):
    """A fresh demo family: returns (household_id, {base name: member id}, primary headers,
    {base name: headers} for the people with a login)."""
    d, hj = enter(client, "m-jordan")
    hid = d["sandbox"]["household_id"]
    ids = {m["id"].split(".")[0].removeprefix("m-"): m["id"] for m in d["household"]["members"]}
    heads = {"jordan": hj}
    for who in ("alex", "noah"):
        _, heads[who] = enter(client, f"m-{who}", hid)
    return hid, ids, hj, heads


def template_headers(client):
    r = client.post("/auth/demo-login", json={"member_id": "m-jordan"})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}


def rows(store, sql, args=()):
    with connect(store.path) as c:
        return [dict(r) for r in c.execute(sql, args)]


def detail(r):
    return r.json()["detail"]


def profile(client, hid, headers, member_id):
    members = client.get(f"/households/{hid}", headers=headers).json()["members"]
    return next(m for m in members if m["id"] == member_id)


# ---- migration and seeds ---------------------------------------------------------------------

def test_seed_profiles_match_ages_on_the_demo_clock(client):
    assert DEMO_TODAY == date(2026, 11, 1)
    seed = {m["id"]: m for m in load_seed_file()["members"]}
    assert {k: v["age"] for k, v in seed.items()} == {"m-jordan": 41, "m-alex": 39, "m-maya": 9, "m-noah": 23}
    for m in seed.values():
        assert age_on(date.fromisoformat(m["dob"])) == m["age"]
        assert m["phone"] is None or re.fullmatch(r"33455501\d\d", m["phone"])   # the 555-01xx range
        assert m["zip"] in ("36830", "36849")
        assert m["email"] is None or m["email"].endswith("@example.test")
    assert seed["m-maya"]["email"] is None and seed["m-maya"]["phone"] is None  # a child has no contact


def test_household_members_carry_profile_fields_and_old_fields(client):
    d, h = enter(client)
    hid = d["household"]["id"]
    members = {m["id"].split(".")[0]: m for m in client.get(f"/households/{hid}", headers=h).json()["members"]}
    jordan = members["m-jordan"]
    assert jordan["dob"] == "1985-03-14" and jordan["email"] == "jordan.rivera@example.test"
    assert jordan["phone"] == "3345550142" and jordan["zip"] == "36830" and jordan["notes"] is None
    assert jordan["primary_dentist_id"] is None
    assert jordan["age"] == 41 and jordan["role"] == "primary" and jordan["has_login"] is True
    assert members["m-maya"]["dob"] == "2017-05-09" and members["m-maya"]["age"] == 9


def test_adult_sees_only_their_own_profile(client):
    hid, ids, _hj, heads = family(client)
    members = client.get(f"/households/{hid}", headers=heads["alex"]).json()["members"]
    assert [m["id"] for m in members] == [ids["alex"]]
    assert members[0]["email"] == "alex.rivera@example.test"


def test_template_household_also_has_profiles(client):
    h = template_headers(client)
    jordan = client.get(f"/households/{TEMPLATE_HH}", headers=h).json()["members"][0]
    assert jordan["dob"] == "1985-03-14"


def test_migration_005_upgrades_an_older_database(tmp_path):
    """Run migrations 001-004 only, add a member, then apply 005: rows survive, new columns exist,
    'partner' and 'other' are accepted, and foreign keys still hold."""
    from app.db import core

    path = tmp_path / "old.db"
    real = core.MIGRATIONS_DIR
    older = tmp_path / "mig"
    older.mkdir()
    for f in sorted(real.glob("00[1-4]_*.sql")):
        (older / f.name).write_text(f.read_text(encoding="utf-8"), encoding="utf-8")
    core.MIGRATIONS_DIR = older
    try:
        migrate(path)
    finally:
        core.MIGRATIONS_DIR = real
    with connect(path) as c:
        c.execute("INSERT INTO plan_tiers VALUES ('preferred','Preferred',4400,150000,5000,100,80,50,50)")
        c.execute("INSERT INTO households VALUES ('hh-x','X household','preferred')")
        c.execute("INSERT INTO members (id, household_id, name, relationship, age, role, has_login) "
                  "VALUES ('m-jordan','hh-x','Jordan Rivera','self',41,'primary',1)")
        c.execute("INSERT INTO member_usage (member_id, plan_year) VALUES ('m-jordan', 2026)")
        c.commit()
    assert migrate(path)[0] == "005_profiles.sql"   # later migrations may follow
    with connect(path) as c:
        m = dict(c.execute("SELECT * FROM members WHERE id = 'm-jordan'").fetchone())
        assert m["age"] == 41 and m["dob"] == "1985-03-14" and m["email"] == "jordan.rivera@example.test"
        assert c.execute("SELECT COUNT(*) FROM member_usage").fetchone()[0] == 1
        c.execute("INSERT INTO members (id, household_id, name, relationship, age, role, has_login) "
                  "VALUES ('m-p','hh-x','Pat','partner',30,'adult',0)")
        assert c.execute("PRAGMA foreign_key_check").fetchall() == []
        assert c.execute("PRAGMA foreign_keys").fetchone()[0] == 1
        with pytest.raises(sqlite3.IntegrityError):
            c.execute("INSERT INTO members (id, household_id, name, relationship, age, role, has_login) "
                      "VALUES ('m-z','hh-x','Zed','cousin',30,'adult',0)")


# ---- PATCH /members/{id}/profile: valid edits -----------------------------------------------

def test_primary_edits_anyone_and_response_is_the_member(client):
    hid, ids, hj, _ = family(client)
    r = client.patch(f"/members/{ids['maya']}/profile", headers=hj, json={
        "name": "Maya R.", "email": "maya@example.test", "phone": "(334) 555-0148", "zip": "36830",
        "notes": "Likes the blue chair."})
    assert r.status_code == 200, r.text
    m = r.json()
    assert m["id"] == ids["maya"] and m["name"] == "Maya R." and m["email"] == "maya@example.test"
    assert m["phone"] == "3345550148"                      # punctuation stripped, digits only
    assert m["zip"] == "36830" and m["notes"] == "Likes the blue chair."
    assert m["age"] == 9 and m["role"] == "managed" and m["dob"] == "2017-05-09"
    assert profile(client, hid, hj, ids["maya"])["notes"] == "Likes the blue chair."


def test_adult_edits_only_themself(client):
    hid, ids, _hj, heads = family(client)
    alex = ids["alex"]
    r = client.patch(f"/members/{alex}/profile", headers=heads["alex"], json={"email": "alex@example.test"})
    assert r.status_code == 200 and r.json()["email"] == "alex@example.test"
    for other in ("jordan", "maya", "noah"):
        r = client.patch(f"/members/{ids[other]}/profile", headers=heads["alex"], json={"notes": "x"})
        assert r.status_code == 403, other
    assert profile(client, hid, heads["jordan"], ids["noah"])["notes"] is None


def test_name_change_also_updates_the_sign_in_display_name(client, store):
    _hid, ids, hj, _ = family(client)
    client.patch(f"/members/{ids['alex']}/profile", headers=hj, json={"name": "Alexander O'Neil-Smith"})
    acct = rows(store, "SELECT display_name FROM accounts WHERE member_id = ?", (ids["alex"],))[0]
    assert acct["display_name"] == "Alexander O'Neil-Smith"


def test_clear_optional_fields_with_null_or_empty(client):
    _hid, ids, hj, _ = family(client)
    r = client.patch(f"/members/{ids['alex']}/profile", headers=hj,
                     json={"email": None, "phone": "", "zip": "  ", "notes": None})
    assert r.status_code == 200
    m = r.json()
    assert m["email"] is None and m["phone"] is None and m["zip"] is None and m["notes"] is None


def test_unsent_fields_are_left_alone(client):
    _hid, ids, hj, _ = family(client)
    r = client.patch(f"/members/{ids['alex']}/profile", headers=hj, json={"zip": "36832"})
    m = r.json()
    assert m["zip"] == "36832" and m["email"] == "alex.rivera@example.test" and m["phone"] == "3345550143"
    assert m["dob"] == "1987-07-22" and m["name"] == "Alex Rivera"


def test_phone_formats_are_normalised(client):
    _hid, ids, hj, _ = family(client)
    for raw, want in [("334.555.0142", "3345550142"), ("+1 (334) 555-0142", "13345550142"),
                      ("3345550142", "3345550142"), ("123456789012345", "123456789012345")]:
        r = client.patch(f"/members/{ids['alex']}/profile", headers=hj, json={"phone": raw})
        assert r.status_code == 200 and r.json()["phone"] == want, raw


# ---- PATCH validation: each failure ---------------------------------------------------------

@pytest.mark.parametrize("body, fragment", [
    ({}, "at least one field"),
    ({"name": None}, "name is required"),
    ({"name": ""}, "1 to 24"),
    ({"name": "   "}, "1 to 24"),
    ({"name": "A" * 25}, "1 to 24"),
    ({"name": "Alex99"}, "letters, spaces"),
    ({"name": "<b>Al</b>"}, "letters, spaces"),
    ({"name": "Al\nex"}, "letters, spaces"),
    ({"name": "..."}, "letters, spaces"),
    ({"dob": None}, "date of birth is required"),
    ({"dob": "03/14/1985"}, "year, month, day"),
    ({"dob": "1985-13-40"}, "year, month, day"),
    ({"dob": "19850314"}, "year, month, day"),
    ({"dob": "2026-11-02"}, "future"),
    ({"dob": "2030-01-01"}, "future"),
    ({"dob": "1915-11-01"}, "within the last 110 years"),
    ({"email": "not-an-email"}, "email address like"),
    ({"email": "a@b"}, "email address like"),
    ({"email": "a b@example.test"}, "email address like"),
    ({"email": "<x>@example.test"}, "email address like"),
    ({"email": "a" * 70 + "@example.test"}, "up to 80"),
    ({"phone": "12345"}, "10 to 15 digits"),
    ({"phone": "1234567890123456"}, "10 to 15 digits"),
    ({"phone": "334-555-CALL"}, "10 to 15 digits"),
    ({"zip": "3683"}, "5 digits"),
    ({"zip": "368301"}, "5 digits"),
    ({"zip": "36A30"}, "5 digits"),
    ({"notes": "x" * 201}, "up to 200"),
    ({"notes": "hi <script>"}, "< or >"),
])
def test_validation_failures_are_plain_422s(client, body, fragment):
    _hid, ids, hj, _ = family(client)
    r = client.patch(f"/members/{ids['alex']}/profile", headers=hj, json=body)
    assert r.status_code == 422, r.text
    assert isinstance(detail(r), str) and fragment in detail(r)
    assert "Traceback" not in r.text


def test_failed_edit_changes_nothing(client):
    hid, ids, hj, _ = family(client)
    before = profile(client, hid, hj, ids["alex"])
    r = client.patch(f"/members/{ids['alex']}/profile", headers=hj,
                     json={"name": "New Name", "zip": "bad"})
    assert r.status_code == 422
    assert profile(client, hid, hj, ids["alex"]) == before


def test_boundaries_accept_the_limits(client):
    _hid, ids, hj, _ = family(client)
    for body in ({"name": "A"}, {"name": "A" * 24}, {"notes": "n" * 200}, {"email": "a@b.co"},
                 {"email": "e" * 68 + "@example.co"}, {"phone": "1" * 10}, {"zip": "00000"}):
        if "email" in body and len(body["email"]) > 80:
            continue
        r = client.patch(f"/members/{ids['alex']}/profile", headers=hj, json=body)
        assert r.status_code == 200, (body, r.text)
    long_ok = "e" * 69 + "@example.co"                                  # exactly 80 characters
    assert len(long_ok) == 80
    assert client.patch(f"/members/{ids['alex']}/profile", headers=hj, json={"email": long_ok}).status_code == 200


def test_dob_age_limits_for_a_managed_child(client):
    _hid, ids, hj, _ = family(client)
    maya = f"/members/{ids['maya']}/profile"
    assert client.patch(maya, headers=hj, json={"dob": "2026-11-01"}).json()["age"] == 0   # today: newborn
    assert client.patch(maya, headers=hj, json={"dob": "2026-11-02"}).status_code == 422   # tomorrow
    r = client.patch(maya, headers=hj, json={"dob": "1916-11-01"})                         # exactly 110
    assert r.status_code == 200 and r.json()["age"] == 110
    assert client.patch(maya, headers=hj, json={"dob": "1916-10-31"}).json()["age"] == 110  # still 110
    assert client.patch(maya, headers=hj, json={"dob": "1915-11-01"}).status_code == 422   # 111


# ---- the 18 boundary ------------------------------------------------------------------------

def test_managed_child_turning_18_becomes_an_adult_without_a_login(client):
    hid, ids, hj, _ = family(client)
    maya = ids["maya"]
    r = client.patch(f"/members/{maya}/profile", headers=hj, json={"dob": "2008-11-01"})  # 18 today
    m = r.json()
    assert r.status_code == 200 and m["age"] == 18 and m["role"] == "adult" and m["has_login"] is False
    r = client.patch(f"/members/{maya}/profile", headers=hj, json={"dob": "2008-11-02"})  # 17 until tomorrow
    m = r.json()
    assert m["age"] == 17 and m["role"] == "managed"
    assert profile(client, hid, hj, maya)["role"] == "managed"


def test_adult_without_login_going_under_18_becomes_managed(client):
    hid, _ids, hj, _ = family(client)
    r = client.post(f"/households/{hid}/members", headers=hj,
                    json={"name": "Sam", "relationship": "child", "dob": "2000-01-01"})
    sam = r.json()
    assert sam["role"] == "adult" and sam["age"] == 26 and sam["has_login"] is False
    r = client.patch(f"/members/{sam['id']}/profile", headers=hj, json={"dob": "2008-11-02"})
    assert r.status_code == 200 and r.json()["role"] == "managed" and r.json()["age"] == 17
    r = client.patch(f"/members/{sam['id']}/profile", headers=hj, json={"dob": "2008-11-01"})
    assert r.json()["role"] == "adult" and r.json()["age"] == 18


def test_adult_with_a_login_cannot_become_under_18(client):
    hid, ids, hj, heads = family(client)
    for who in ("alex", "noah"):
        r = client.patch(f"/members/{ids[who]}/profile", headers=hj, json={"dob": "2012-01-01"})
        assert r.status_code == 422 and "has a login" in detail(r) and "18" in detail(r)
    assert profile(client, hid, hj, ids["noah"])["age"] == 23
    # Same when the adult edits themself.
    r = client.patch(f"/members/{ids['alex']}/profile", headers=heads["alex"], json={"dob": "2012-01-01"})
    assert r.status_code == 422


def test_primary_cannot_become_under_18(client):
    _hid, ids, hj, _ = family(client)
    r = client.patch(f"/members/{ids['jordan']}/profile", headers=hj, json={"dob": "2012-01-01"})
    assert r.status_code == 422 and "primary" in detail(r)


def test_spouse_cannot_become_under_18(client):
    hid, _ids, hj, _ = family(client)
    sp = client.post(f"/households/{hid}/members", headers=hj,
                     json={"name": "Pat", "relationship": "partner", "dob": "1990-01-01"}).json()
    r = client.patch(f"/members/{sp['id']}/profile", headers=hj, json={"dob": "2012-01-01"})
    assert r.status_code == 422 and "18 or older" in detail(r)


def test_becoming_managed_cancels_a_pending_invite(client, store):
    hid, _ids, hj, _ = family(client)
    sam = client.post(f"/households/{hid}/members", headers=hj,
                      json={"name": "Sam", "relationship": "child", "dob": "2005-01-01"}).json()
    client.post(f"/households/{hid}/invites", headers=hj, json={"email": "sam@example.test", "member_id": sam["id"]})
    client.patch(f"/members/{sam['id']}/profile", headers=hj, json={"dob": "2015-01-01"})
    inv = rows(store, "SELECT status FROM invites WHERE member_id = ?", (sam["id"],))
    assert [i["status"] for i in inv] == ["cancelled"]


def test_age_stays_in_sync_with_dob_in_the_database(client, store):
    _hid, ids, hj, _ = family(client)
    client.patch(f"/members/{ids['alex']}/profile", headers=hj, json={"dob": "1990-11-02"})  # 35 until tomorrow
    assert rows(store, "SELECT age, dob FROM members WHERE id = ?", (ids["alex"],))[0] == {
        "age": 35, "dob": "1990-11-02"}
    client.patch(f"/members/{ids['alex']}/profile", headers=hj, json={"dob": "1990-11-01"})
    assert rows(store, "SELECT age FROM members WHERE id = ?", (ids["alex"],))[0]["age"] == 36


# ---- visibility, template household, unknown ids ---------------------------------------------

def test_template_household_is_read_only(client, store):
    h = template_headers(client)
    for who in ("m-jordan", "m-maya"):
        r = client.patch(f"/members/{who}/profile", headers=h, json={"notes": "x"})
        assert r.status_code == 403 and "demo family" in detail(r)
    r = client.post(f"/households/{TEMPLATE_HH}/members", headers=h,
                    json={"name": "Sam", "relationship": "child", "dob": "2015-01-01"})
    assert r.status_code == 403
    r = client.delete(f"/households/{TEMPLATE_HH}/members/m-noah", headers=h)
    assert r.status_code == 403
    assert rows(store, "SELECT COUNT(*) AS n FROM members WHERE household_id = ?", (TEMPLATE_HH,))[0]["n"] == 4
    assert rows(store, "SELECT notes FROM members WHERE id = 'm-jordan'")[0]["notes"] is None


def test_requires_sign_in(client):
    assert client.patch("/members/m-alex/profile", json={"notes": "x"}).status_code == 401
    assert client.post("/households/hh-rivera/members", json={}).status_code == 401
    assert client.delete("/households/hh-rivera/members/m-alex").status_code == 401


def test_unknown_member_is_404_and_other_family_is_403(client):
    _hid, _ids, hj, _ = family(client)
    assert client.patch("/members/m-nobody/profile", headers=hj, json={"notes": "x"}).status_code == 404
    _hid2, ids2, _hj2, _ = family(client)
    r = client.patch(f"/members/{ids2['alex']}/profile", headers=hj, json={"notes": "x"})
    assert r.status_code == 403


# ---- POST /households/{id}/members ------------------------------------------------------------

def test_add_a_child_and_an_adult(client, store):
    hid, _ids, hj, _ = family(client)
    r = client.post(f"/households/{hid}/members", headers=hj, json={
        "name": "Lily", "relationship": "child", "dob": "2020-02-29", "email": "lily@example.test",
        "phone": "334-555-0150", "zip": "36830"})
    assert r.status_code == 201, r.text
    lily = r.json()
    assert re.fullmatch(r"m-[0-9a-f]{6}\.[0-9a-f]{6}", lily["id"])
    assert lily["household_id"] == hid and lily["role"] == "managed" and lily["age"] == 6
    assert lily["has_login"] is False and lily["status"] == "active" and lily["relationship"] == "child"
    assert lily["dob"] == "2020-02-29" and lily["phone"] == "3345550150" and lily["notes"] is None
    r = client.post(f"/households/{hid}/members", headers=hj,
                    json={"name": "Pat Lee", "relationship": "spouse", "dob": "1990-05-05"})
    pat = r.json()
    assert pat["role"] == "adult" and pat["has_login"] is False and pat["age"] == 36
    assert pat["email"] is None and pat["zip"] is None
    # Visible to the primary, zero usage, listed in the household.
    members = client.get(f"/households/{hid}", headers=hj).json()["members"]
    assert len(members) == 6 and members[-1]["id"] == pat["id"]
    ov = client.get(f"/members/{lily['id']}/overview", headers=hj).json()
    assert ov["usage"]["max_used"] == 0 and ov["usage"]["visits"] == 0
    assert ov["benefits"]["max_remaining"] == 1500          # a fresh maximum of their own
    assert rows(store, "SELECT COUNT(*) AS n FROM member_usage WHERE member_id = ?", (lily["id"],))[0]["n"] == 1


@pytest.mark.parametrize("relationship", ["spouse", "partner", "child", "other"])
def test_each_relationship_is_accepted(client, relationship):
    hid, _ids, hj, _ = family(client)
    r = client.post(f"/households/{hid}/members", headers=hj,
                    json={"name": "Robin", "relationship": relationship, "dob": "1980-01-01"})
    assert r.status_code == 201 and r.json()["relationship"] == relationship


def test_add_member_validation(client):
    hid, _ids, hj, _ = family(client)
    ok = {"name": "Robin", "relationship": "child", "dob": "2015-01-01"}
    url = f"/households/{hid}/members"
    bad = [({**ok, "name": "R2D2"}, "letters"), ({**ok, "name": ""}, "1 to 24"),
           ({**ok, "dob": "yesterday"}, "year, month, day"), ({**ok, "dob": "2027-01-01"}, "future"),
           ({**ok, "dob": "1900-01-01"}, "110 years"), ({**ok, "email": "nope"}, "email address"),
           ({**ok, "phone": "1"}, "10 to 15"), ({**ok, "zip": "1"}, "5 digits"),
           ({**ok, "relationship": "spouse", "dob": "2015-01-01"}, "18 or older"),
           ({**ok, "relationship": "partner", "dob": "2008-11-02"}, "18 or older")]
    for body, fragment in bad:
        r = client.post(url, headers=hj, json=body)
        assert r.status_code == 422 and fragment in detail(r), (body, r.text)
    # Pydantic-level problems: unknown relationship, missing fields.
    assert client.post(url, headers=hj, json={**ok, "relationship": "self"}).status_code == 422
    assert client.post(url, headers=hj, json={"name": "Robin"}).status_code == 422
    assert client.post(url, headers=hj, json={**ok, "relationship": "spouse", "dob": "2008-11-01"}).status_code == 201


def test_add_member_is_primary_only(client):
    hid, _ids, _hj, heads = family(client)
    r = client.post(f"/households/{hid}/members", headers=heads["alex"],
                    json={"name": "Sam", "relationship": "child", "dob": "2015-01-01"})
    assert r.status_code == 403
    _hid2, _i2, hj2, _ = family(client)
    r = client.post(f"/households/{hid}/members", headers=hj2,
                    json={"name": "Sam", "relationship": "child", "dob": "2015-01-01"})
    assert r.status_code == 403


def test_family_is_capped_at_eight_people(client):
    hid, _ids, hj, _ = family(client)
    for i in range(4):
        r = client.post(f"/households/{hid}/members", headers=hj,
                        json={"name": f"Kid {'abcd'[i]}", "relationship": "child", "dob": "2015-01-01"})
        assert r.status_code == 201
    assert len(client.get(f"/households/{hid}", headers=hj).json()["members"]) == 8
    r = client.post(f"/households/{hid}/members", headers=hj,
                    json={"name": "Extra", "relationship": "child", "dob": "2015-01-01"})
    assert r.status_code == 422 and "up to 8" in detail(r)
    # Removing one makes room again.
    victim = client.get(f"/households/{hid}", headers=hj).json()["members"][-1]["id"]
    assert client.delete(f"/households/{hid}/members/{victim}", headers=hj).status_code == 200
    r = client.post(f"/households/{hid}/members", headers=hj,
                    json={"name": "Extra", "relationship": "child", "dob": "2015-01-01"})
    assert r.status_code == 201


# ---- DELETE /households/{id}/members/{member_id} ---------------------------------------------

def member_row_counts(store, mid):
    q = {
        "members": ("SELECT COUNT(*) AS n FROM members WHERE id = ?", (mid,)),
        "member_usage": ("SELECT COUNT(*) AS n FROM member_usage WHERE member_id = ?", (mid,)),
        "visits": ("SELECT COUNT(*) AS n FROM visits WHERE member_id = ?", (mid,)),
        "appointments": ("SELECT COUNT(*) AS n FROM appointments WHERE member_id = ?", (mid,)),
        "member_preferences": ("SELECT COUNT(*) AS n FROM member_preferences WHERE member_id = ?", (mid,)),
        "member_context": ("SELECT COUNT(*) AS n FROM member_context WHERE member_id = ?", (mid,)),
        "chat_memory": ("SELECT COUNT(*) AS n FROM chat_memory WHERE member_id = ?", (mid,)),
        "saved_plans": ("SELECT COUNT(*) AS n FROM saved_plans WHERE member_id = ?", (mid,)),
        "saved_simulations": ("SELECT COUNT(*) AS n FROM saved_simulations WHERE member_id = ?", (mid,)),
        "accounts": ("SELECT COUNT(*) AS n FROM accounts WHERE member_id = ?", (mid,)),
        "invites": ("SELECT COUNT(*) AS n FROM invites WHERE member_id = ? OR invited_by = ?", (mid, mid)),
    }
    return {t: rows(store, sql, args)[0]["n"] for t, (sql, args) in q.items()}


def test_delete_removes_every_dependent_row_and_leaves_no_orphans(client, store):
    hid, ids, hj, heads = family(client)
    alex = ids["alex"]
    # Give Alex a row in every dependent table.
    store.append_member_context(alex, alex, "chat", "hello", role="user")
    store.create_saved_simulation(alex, alex, "Compare", {"a": 1}, {"b": 2})
    with connect(store.path) as c:   # an invite that mentions Alex, and one he sent
        c.execute("INSERT INTO invites (id, household_id, invited_by, member_id, email, token, status, created_at) "
                  "VALUES ('inv-a', ?, ?, ?, 'x@example.test', 'tok-a', 'pending', '2026-11-01')",
                  (hid, ids["jordan"], alex))
        c.execute("INSERT INTO invites (id, household_id, invited_by, member_id, email, token, status, created_at) "
                  "VALUES ('inv-b', ?, ?, NULL, 'y@example.test', 'tok-b', 'pending', '2026-11-01')",
                  (hid, alex))
        c.commit()
    before = member_row_counts(store, alex)
    assert all(n >= 1 for n in before.values()), before
    # Another person's rows must survive.
    def others_now():   # (the invite Jordan sent to Alex is Alex's, so invites are not compared)
        return {k: {t: n for t, n in member_row_counts(store, ids[k]).items() if t != "invites"}
                for k in ("jordan", "maya", "noah")}
    others = others_now()
    r = client.delete(f"/households/{hid}/members/{alex}", headers=hj)
    assert r.status_code == 200 and r.json() == {"ok": True, "member_id": alex}
    assert all(n == 0 for n in member_row_counts(store, alex).values())
    assert others_now() == others
    # No orphan rows anywhere, and the foreign key check passes.
    with connect(store.path) as c:
        assert c.execute("PRAGMA foreign_key_check").fetchall() == []
    members = client.get(f"/households/{hid}", headers=hj).json()["members"]
    assert alex not in [m["id"] for m in members] and len(members) == 3
    assert client.get(f"/members/{alex}/overview", headers=hj).status_code == 404
    # Their old session no longer works.
    assert client.get(f"/members/{alex}/overview", headers=heads["alex"]).status_code == 404


def test_delete_a_managed_child_and_a_just_added_member(client, store):
    hid, ids, hj, _ = family(client)
    assert client.delete(f"/households/{hid}/members/{ids['maya']}", headers=hj).status_code == 200
    assert all(n == 0 for n in member_row_counts(store, ids["maya"]).values())
    new = client.post(f"/households/{hid}/members", headers=hj,
                      json={"name": "Sam", "relationship": "child", "dob": "2015-01-01"}).json()
    assert client.delete(f"/households/{hid}/members/{new['id']}", headers=hj).status_code == 200
    assert all(n == 0 for n in member_row_counts(store, new["id"]).values())
    with connect(store.path) as c:
        assert c.execute("PRAGMA foreign_key_check").fetchall() == []


def test_delete_rules(client):
    hid, ids, hj, heads = family(client)
    r = client.delete(f"/households/{hid}/members/{ids['jordan']}", headers=hj)
    assert r.status_code == 422 and "primary" in detail(r)
    assert client.delete(f"/households/{hid}/members/m-nobody", headers=hj).status_code == 404
    assert client.delete(f"/households/{hid}/members/{ids['maya']}", headers=heads["alex"]).status_code == 403
    _h2, ids2, hj2, _ = family(client)
    assert client.delete(f"/households/{hid}/members/{ids2['maya']}", headers=hj).status_code == 404  # not in this family
    assert client.delete(f"/households/{hid}/members/{ids['maya']}", headers=hj2).status_code == 403  # not your family


# ---- sandbox isolation and reset ----------------------------------------------------------------

def test_editing_one_sandbox_does_not_touch_another(client, store):
    hid1, ids1, hj1, _ = family(client)
    hid2, ids2, hj2, _ = family(client)
    before = profile(client, hid2, hj2, ids2["alex"])
    client.patch(f"/members/{ids1['alex']}/profile", headers=hj1,
                 json={"name": "Changed", "email": "c@example.test", "dob": "1970-01-01", "notes": "n"})
    client.post(f"/households/{hid1}/members", headers=hj1,
                json={"name": "Sam", "relationship": "child", "dob": "2015-01-01"})
    client.delete(f"/households/{hid1}/members/{ids1['maya']}", headers=hj1)
    assert profile(client, hid2, hj2, ids2["alex"]) == before
    assert len(client.get(f"/households/{hid2}", headers=hj2).json()["members"]) == 4
    # The shared template and the seed are untouched too.
    tm = client.get(f"/households/{TEMPLATE_HH}", headers=template_headers(client)).json()["members"]
    assert [m["name"] for m in tm] == ["Jordan Rivera", "Alex Rivera", "Maya Rivera", "Noah Rivera"]
    assert tm[1]["dob"] == "1987-07-22" and tm[1]["notes"] is None


def test_reset_restores_the_seed_profile_values_and_the_family(client):
    hid, ids, hj, _ = family(client)
    seed = {m["id"]: m for m in load_seed_file()["members"]}
    client.patch(f"/members/{ids['alex']}/profile", headers=hj, json={
        "name": "Zed", "dob": "1970-01-01", "email": "z@example.test", "phone": "9995550101",
        "zip": "30301", "notes": "changed"})
    client.patch(f"/members/{ids['maya']}/profile", headers=hj, json={"dob": "2008-11-01"})   # now an adult
    added = client.post(f"/households/{hid}/members", headers=hj,
                        json={"name": "Sam", "relationship": "other", "dob": "2015-01-01"}).json()
    client.delete(f"/households/{hid}/members/{ids['noah']}", headers=hj)
    assert client.post("/demo/reset", headers=hj).status_code == 200
    members = {m["id"]: m for m in client.get(f"/households/{hid}", headers=hj).json()["members"]}
    assert set(members) == set(ids.values()) and added["id"] not in members
    for base, mid in (("m-jordan", ids["jordan"]), ("m-alex", ids["alex"]), ("m-maya", ids["maya"]),
                      ("m-noah", ids["noah"])):
        m, s = members[mid], seed[base]
        assert (m["name"], m["age"], m["dob"], m["email"], m["phone"], m["zip"], m["notes"], m["role"]) == (
            s["name"], s["age"], s["dob"], s.get("email"), s.get("phone"), s.get("zip"), None, s["role"])


# ---- golden numbers and contact privacy --------------------------------------------------------

def test_golden_numbers_for_alex_still_hold(client):
    """Alex has $1,100 of $1,500 used: $400 left, a crown costs him $800 (G3). Profile edits and
    a family change do not move the numbers."""
    hid, ids, hj, heads = family(client)
    client.patch(f"/members/{ids['alex']}/profile", headers=hj, json={"dob": "1980-01-01", "zip": "30301"})
    client.post(f"/households/{hid}/members", headers=hj,
                json={"name": "Sam", "relationship": "child", "dob": "2015-01-01"})
    ov = client.get(f"/members/{ids['alex']}/overview", headers=heads["alex"]).json()
    assert ov["benefits"]["max_remaining"] == 400 and ov["usage"]["max_used"] == 1100
    assert ov["member"]["age"] == 46 and ov["member"]["dob"] == "1980-01-01"
    est = client.post("/estimate", json={"code": "D2740", "plan_id": "preferred",
                                         "usage": {"max_used": 1100, "deductible_met": 0, "history": []}}).json()
    assert est["in_network"]["you_pay"] == 800


class FakeProvider:
    name = "anthropic"
    supports_documents = False

    def __init__(self, script):
        self.script, self.calls = list(script), []

    def is_available(self):
        return True

    def complete(self, system, turns, tools):
        self.calls.append({"system": system, "turns": json.loads(json.dumps(turns)), "tools": tools})
        return self.script.pop(0)


def test_contact_details_never_reach_the_model(client, store):
    _hid, ids, hj, _ = family(client)
    secret = {"email": "secret.mail@example.test", "phone": "3345550199", "zip": "36849",
              "notes": "Private note about the family"}
    alex = ids["alex"]
    client.patch(f"/members/{alex}/profile", headers=hj, json={**secret, "dob": "1987-07-22"})
    client.patch(f"/members/{ids['maya']}/profile", headers=hj,
                 json={"email": "maya.private@example.test", "phone": "3345550198"})
    needles = ["secret.mail@example.test", "3345550199", "334-555-0199", "(334) 555-0199", "36849",
               "Private note about the family", "maya.private@example.test", "3345550198",
               "alex.rivera@example.test", "1987-07-22", "example.test"]

    # The context object, its prompt text and the "what the assistant knows" panel.
    mc = build_member_context(store, ids["jordan"], alex)
    blob = mc.to_prompt() + mc.facts_text() + mc.guard_text() + json.dumps(mc.public_view())
    for n in needles:
        assert n not in blob, n

    # A full chat turn: system prompt, tool results and the streamed answer.
    fake = FakeProvider([
        Reply(tool_calls=[ToolCall("1", "get_household_coverage", {})]),
        Reply(tool_calls=[ToolCall("2", "get_member_eligibility", {})]),
        Reply(text="Alex is covered. This is an estimate, not a guarantee."),
    ])
    chat = FastAPI()
    chat.include_router(chat_router.router)
    chat.dependency_overrides[get_store] = lambda: store
    chat.dependency_overrides[chat_router.get_provider] = lambda: fake
    r = TestClient(chat).post("/chat", headers=hj, json={
        "messages": [{"role": "user", "content": "Who is covered and what do you know about Alex?"}],
        "member_id": alex})
    assert r.status_code == 200
    everything = json.dumps(fake.calls) + r.text
    assert "Alex Rivera" in everything and "get_household_coverage" in everything
    for n in needles:
        assert n not in everything, n
    # And the stored chat memory.
    assert all(n not in json.dumps(store.get_member_context(alex, alex)) for n in needles)
