-- 008: synthetic provider directory (sprint 2, B3). GLOBAL reference data: one copy for everyone,
-- never cloned per demo family and never touched by a family reset or expiry.
-- `network_plan_ids` is a JSON list of plan tier ids the practice is in network for ([] = out of
-- network for everyone). `zip_centroids` holds approximate public ZIP centre points, used only for
-- demo distances (haversine in code). Rows are loaded from database/seeds/providers.json by
-- core.seed_reference(), which runs after migrations and only fills empty tables.
-- members.primary_dentist_id already exists (migration 005). SQLite cannot add a foreign key to an
-- existing column without rebuilding `members` (and everything that points at it), so the link is
-- checked in code (Store.update_member_profile) and a provider is never deleted.

CREATE TABLE providers (
    id               TEXT PRIMARY KEY,
    practice_name    TEXT NOT NULL,
    dentist_name     TEXT NOT NULL,
    specialty        TEXT NOT NULL CHECK (specialty IN
                       ('general','pediatric','orthodontics','oral_surgery','endodontics','periodontics')),
    address          TEXT NOT NULL,
    city             TEXT NOT NULL,
    state            TEXT NOT NULL,
    zip              TEXT NOT NULL,
    lat              REAL NOT NULL,
    lon              REAL NOT NULL,
    phone            TEXT NOT NULL,
    accepting_new    INTEGER NOT NULL DEFAULT 1 CHECK (accepting_new IN (0,1)),
    languages        TEXT NOT NULL DEFAULT '["English"]',   -- JSON list
    network_plan_ids TEXT NOT NULL DEFAULT '[]'             -- JSON list of plan tier ids
);
CREATE INDEX idx_providers_zip ON providers(zip);

CREATE TABLE zip_centroids (
    zip   TEXT PRIMARY KEY,
    city  TEXT NOT NULL,
    state TEXT NOT NULL,
    lat   REAL NOT NULL,
    lon   REAL NOT NULL
);
