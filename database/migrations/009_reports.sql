-- 009: reports (sprint 2, B4). Synthetic claims, EOBs (explanations of benefits) and copay-style
-- visits that belong to one member. SYNTHETIC DATA ONLY: nothing here is a real record.
-- Rows are per member, so a demo sandbox clones them (sandbox.CLONE_TABLES), a reset restores them
-- and sandbox expiry or removing a person deletes them (sandbox.MEMBER_CHILD_TABLES).
-- `data_json` holds the structured fields of the document. Every amount is an INTEGER NUMBER OF
-- CENTS under a key ending in `_cents` (billed_cents, allowed_cents, deductible_applied_cents,
-- plan_paid_cents, coinsurance_cents, copay_cents, you_owe_cents, balance_billing_cents); text
-- fields (claim_number, eob_number, status, remark) are kept as written. Amounts are stored as the
-- document gave them; they are never recomputed.
-- SQLite cannot widen a CHECK later without rebuilding the table, so `kind` and `paid_status`
-- list every value the API uses. A claim's own status (paid, denied, pending) lives in data_json.
-- `provider_id` points at providers(id) but has no foreign key: the directory is global reference
-- data that is reloaded on reseed, after the household rows.

CREATE TABLE report_items (
    id            TEXT PRIMARY KEY,
    member_id     TEXT NOT NULL REFERENCES members(id),
    kind          TEXT NOT NULL CHECK (kind IN ('claim','eob','copay','other')),
    service_date  TEXT NOT NULL,
    title         TEXT NOT NULL,
    provider_id   TEXT,
    provider_name TEXT NOT NULL,
    code          TEXT,
    description   TEXT NOT NULL DEFAULT '',
    data_json     TEXT NOT NULL DEFAULT '{}',
    paid_status   TEXT NOT NULL DEFAULT 'not_applicable'
                  CHECK (paid_status IN ('unpaid','paid','not_applicable')),
    created_at    TEXT NOT NULL
);
CREATE INDEX idx_report_items_member ON report_items(member_id, service_date);
