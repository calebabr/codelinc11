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
    return applied_now


def load_seed_file() -> dict:
    return json.loads((SEEDS_DIR / "demo_household.json").read_text(encoding="utf-8"))


def seed(path: str | Path) -> None:
    """Load the demo household. Only call on an empty database (see reset)."""
    data = load_seed_file()
    with session(path) as conn:
        for table in SEED_TABLES:
            for row in data.get(table, []):
                row = dict(row)
                if table == "visits":
                    row["plan_year"] = int(row["visit_date"][:4])
                cols = ", ".join(row)
                marks = ", ".join("?" for _ in row)
                conn.execute(f"INSERT INTO {table} ({cols}) VALUES ({marks})", list(row.values()))


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
