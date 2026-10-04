-- 005: member profiles. members gains dob, email, phone, zip, notes and primary_dentist_id, and the
-- relationship check allows 'partner' and 'other'. SQLite cannot change a CHECK, so the table is
-- rebuilt (same ids, same rows). `age` stays and is kept in sync from dob by the access layer using
-- the demo clock. Synthetic data only; contact details are never sent to the assistant.
-- migrate() runs this script after a COMMIT, so the pragma below takes effect.

PRAGMA foreign_keys = OFF;

CREATE TABLE members_new (
    id                 TEXT PRIMARY KEY,
    household_id       TEXT NOT NULL REFERENCES households(id),
    name               TEXT NOT NULL,
    relationship       TEXT NOT NULL CHECK (relationship IN ('self','spouse','partner','child','other')),
    age                INTEGER NOT NULL CHECK (age >= 0),
    full_time_student  INTEGER NOT NULL DEFAULT 0 CHECK (full_time_student IN (0,1)),
    status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending')),
    status_note        TEXT,
    role               TEXT NOT NULL CHECK (role IN ('primary','adult','managed')),
    has_login          INTEGER NOT NULL DEFAULT 0 CHECK (has_login IN (0,1)),
    dob                TEXT,                           -- ISO date (age is derived from it)
    email              TEXT,                           -- contact email (not the sign-in account)
    phone              TEXT,                           -- digits only, 10 to 15
    zip                TEXT,                           -- 5 digits
    notes              TEXT CHECK (notes IS NULL OR length(notes) <= 200),
    primary_dentist_id TEXT,                           -- filled in by the providers feature
    CHECK (has_login = 0 OR (age >= 18 AND role <> 'managed')),
    CHECK (role <> 'managed' OR age < 18)
);

INSERT INTO members_new (id, household_id, name, relationship, age, full_time_student, status,
                         status_note, role, has_login)
SELECT id, household_id, name, relationship, age, full_time_student, status, status_note, role, has_login
FROM members;

DROP TABLE members;
ALTER TABLE members_new RENAME TO members;
CREATE INDEX idx_members_household ON members(household_id);

-- Existing databases: give the four demo people their synthetic profile (sandbox copies end in
-- ".<sid>"). New databases get the same values from the seed file.
UPDATE members SET dob = '1985-03-14', email = 'marc.halog@example.test', phone = '3345550142', zip = '36830'
 WHERE id = 'm-jordan' OR id LIKE 'm-jordan.%';
UPDATE members SET dob = '1987-07-22', email = 'ac.halog@example.test', phone = '3345550143', zip = '36830'
 WHERE id = 'm-alex' OR id LIKE 'm-alex.%';
UPDATE members SET dob = '2017-05-09', email = NULL, phone = NULL, zip = '36830'
 WHERE id = 'm-maya' OR id LIKE 'm-maya.%';
UPDATE members SET dob = '2003-09-30', email = 'hannah.halog@example.test', phone = '3345550147', zip = '36849'
 WHERE id = 'm-noah' OR id LIKE 'm-noah.%';

PRAGMA foreign_keys = ON;
