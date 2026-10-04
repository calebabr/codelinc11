-- 003: saved "Which plan fits us?" comparisons, one list per member. Synthetic data only.
-- request_json holds the choices (people, care levels, known care, plans, n, seed, network).
-- summary_json holds the headline the server computed by running simulate() when it was saved.

CREATE TABLE saved_simulations (
    id            TEXT PRIMARY KEY,
    member_id     TEXT NOT NULL REFERENCES members(id),
    name          TEXT NOT NULL,
    request_json  TEXT NOT NULL,
    summary_json  TEXT NOT NULL,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
);
CREATE INDEX idx_saved_simulations_member ON saved_simulations(member_id, created_at);
