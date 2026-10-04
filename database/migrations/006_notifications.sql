-- 006: notifications. Preferences per person, the in-app notifications, and a delivery preview log.
-- Nothing is ever sent: outbox.status is locked to 'preview' by a CHECK. A real sender (SES, Twilio)
-- would need a new migration that widens the CHECK, plus a new Notifier (see backend/app/notifier.py).
-- Synthetic data only. dedupe_key (for example 'benefits_expiring:2026') makes generation idempotent.

CREATE TABLE notification_prefs (
    member_id   TEXT PRIMARY KEY REFERENCES members(id),
    app         INTEGER NOT NULL DEFAULT 1 CHECK (app IN (0,1)),
    email       INTEGER NOT NULL DEFAULT 0 CHECK (email IN (0,1)),
    sms         INTEGER NOT NULL DEFAULT 0 CHECK (sms IN (0,1)),
    types_json  TEXT                                  -- JSON list of enabled kinds; NULL means all
);

CREATE TABLE notifications (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id   TEXT NOT NULL REFERENCES members(id),
    kind        TEXT NOT NULL CHECK (kind IN ('benefits_expiring','preventive_unused','upcoming_appointment',
                                              'procedure_planned','deductible_met','claim_update',
                                              'eob_ready','test')),
    title       TEXT NOT NULL,
    body        TEXT NOT NULL,
    severity    TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','success','warning')),
    link        TEXT,
    dedupe_key  TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    read_at     TEXT,
    UNIQUE (member_id, dedupe_key)
);
CREATE INDEX idx_notifications_member ON notifications(member_id, created_at);

CREATE TABLE outbox (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id   TEXT NOT NULL REFERENCES members(id),
    channel     TEXT NOT NULL CHECK (channel IN ('email','sms')),
    to_address  TEXT NOT NULL,
    subject     TEXT,
    body        TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'preview' CHECK (status = 'preview')
);
CREATE INDEX idx_outbox_member ON outbox(member_id, created_at);
