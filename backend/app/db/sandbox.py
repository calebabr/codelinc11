"""Demo sandboxes: a private copy of the template household for each visitor.

The template is the household in the seed file (`database/seeds/demo_household.json`). A sandbox
is new rows with every id suffixed `.<sid>`, listed in the `sandboxes` table. New sids are 16
lowercase hex characters (64 random bits, so a family id cannot be guessed); sandboxes made
before that have 6 and keep working until they expire. Cleanup (expiry by DEMO_SANDBOX_TTL_HOURS,
then the cap DEMO_MAX_SANDBOXES, oldest first) deletes every dependent row. It runs whenever a
sandbox is created, at startup (core.migrate) and at most every 10 minutes on any sandbox lookup.

Rows are copied from the seed file, not from the live template, so a sandbox always starts
from the original numbers and `restore` can reset it in place (same ids, tokens stay valid).
"""
from __future__ import annotations

import os
import re
import secrets
import sqlite3
import threading
import time
from collections.abc import Callable
from datetime import datetime, timedelta, timezone
from typing import Any

from .core import load_seed_file, session

SID_RE = re.compile(r"^(?:[0-9a-f]{16}|[0-9a-f]{6})$")   # new ids: 16; ids made earlier: 6
SID_BYTES = 8                                             # secrets.token_hex(8) = 16 hex characters
CLEANUP_INTERVAL_SECONDS = 600.0
DEFAULT_TTL_HOURS = 24.0
DEFAULT_MAX_SANDBOXES = 300

# Tables copied from the seed (plan_tiers is shared). Insert order respects foreign keys.
CLONE_TABLES = ["households", "members", "accounts", "member_usage", "visits", "appointments",
                "member_context", "member_preferences", "saved_plans", "saved_simulations",
                "notification_prefs", "report_items"]
# Child tables keyed by member_id, deleted before the members (chat_memory is never copied: it starts empty).
MEMBER_CHILD_TABLES = ["report_items", "outbox", "notifications", "notification_prefs", "chat_memory", "member_preferences", "member_context", "saved_simulations",
                       "saved_plans", "appointments", "visits", "member_usage"]


# Called with the member ids of every household whose rows are deleted or reset, so in-memory
# data keyed by member (for example chat attachments) can be dropped with them.
_delete_hooks: list[Callable[[list[str]], None]] = []
_cleanup_lock = threading.Lock()
_last_cleanup: float | None = None


def on_members_removed(hook: Callable[[list[str]], None]) -> None:
    if hook not in _delete_hooks:
        _delete_hooks.append(hook)


def _utcnow() -> datetime:
    """Current UTC time (tests replace this to check expiry)."""
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat(timespec="seconds")


def ttl_hours() -> float:
    try:
        return max(0.0, float(os.environ.get("DEMO_SANDBOX_TTL_HOURS", DEFAULT_TTL_HOURS)))
    except ValueError:
        return DEFAULT_TTL_HOURS


def max_sandboxes() -> int:
    try:
        return max(1, int(os.environ.get("DEMO_MAX_SANDBOXES", DEFAULT_MAX_SANDBOXES)))
    except ValueError:
        return DEFAULT_MAX_SANDBOXES


def template_household_ids() -> list[str]:
    return [h["id"] for h in load_seed_file()["households"]]


def split_id(some_id: str) -> tuple[str, str | None]:
    """e.g. ('m-alex', '3f9a1c') for 'm-alex.3f9a1c'; ('m-alex', None) for a plain template id."""
    base, dot, sid = some_id.rpartition(".")
    if dot and SID_RE.match(sid):
        return base, sid
    return some_id, None


def member_in_sandbox(member_id: str, household_id: str) -> str | None:
    """Map (e.g.) a template id ('m-alex') or an already suffixed id to the sandbox's own id."""
    _, sid = split_id(household_id)
    if sid is None:
        return None
    base, own = split_id(member_id)
    if own is not None and own != sid:
        return None
    return f"{base}.{sid}"


def _suffix(table: str, row: dict[str, Any], sid: str | None, fresh: str) -> dict[str, Any]:
    row = dict(row)
    if table == "visits":
        row["plan_year"] = int(row["visit_date"][:4])
    if table in ("saved_plans", "saved_simulations"):
        row["created_at"] = row["updated_at"] = fresh
    if table == "report_items":
        row["created_at"] = fresh
    if sid is None:
        return row
    s = "." + sid
    if table == "households":
        row["id"] += s
    elif table == "members":
        row["id"] += s
        row["household_id"] += s
    elif table == "accounts":
        local, _, domain = row["email"].partition("@")
        row["id"] += s
        row["member_id"] += s
        row["email"] = f"{local}{s}@{domain}"
    elif table in ("saved_plans", "saved_simulations", "report_items"):
        row["id"] += s
        row["member_id"] += s
    else:  # member_usage, visits, appointments, member_context, member_preferences
        row["member_id"] += s
    return row


def _insert_rows(conn: sqlite3.Connection, data: dict, template_hh: str, sid: str | None,
                 with_household: bool) -> None:
    fresh = _iso(_utcnow())
    own_members = {m["id"] for m in data["members"] if m["household_id"] == template_hh}
    for table in CLONE_TABLES:
        if table == "households" and not with_household:
            continue
        for src in data.get(table, []):
            if table == "households" and src["id"] != template_hh:
                continue
            if table == "members" and src["id"] not in own_members:
                continue
            if table not in ("households", "members") and src.get("member_id") not in own_members:
                continue
            row = _suffix(table, src, sid, fresh)
            if table == "households":
                row["plan_tier_id"] = "preferred"
            cols = ", ".join(row)
            marks = ", ".join("?" for _ in row)
            conn.execute(f"INSERT INTO {table} ({cols}) VALUES ({marks})", list(row.values()))


def _delete_household_rows(conn: sqlite3.Connection, household_id: str, keep_household: bool) -> None:
    ids = [r[0] for r in conn.execute("SELECT id FROM members WHERE household_id = ?", (household_id,))]
    marks = ",".join("?" for _ in ids) or "NULL"
    for hook in _delete_hooks:
        hook(ids)
    conn.execute("DELETE FROM invites WHERE household_id = ?", (household_id,))
    for table in MEMBER_CHILD_TABLES:
        conn.execute(f"DELETE FROM {table} WHERE member_id IN ({marks})", ids)
    conn.execute(f"DELETE FROM invites WHERE member_id IN ({marks}) OR invited_by IN ({marks})", ids + ids)
    conn.execute(f"DELETE FROM accounts WHERE member_id IN ({marks})", ids)
    conn.execute("DELETE FROM members WHERE household_id = ?", (household_id,))
    if not keep_household:
        conn.execute("DELETE FROM sandboxes WHERE household_id = ?", (household_id,))
        conn.execute("DELETE FROM households WHERE id = ?", (household_id,))


def delete_member_rows(conn: sqlite3.Connection, member_id: str) -> None:
    """Delete one member and every dependent row (usage, visits, appointments, preferences, context,
    chat memory, saved plans and comparisons, reports, account, invites)."""
    for hook in _delete_hooks:
        hook([member_id])
    for table in MEMBER_CHILD_TABLES:
        conn.execute(f"DELETE FROM {table} WHERE member_id = ?", (member_id,))
    conn.execute("DELETE FROM invites WHERE member_id = ? OR invited_by = ?", (member_id, member_id))
    conn.execute("DELETE FROM accounts WHERE member_id = ?", (member_id,))
    conn.execute("DELETE FROM members WHERE id = ?", (member_id,))


def info(row: sqlite3.Row | dict) -> dict[str, Any]:
    created = datetime.fromisoformat(row["created_at"])
    return {"household_id": row["household_id"],
            "expires_at": _iso(created + timedelta(hours=ttl_hours()))}


def cleanup(conn: sqlite3.Connection, reserve: int = 0) -> int:
    """Delete expired sandboxes first, then (only if the total still exceeds the cap) the oldest
    until at most (cap - reserve) remain. Families inside the cap are never evicted.
    Returns how many were deleted."""
    cutoff = _iso(_utcnow() - timedelta(hours=ttl_hours()))
    doomed = [r[0] for r in conn.execute(
        "SELECT household_id FROM sandboxes WHERE created_at <= ?", (cutoff,))]
    remaining = conn.execute("SELECT COUNT(*) FROM sandboxes").fetchone()[0] - len(doomed)
    surplus = remaining - (max_sandboxes() - reserve)
    if surplus > 0:
        doomed += [r[0] for r in conn.execute(
            "SELECT household_id FROM sandboxes WHERE created_at > ? ORDER BY created_at, rowid LIMIT ?",
            (cutoff, surplus))]
    for hid in doomed:
        _delete_household_rows(conn, hid, keep_household=False)
    return len(doomed)


def cleanup_expired(path, force: bool = False) -> int:
    """Delete expired sandboxes (and trim to the cap) at most once every CLEANUP_INTERVAL_SECONDS
    per process; `force` ignores the interval (startup). Returns how many were deleted."""
    global _last_cleanup
    with _cleanup_lock:
        now = time.monotonic()
        if not force and _last_cleanup is not None and now - _last_cleanup < CLEANUP_INTERVAL_SECONDS:
            return 0
        _last_cleanup = now
    try:
        with session(path) as conn:
            have = conn.execute("SELECT 1 FROM sqlite_master WHERE name = 'sandboxes'").fetchone()
            return cleanup(conn) if have else 0
    except sqlite3.Error:
        return 0   # housekeeping must never break a sign-in or a start-up


def create(path, template_hh: str | None = None) -> dict[str, Any]:
    """Clone the template household into a new sandbox. Returns {household_id, expires_at}."""
    data = load_seed_file()
    template_hh = template_hh or data["households"][0]["id"]
    with session(path) as conn:
        cleanup(conn, reserve=1)
        while True:
            sid = secrets.token_hex(SID_BYTES)
            if not conn.execute("SELECT 1 FROM sandboxes WHERE sid = ?", (sid,)).fetchone():
                break
        _insert_rows(conn, data, template_hh, sid, with_household=True)
        hid = f"{template_hh}.{sid}"
        conn.execute("INSERT INTO sandboxes (household_id, sid, created_at) VALUES (?,?,?)",
                     (hid, sid, _iso(_utcnow())))
        return info(conn.execute("SELECT * FROM sandboxes WHERE household_id = ?", (hid,)).fetchone())


def get(path, household_id: str) -> dict[str, Any] | None:
    """The sandbox info if it exists and has not expired, else None. (An unknown id and an expired
    one are the same answer.)"""
    cleanup_expired(path)
    with session(path) as conn:
        row = conn.execute("SELECT * FROM sandboxes WHERE household_id = ?", (household_id,)).fetchone()
    if row is None:
        return None
    meta = info(row)
    if datetime.fromisoformat(meta["expires_at"]) <= _utcnow():
        return None
    return meta


def is_sandbox(conn: sqlite3.Connection, household_id: str) -> bool:
    return conn.execute("SELECT 1 FROM sandboxes WHERE household_id = ?", (household_id,)).fetchone() is not None


def restore(conn: sqlite3.Connection, household_id: str) -> None:
    """Put a household back to the template state in place (same ids). Chat memory is cleared."""
    data = load_seed_file()
    base, sid = split_id(household_id)
    if base not in template_household_ids():
        raise ValueError("not a demo household")
    _delete_household_rows(conn, household_id, keep_household=True)
    conn.execute("UPDATE households SET plan_tier_id = 'preferred', name = ? WHERE id = ?",
                 (next(h["name"] for h in data["households"] if h["id"] == base), household_id))
    _insert_rows(conn, data, base, sid, with_household=False)
