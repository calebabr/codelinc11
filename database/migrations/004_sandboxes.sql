-- 004: demo sandboxes. Each visitor gets a private copy of the template household (new rows, ids
-- suffixed with ".<sid>"). This table lists which households are sandboxes and when each was made,
-- so expired and surplus ones can be deleted. Synthetic data only.

CREATE TABLE sandboxes (
    household_id  TEXT PRIMARY KEY REFERENCES households(id),
    sid           TEXT NOT NULL UNIQUE,            -- 6 lowercase hex characters
    created_at    TEXT NOT NULL                    -- ISO 8601 UTC
);
CREATE INDEX idx_sandboxes_created ON sandboxes(created_at);
