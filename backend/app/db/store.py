"""Access layer for households, members, usage, history, schedule and context.

Every read and write takes a `viewer_id` (the signed-in member). Visibility:
- the primary account holder can see everyone in their household;
- an adult with a login sees only their own data;
- a managed member has no login and so no viewer rights.
Anything else raises AccessDenied. Context is always filtered by member_id,
so one person's context can never come back under another person's id.
"""

from __future__ import annotations

import json
import secrets
import sqlite3
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

from .core import db_path, load_seed_file, migrate, session

DEMO_TODAY = date.fromisoformat(load_seed_file()["demo_today"])
CLEANING_CODES = {"D1110", "D1120"}


class AccessDenied(Exception):
    """The viewer may not see or change this member's data."""


class NotFound(Exception):
    pass


def _row(r: sqlite3.Row | None) -> dict[str, Any] | None:
    return dict(r) if r is not None else None


class Store:
    def __init__(self, path: str | Path | None = None) -> None:
        self.path = Path(path) if path else db_path()
        migrate(self.path)

    # ---- access rules -------------------------------------------------
    def _viewer(self, conn: sqlite3.Connection, viewer_id: str) -> dict[str, Any]:
        v = _row(conn.execute("SELECT * FROM members WHERE id = ?", (viewer_id,)).fetchone())
        if v is None:
            raise NotFound(f"member {viewer_id}")
        if not v["has_login"]:
            raise AccessDenied("this member has no login")
        return v

    def _target(self, conn: sqlite3.Connection, viewer_id: str, member_id: str) -> dict[str, Any]:
        viewer = self._viewer(conn, viewer_id)
        target = _row(conn.execute("SELECT * FROM members WHERE id = ?", (member_id,)).fetchone())
        if target is None:
            raise NotFound(f"member {member_id}")
        same_house = target["household_id"] == viewer["household_id"]
        if viewer["role"] == "primary" and same_house:
            return target
        if viewer["id"] == target["id"]:
            return target
        raise AccessDenied("you can only see your own information")

    def can_access(self, viewer_id: str, member_id: str) -> bool:
        try:
            with session(self.path) as conn:
                self._target(conn, viewer_id, member_id)
            return True
        except (AccessDenied, NotFound):
            return False

    # ---- demo accounts and households ----------------------------------
    def list_demo_accounts(self) -> list[dict[str, Any]]:
        """Accounts for the demo sign-in screen (no viewer needed)."""
        with session(self.path) as conn:
            rows = conn.execute(
                "SELECT a.id AS account_id, a.email, a.display_name, m.id AS member_id, "
                "m.role, m.household_id FROM accounts a JOIN members m ON m.id = a.member_id "
                "ORDER BY m.household_id, CASE m.role WHEN 'primary' THEN 0 ELSE 1 END, m.name"
            ).fetchall()
        return [dict(r) for r in rows]

    def get_account_member(self, account_id: str) -> dict[str, Any]:
        """Resolve a demo account to its member (used by demo-login)."""
        with session(self.path) as conn:
            r = conn.execute(
                "SELECT m.* FROM members m JOIN accounts a ON a.member_id = m.id WHERE a.id = ?",
                (account_id,),
            ).fetchone()
        if r is None:
            raise NotFound(f"account {account_id}")
        return dict(r)

    def get_household(self, viewer_id: str, household_id: str) -> dict[str, Any]:
        """The household and the members this viewer may see."""
        with session(self.path) as conn:
            viewer = self._viewer(conn, viewer_id)
            if viewer["household_id"] != household_id:
                raise AccessDenied("not your household")
            hh = _row(
                conn.execute(
                    "SELECT h.id AS hid, h.name AS hname, t.id AS tid, t.name AS tname, t.monthly_cents, "
                    "t.annual_max_cents, t.deductible_cents, t.preventive_pct, t.basic_pct, t.major_pct, "
                    "t.ortho_pct FROM households h JOIN plan_tiers t ON t.id = h.plan_tier_id "
                    "WHERE h.id = ?",
                    (household_id,),
                ).fetchone()
            )
            if hh is None:
                raise NotFound(f"household {household_id}")
            if viewer["role"] == "primary":
                members = conn.execute(
                    "SELECT * FROM members WHERE household_id = ? ORDER BY rowid", (household_id,)
                ).fetchall()
            else:
                members = [viewer]
            household = {"id": hh["hid"], "name": hh["hname"], "plan_tier": _tier(hh)}
            household["members"] = [dict(m) for m in members]
        return household

    def set_household_plan(self, viewer_id: str, household_id: str, tier_id: str) -> dict[str, Any]:
        """Primary only: switch the household's plan tier. Returns the updated household."""
        with session(self.path) as conn:
            viewer = self._viewer(conn, viewer_id)
            if viewer["household_id"] != household_id or viewer["role"] != "primary":
                raise AccessDenied("only the primary account holder can change the plan")
            if conn.execute("SELECT 1 FROM plan_tiers WHERE id = ?", (tier_id,)).fetchone() is None:
                raise NotFound(f"plan tier {tier_id}")
            conn.execute("UPDATE households SET plan_tier_id = ? WHERE id = ?", (tier_id, household_id))
        return self.get_household(viewer_id, household_id)

    def get_member(self, viewer_id: str, member_id: str) -> dict[str, Any]:
        with session(self.path) as conn:
            return self._target(conn, viewer_id, member_id)

    # ---- usage and visits ----------------------------------------------
    def get_member_usage(self, viewer_id: str, member_id: str, plan_year: int | None = None) -> dict[str, Any]:
        """Usage for one person in one plan year (defaults to the demo year). Zeros if none."""
        year = plan_year or DEMO_TODAY.year
        with session(self.path) as conn:
            self._target(conn, viewer_id, member_id)
            return _usage(conn, member_id, year)

    def record_visit(
        self,
        viewer_id: str,
        member_id: str,
        visit_date: str,
        description: str,
        billed_cents: int,
        plan_paid_cents: int,
        patient_paid_cents: int,
        procedure_code: str | None = None,
        deductible_applied_cents: int = 0,
    ) -> dict[str, Any]:
        """Add a visit and update only this person's usage for that plan year."""
        if min(billed_cents, plan_paid_cents, patient_paid_cents, deductible_applied_cents) < 0:
            raise ValueError("amounts must be zero or more (integer cents)")
        year = date.fromisoformat(visit_date).year
        with session(self.path) as conn:
            self._target(conn, viewer_id, member_id)
            conn.execute(
                "INSERT INTO visits (member_id, plan_year, visit_date, procedure_code, description, "
                "billed_cents, plan_paid_cents, patient_paid_cents) VALUES (?,?,?,?,?,?,?,?)",
                (member_id, year, visit_date, procedure_code, description,
                 billed_cents, plan_paid_cents, patient_paid_cents),
            )
            cleaning = 1 if procedure_code in CLEANING_CODES else 0
            conn.execute(
                "INSERT INTO member_usage (member_id, plan_year, max_used_cents, deductible_met_cents, "
                "visits, cleanings_used) VALUES (?,?,?,?,1,?) "
                "ON CONFLICT(member_id, plan_year) DO UPDATE SET "
                "max_used_cents = max_used_cents + excluded.max_used_cents, "
                "deductible_met_cents = deductible_met_cents + excluded.deductible_met_cents, "
                "visits = visits + 1, cleanings_used = cleanings_used + excluded.cleanings_used",
                (member_id, year, plan_paid_cents, deductible_applied_cents, cleaning),
            )
            return _usage(conn, member_id, year)

    def list_visits(self, viewer_id: str, member_id: str) -> list[dict[str, Any]]:
        with session(self.path) as conn:
            self._target(conn, viewer_id, member_id)
            rows = conn.execute(
                "SELECT * FROM visits WHERE member_id = ? ORDER BY visit_date, id", (member_id,)
            ).fetchall()
        return [dict(r) for r in rows]

    # ---- context -------------------------------------------------------
    def get_member_context(self, viewer_id: str, member_id: str, chat_limit: int = 20) -> dict[str, Any]:
        """Everything the assistant may use for this one person."""
        with session(self.path) as conn:
            member = self._target(conn, viewer_id, member_id)
            ctx = conn.execute(
                "SELECT plan_highlights FROM member_context WHERE member_id = ?", (member_id,)
            ).fetchone()
            prefs = conn.execute(
                "SELECT kind, text FROM member_preferences WHERE member_id = ? ORDER BY id", (member_id,)
            ).fetchall()
            chat = conn.execute(
                "SELECT role, content, created_at FROM chat_memory WHERE member_id = ? "
                "ORDER BY id DESC LIMIT ?",
                (member_id, chat_limit),
            ).fetchall()
            history = conn.execute(
                "SELECT visit_date, procedure_code, description, billed_cents, plan_paid_cents, "
                "patient_paid_cents FROM visits WHERE member_id = ? ORDER BY visit_date, id",
                (member_id,),
            ).fetchall()
            usage = _usage(conn, member_id, DEMO_TODAY.year)
        return {
            "member_id": member_id,
            "name": member["name"],
            "plan_highlights": ctx["plan_highlights"] if ctx else "",
            "usage": usage,
            "history": [dict(r) for r in history],
            "preferences": [r["text"] for r in prefs if r["kind"] == "preference"],
            "must_haves": [r["text"] for r in prefs if r["kind"] == "must_have"],
            "chat_memory": [dict(r) for r in reversed(chat)],
        }

    def append_member_context(
        self, viewer_id: str, member_id: str, kind: str, text: str, role: str | None = None
    ) -> None:
        """Append to one person's context.

        kind: "preference" | "must_have" | "chat" (chat needs role "user" or "assistant").
        """
        if not text.strip():
            raise ValueError("text is empty")
        with session(self.path) as conn:
            self._target(conn, viewer_id, member_id)
            if kind in ("preference", "must_have"):
                conn.execute(
                    "INSERT INTO member_preferences (member_id, kind, text) VALUES (?,?,?)",
                    (member_id, kind, text),
                )
            elif kind == "chat":
                if role not in ("user", "assistant"):
                    raise ValueError("chat needs role 'user' or 'assistant'")
                conn.execute(
                    "INSERT INTO chat_memory (member_id, role, content, created_at) VALUES (?,?,?,?)",
                    (member_id, role, text, datetime.now(timezone.utc).isoformat()),
                )
            else:
                raise ValueError(f"unknown context kind {kind!r}")

    # ---- schedule ------------------------------------------------------
    def list_upcoming_schedule(
        self, viewer_id: str, member_id: str | None = None, today: date | None = None
    ) -> list[dict[str, Any]]:
        """Upcoming appointments and reminders on or after today (demo clock by default).

        With no member_id: the primary sees everyone, an adult sees only themself.
        """
        cutoff = (today or DEMO_TODAY).isoformat()
        with session(self.path) as conn:
            viewer = self._viewer(conn, viewer_id)
            if member_id is not None:
                self._target(conn, viewer_id, member_id)
                ids = [member_id]
            elif viewer["role"] == "primary":
                ids = [r["id"] for r in conn.execute(
                    "SELECT id FROM members WHERE household_id = ?", (viewer["household_id"],))]
            else:
                ids = [viewer_id]
            marks = ",".join("?" for _ in ids)
            rows = conn.execute(
                f"SELECT a.id, a.member_id, m.name AS member_name, a.kind, a.due_date, a.title, a.note "
                f"FROM appointments a JOIN members m ON m.id = a.member_id "
                f"WHERE a.member_id IN ({marks}) AND a.due_date >= ? ORDER BY a.due_date, a.id",
                (*ids, cutoff),
            ).fetchall()
        return [dict(r) for r in rows]

    # ---- invites -------------------------------------------------------
    def create_invite(
        self, viewer_id: str, email: str, member_id: str | None = None
    ) -> dict[str, Any]:
        """Primary invites an adult (18+). member_id names an existing adult profile, if any."""
        with session(self.path) as conn:
            viewer = self._viewer(conn, viewer_id)
            if viewer["role"] != "primary":
                raise AccessDenied("only the primary account holder can invite")
            if member_id is not None:
                m = self._target(conn, viewer_id, member_id)
                if m["age"] < 18:
                    raise ValueError("login is for adults 18 and over")
                if m["has_login"]:
                    raise ValueError("this person already has a login")
            invite = {
                "id": "inv-" + secrets.token_hex(4),
                "household_id": viewer["household_id"],
                "invited_by": viewer_id,
                "member_id": member_id,
                "email": email,
                "token": secrets.token_urlsafe(16),
                "status": "pending",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            conn.execute(
                "INSERT INTO invites (id, household_id, invited_by, member_id, email, token, status, created_at) "
                "VALUES (:id, :household_id, :invited_by, :member_id, :email, :token, :status, :created_at)",
                invite,
            )
        return invite

    def list_invites(self, viewer_id: str) -> list[dict[str, Any]]:
        with session(self.path) as conn:
            viewer = self._viewer(conn, viewer_id)
            if viewer["role"] != "primary":
                raise AccessDenied("only the primary account holder can see invites")
            rows = conn.execute(
                "SELECT * FROM invites WHERE household_id = ? ORDER BY created_at", (viewer["household_id"],)
            ).fetchall()
        return [dict(r) for r in rows]

    def accept_invite(self, token: str) -> dict[str, Any]:
        """Give the invited adult profile a login (demo level, no password)."""
        with session(self.path) as conn:
            inv = conn.execute("SELECT * FROM invites WHERE token = ?", (token,)).fetchone()
            if inv is None or inv["status"] != "pending":
                raise NotFound("invite")
            if inv["member_id"] is None:
                raise ValueError("this invite is not linked to a profile")
            m = conn.execute("SELECT * FROM members WHERE id = ?", (inv["member_id"],)).fetchone()
            if m["age"] < 18:
                raise ValueError("login is for adults 18 and over")
            conn.execute("UPDATE members SET has_login = 1 WHERE id = ?", (m["id"],))
            conn.execute(
                "INSERT INTO accounts (id, member_id, email, display_name) VALUES (?,?,?,?)",
                ("acct-" + m["id"].removeprefix("m-"), m["id"], inv["email"], m["name"]),
            )
            conn.execute("UPDATE invites SET status = 'accepted' WHERE id = ?", (inv["id"],))
            return dict(conn.execute("SELECT * FROM members WHERE id = ?", (m["id"],)).fetchone())

    # ---- saved Plan My Year plans ---------------------------------------
    def list_saved_plans(self, viewer_id: str, member_id: str) -> list[dict[str, Any]]:
        """Saved plans for one person, newest first. `items` is a list of dicts."""
        with session(self.path) as conn:
            self._target(conn, viewer_id, member_id)
            rows = conn.execute(
                "SELECT * FROM saved_plans WHERE member_id = ? ORDER BY created_at DESC, rowid DESC",
                (member_id,),
            ).fetchall()
        return [_saved_plan(r) for r in rows]

    def create_saved_plan(
        self, viewer_id: str, member_id: str, name: str, items: list[dict[str, Any]]
    ) -> dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        plan_id = "sp-" + secrets.token_hex(6)
        with session(self.path) as conn:
            self._target(conn, viewer_id, member_id)
            conn.execute(
                "INSERT INTO saved_plans (id, member_id, name, items_json, created_at, updated_at) "
                "VALUES (?,?,?,?,?,?)",
                (plan_id, member_id, name, json.dumps(items), now, now),
            )
            return _saved_plan(conn.execute("SELECT * FROM saved_plans WHERE id = ?", (plan_id,)).fetchone())

    def update_saved_plan(
        self, viewer_id: str, member_id: str, plan_id: str,
        name: str | None = None, items: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        with session(self.path) as conn:
            self._target(conn, viewer_id, member_id)
            row = conn.execute(
                "SELECT * FROM saved_plans WHERE id = ? AND member_id = ?", (plan_id, member_id)
            ).fetchone()
            if row is None:
                raise NotFound(f"saved plan {plan_id}")
            new_name = row["name"] if name is None else name
            new_items = row["items_json"] if items is None else json.dumps(items)
            now = datetime.now(timezone.utc).isoformat(timespec="seconds")
            conn.execute(
                "UPDATE saved_plans SET name = ?, items_json = ?, updated_at = ? WHERE id = ?",
                (new_name, new_items, now, plan_id),
            )
            return _saved_plan(conn.execute("SELECT * FROM saved_plans WHERE id = ?", (plan_id,)).fetchone())

    def delete_saved_plan(self, viewer_id: str, member_id: str, plan_id: str) -> None:
        with session(self.path) as conn:
            self._target(conn, viewer_id, member_id)
            cur = conn.execute(
                "DELETE FROM saved_plans WHERE id = ? AND member_id = ?", (plan_id, member_id)
            )
            if cur.rowcount == 0:
                raise NotFound(f"saved plan {plan_id}")


def _saved_plan(r: sqlite3.Row) -> dict[str, Any]:
    d = dict(r)
    d["items"] = json.loads(d.pop("items_json"))
    return d


def _tier(r: dict[str, Any]) -> dict[str, Any]:
    keys = ("monthly_cents", "annual_max_cents", "deductible_cents",
            "preventive_pct", "basic_pct", "major_pct", "ortho_pct")
    return {"id": r["tid"], "name": r["tname"], **{k: r[k] for k in keys}}


def _usage(conn: sqlite3.Connection, member_id: str, year: int) -> dict[str, Any]:
    r = conn.execute(
        "SELECT * FROM member_usage WHERE member_id = ? AND plan_year = ?", (member_id, year)
    ).fetchone()
    if r is None:
        return {"member_id": member_id, "plan_year": year, "max_used_cents": 0,
                "deductible_met_cents": 0, "visits": 0, "cleanings_used": 0}
    return dict(r)
