-- 007: add the 'reminder' notification kind (reminders from the schedule show in the bell).
-- SQLite cannot change a CHECK in place, so the notifications table is rebuilt with the wider list.
-- Nothing else references this table. Rows are kept as they are.

CREATE TABLE notifications_new (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id   TEXT NOT NULL REFERENCES members(id),
    kind        TEXT NOT NULL CHECK (kind IN ('benefits_expiring','preventive_unused','upcoming_appointment',
                                              'reminder','procedure_planned','deductible_met','claim_update',
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
INSERT INTO notifications_new (id, member_id, kind, title, body, severity, link, dedupe_key, created_at, read_at)
    SELECT id, member_id, kind, title, body, severity, link, dedupe_key, created_at, read_at FROM notifications;
DROP TABLE notifications;
ALTER TABLE notifications_new RENAME TO notifications;
CREATE INDEX idx_notifications_member ON notifications(member_id, created_at);
