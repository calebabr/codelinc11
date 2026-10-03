-- 002: saved Plan My Year plans, one list per member. Synthetic data only.
-- items_json is a JSON array of {id, code, urgency, after}; no dollar amounts are stored.

CREATE TABLE saved_plans (
    id          TEXT PRIMARY KEY,
    member_id   TEXT NOT NULL REFERENCES members(id),
    name        TEXT NOT NULL,
    items_json  TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);
CREATE INDEX idx_saved_plans_member ON saved_plans(member_id, created_at);
