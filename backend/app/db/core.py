"""SQLite connection, migrations and seed loading. Money is integer cents."""

from __future__ import annotations

import json
import os
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATIONS_DIR = REPO_ROOT / "database" / "migrations"
SEEDS_DIR = REPO_ROOT / "database" / "seeds"
DEFAULT_DB_PATH = REPO_ROOT / "database" / "benefits.db"

# Insert order matters (foreign keys).
SEED_TABLES = [
    "plan_tiers",
    "households",
    "members",
    "accounts",
    "member_usage",
    "visits",
    "appointments",
    "member_context",
    "member_preferences",
    "saved_plans",
    "notification_prefs",
    "report_items",
]


def db_path() -> Path:
    return Path(os.environ.get("BENEFITS_DB_PATH", DEFAULT_DB_PATH))


def connect(path: str | Path) -> sqlite3.Connection:
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def session(path: str | Path) -> Iterator[sqlite3.Connection]:
    conn = connect(path)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def migrate(path: str | Path) -> list[str]:
    """Apply any migration files not yet applied, in filename order."""
    applied_now: list[str] = []
    with session(path) as conn:
        conn.execute("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY)")
        done = {r["name"] for r in conn.execute("SELECT name FROM schema_migrations")}
        for f in sorted(MIGRATIONS_DIR.glob("*.sql")):
            if f.name in done:
                continue
            conn.executescript(f.read_text(encoding="utf-8"))
            conn.execute("INSERT INTO schema_migrations (name) VALUES (?)", (f.name,))
            applied_now.append(f.name)
    seed_reference(path)
    backfill_template_reports(path)
    upgrade_template_names(path)
    return applied_now


def seed_reference(path: str | Path) -> None:
    """Load the global reference data (providers and ZIP centroids) into empty tables.

    This data is shared by every family: it is not part of the household seed, is never cloned
    into a demo sandbox and is not touched by a family reset. Existing databases get it when
    migration 008 is applied (this runs after every migrate).
    """
    f = SEEDS_DIR / "providers.json"
    if not f.exists():
        return
    with session(path) as conn:
        have = {r["name"] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
        if "providers" not in have or "zip_centroids" not in have:
            return
        data = json.loads(f.read_text(encoding="utf-8"))
        if conn.execute("SELECT COUNT(*) FROM providers").fetchone()[0] == 0:
            for p in data["providers"]:
                row = dict(p)
                row["languages"] = json.dumps(row["languages"])
                row["network_plan_ids"] = json.dumps(row["network_plan_ids"])
                row["accepting_new"] = 1 if row["accepting_new"] else 0
                cols = ", ".join(row)
                conn.execute(f"INSERT INTO providers ({cols}) VALUES ({', '.join('?' for _ in row)})",
                             list(row.values()))
        if conn.execute("SELECT COUNT(*) FROM zip_centroids").fetchone()[0] == 0:
            for z in data["zip_centroids"]:
                conn.execute("INSERT INTO zip_centroids (zip, city, state, lat, lon) VALUES (?,?,?,?,?)",
                             (z["zip"], z["city"], z["state"], z["lat"], z["lon"]))


def backfill_template_reports(path: str | Path) -> None:
    """Give an older database (migrated to 009 after it was seeded) the template family's synthetic
    reports. Only fills an empty report_items table, and only for template members that exist, so
    a fresh database (seeded right after migrate) and a database where the table is already filled
    are untouched. Demo sandboxes get their reports from the seed file when they are cloned."""
    with session(path) as conn:
        have = {r["name"] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
        if "report_items" not in have or conn.execute("SELECT COUNT(*) FROM report_items").fetchone()[0]:
            return
        members = {r["id"] for r in conn.execute("SELECT id FROM members")}
        for row in load_seed_file().get("report_items", []):
            if row["member_id"] in members:
                cols = ", ".join(row)
                conn.execute(f"INSERT INTO report_items ({cols}) VALUES ({', '.join('?' for _ in row)})",
                             list(row.values()))


# The template family was renamed in the seed file (ids never changed). The old defaults, in the
# seed's member order. Everything else (ids, new values) is read from the seed file, so no family
# name or id is hard-coded here.
_OLD_HOUSEHOLD_NAME = "Rivera household"
_OLD_MEMBER_NAMES = ["Jordan Rivera", "Alex Rivera", "Maya Rivera", "Noah Rivera"]
_OLD_EMAIL_LOCALS = ["jordan.rivera", "alex.rivera", None, "noah.rivera"]


def _rename_plan() -> list[tuple[str, str, str, str, str]]:
    """(table, row id, column, old default, new value) for every template value that was renamed."""
    seed_data = load_seed_file()
    plan: list[tuple[str, str, str, str, str]] = []
    for h in seed_data["households"]:
        plan.append(("households", h["id"], "name", _OLD_HOUSEHOLD_NAME, h["name"]))
    old_name: dict[str, str] = {}
    old_email: dict[str, str | None] = {}
    for i, m in enumerate(seed_data["members"][:len(_OLD_MEMBER_NAMES)]):
        old_name[m["id"]] = _OLD_MEMBER_NAMES[i]
        local = _OLD_EMAIL_LOCALS[i]
        old_email[m["id"]] = f"{local}@example.test" if local else None
        plan.append(("members", m["id"], "name", _OLD_MEMBER_NAMES[i], m["name"]))
        if m.get("email") and old_email[m["id"]]:
            plan.append(("members", m["id"], "email", old_email[m["id"]], m["email"]))
    for a in seed_data["accounts"]:
        mid = a["member_id"]
        if mid in old_name:
            plan.append(("accounts", a["id"], "display_name", old_name[mid], a["display_name"]))
            if old_email[mid]:
                plan.append(("accounts", a["id"], "email", old_email[mid], a["email"]))
    return plan


def _note_plan() -> list[tuple[str, str, str]]:
    """(member id, old note, new note) for template appointment notes that name the person."""
    seed_data = load_seed_file()
    names = {m["id"]: m["name"] for m in seed_data["members"]}
    olds = {m["id"]: _OLD_MEMBER_NAMES[i].split()[0]
            for i, m in enumerate(seed_data["members"][:len(_OLD_MEMBER_NAMES)])}
    out = []
    for ap in seed_data.get("appointments", []):
        mid, note = ap["member_id"], ap.get("note")
        if note and mid in olds and names[mid] in note:
            out.append((mid, note.replace(names[mid], olds[mid]), note))
    return out


def upgrade_template_names(path: str | Path) -> int:
    """Rename the shared template family in an older database (run after every migrate).

    Updates only the template rows (the ids in the seed file), only where the stored value is
    still exactly the old default, so it is idempotent and never overwrites a change made on
    purpose. Demo sandboxes (ids with a dot suffix) are not touched: they expire on their own.
    Free text (chat memory, member notes) is left alone because it cannot be matched safely.
    Returns the number of values changed."""
    changed = 0
    with session(path) as conn:
        have = {r["name"] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
        for table, row_id, col, old, new in _rename_plan():
            if table not in have or col not in {r["name"] for r in conn.execute(f"PRAGMA table_info({table})")}:
                continue
            # accounts.email is unique: skip if the new address is already taken by another row.
            clash = (table, col) == ("accounts", "email")
            extra = " AND NOT EXISTS (SELECT 1 FROM accounts WHERE email = ?)" if clash else ""
            args = [new, row_id, old] + ([new] if extra else [])
            changed += conn.execute(f"UPDATE {table} SET {col} = ? WHERE id = ? AND {col} = ?{extra}", args).rowcount
        if "appointments" in have:
            for member_id, old, new in _note_plan():
                changed += conn.execute("UPDATE appointments SET note = ? WHERE member_id = ? AND note = ?",
                                        (new, member_id, old)).rowcount
    return changed


def load_seed_file() -> dict:
    return json.loads((SEEDS_DIR / "demo_household.json").read_text(encoding="utf-8"))


def seed(path: str | Path) -> None:
    """Load the demo household. Only call on an empty database (see reset)."""
    data = load_seed_file()
    with session(path) as conn:
        have = {r["name"] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
        for table in SEED_TABLES:
            if table not in have:      # a database not yet migrated to the newest tables
                continue
            for row in data.get(table, []):
                row = dict(row)
                if table == "visits":
                    row["plan_year"] = int(row["visit_date"][:4])
                cols = ", ".join(row)
                marks = ", ".join("?" for _ in row)
                conn.execute(f"INSERT INTO {table} ({cols}) VALUES ({marks})", list(row.values()))
    seed_reference(path)


def reset(path: str | Path) -> None:
    """Delete the database file, then create it and load the seeds."""
    p = Path(path)
    if p.exists():
        p.unlink()
    p.parent.mkdir(parents=True, exist_ok=True)
    migrate(p)
    seed(p)


def is_empty(path: str | Path) -> bool:
    """True when there are no households (a migrated but unseeded database)."""
    with session(path) as conn:
        return conn.execute("SELECT COUNT(*) FROM households").fetchone()[0] == 0


def seed_if_empty(path: str | Path) -> bool:
    """Migrate, then load the demo household only if the households table is empty."""
    migrate(path)
    if is_empty(path):
        seed(path)
        return True
    return False


def reseed(path: str | Path) -> None:
    """Put the data back to the original demo state, keeping the file (and open connections) valid.

    Member ids come from the seed file, so signed-in sessions stay valid.
    """
    migrate(path)
    with session(path) as conn:
        conn.execute("PRAGMA foreign_keys = OFF")
        names = [r["name"] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' "
            "AND name != 'schema_migrations'")]
        for name in names:
            conn.execute(f'DELETE FROM "{name}"')
        conn.execute("PRAGMA foreign_keys = ON")
    seed(path)
