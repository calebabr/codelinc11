-- 001: households, members, per-person usage, history, schedule and context.
-- Money is stored as integer cents. Synthetic data only.

CREATE TABLE plan_tiers (
    id                 TEXT PRIMARY KEY,           -- basic | preferred | premium
    name               TEXT NOT NULL,
    monthly_cents      INTEGER NOT NULL,
    annual_max_cents   INTEGER NOT NULL,
    deductible_cents   INTEGER NOT NULL,
    preventive_pct     INTEGER NOT NULL,
    basic_pct          INTEGER NOT NULL,
    major_pct          INTEGER NOT NULL,
    ortho_pct          INTEGER NOT NULL
);

CREATE TABLE households (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    plan_tier_id  TEXT NOT NULL REFERENCES plan_tiers(id)
);

CREATE TABLE members (
    id                 TEXT PRIMARY KEY,
    household_id       TEXT NOT NULL REFERENCES households(id),
    name               TEXT NOT NULL,
    relationship       TEXT NOT NULL CHECK (relationship IN ('self','spouse','child')),
    age                INTEGER NOT NULL CHECK (age >= 0),
    full_time_student  INTEGER NOT NULL DEFAULT 0 CHECK (full_time_student IN (0,1)),
    status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending')),
    status_note        TEXT,
    role               TEXT NOT NULL CHECK (role IN ('primary','adult','managed')),
    has_login          INTEGER NOT NULL DEFAULT 0 CHECK (has_login IN (0,1)),
    -- Login is for adults 18 and over only; managed members never have one.
    CHECK (has_login = 0 OR (age >= 18 AND role <> 'managed')),
    CHECK (role <> 'managed' OR age < 18)
);
CREATE INDEX idx_members_household ON members(household_id);

-- Demo logins (no passwords: the demo signs in by picking an account).
CREATE TABLE accounts (
    id            TEXT PRIMARY KEY,
    member_id     TEXT NOT NULL UNIQUE REFERENCES members(id),
    email         TEXT NOT NULL UNIQUE,
    display_name  TEXT NOT NULL
);

CREATE TABLE invites (
    id                  TEXT PRIMARY KEY,
    household_id        TEXT NOT NULL REFERENCES households(id),
    invited_by          TEXT NOT NULL REFERENCES members(id),
    member_id           TEXT REFERENCES members(id),   -- existing adult profile, if any
    email               TEXT NOT NULL,
    token               TEXT NOT NULL UNIQUE,
    status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','cancelled')),
    created_at          TEXT NOT NULL
);

-- Usage is per person per plan year, never one pool for the household.
CREATE TABLE member_usage (
    member_id               TEXT NOT NULL REFERENCES members(id),
    plan_year               INTEGER NOT NULL,
    max_used_cents          INTEGER NOT NULL DEFAULT 0 CHECK (max_used_cents >= 0),
    deductible_met_cents    INTEGER NOT NULL DEFAULT 0 CHECK (deductible_met_cents >= 0),
    visits                  INTEGER NOT NULL DEFAULT 0,
    cleanings_used          INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (member_id, plan_year)
);

CREATE TABLE visits (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id           TEXT NOT NULL REFERENCES members(id),
    plan_year           INTEGER NOT NULL,
    visit_date          TEXT NOT NULL,                 -- ISO date
    procedure_code      TEXT,
    description         TEXT NOT NULL,
    billed_cents        INTEGER NOT NULL,
    plan_paid_cents     INTEGER NOT NULL,
    patient_paid_cents  INTEGER NOT NULL
);
CREATE INDEX idx_visits_member ON visits(member_id, visit_date);

CREATE TABLE appointments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id   TEXT NOT NULL REFERENCES members(id),
    kind        TEXT NOT NULL CHECK (kind IN ('appointment','reminder')),
    due_date    TEXT NOT NULL,
    title       TEXT NOT NULL,
    note        TEXT
);
CREATE INDEX idx_appointments_member ON appointments(member_id, due_date);

-- Assistant context, one row per person.
CREATE TABLE member_context (
    member_id        TEXT PRIMARY KEY REFERENCES members(id),
    plan_highlights  TEXT NOT NULL DEFAULT ''
);

CREATE TABLE member_preferences (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id   TEXT NOT NULL REFERENCES members(id),
    kind        TEXT NOT NULL CHECK (kind IN ('preference','must_have')),
    text        TEXT NOT NULL
);
CREATE INDEX idx_prefs_member ON member_preferences(member_id);

CREATE TABLE chat_memory (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id   TEXT NOT NULL REFERENCES members(id),
    role        TEXT NOT NULL CHECK (role IN ('user','assistant')),
    content     TEXT NOT NULL,
    created_at  TEXT NOT NULL
);
CREATE INDEX idx_chat_member ON chat_memory(member_id, id);
