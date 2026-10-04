# Database summary
_Updated 2026-10-03_

**Built:** SQLite access layer in `backend/app/db/` (`core.py`, `store.py`, `sandbox.py`, `__main__.py`), four migrations in `database/migrations/` (14 tables, money in whole cents): `001_households.sql` (households, members, accounts, usage, visits, appointments, chat memory and more), `002_saved_plans.sql`, `003_saved_simulations.sql`, `004_sandboxes.sql`. Seed `database/seeds/demo_household.json`. Halog household: Marc (41, primary), AC (39, spouse), Sophia (9, managed, no login), Hannah (23, child, pending student verification). AC starts with $1,100 used and the deductible met. Demo clock `2026-11-01`. Access rules: the primary sees everyone, an adult sees only themselves, a managed member has no login, anything else raises `AccessDenied`. The API uses the database for every household and member call.

**Demo families:** `sandbox.py` clones the template household for each visitor (ids suffixed `.xxxxxx`, 24 hour expiry, cap 300, about 4.4 KB each) and can restore or delete one with all its dependent rows. `POST /demo/reset` restores only the caller's own family.

**Commands:** `python -m app.db` and `python -m app.db --reset` from `backend/`. Full reference: `database/README.md`.

**Stand-in:** one SQLite file on one server. Plans and fees for the engine still come from JSON in `backend/data/`. D8 (where stored data lives) is still marked open in the decision log.

**Added (B3, sprint 2):** migration `008_providers.sql` (`providers`, `zip_centroids`), seeds in `database/seeds/providers.json` (31 fictional practices, 51 approximate ZIP centres) loaded by `core.seed_reference()` after every migrate and seed (so older databases get them). Global reference data: not cloned into sandboxes, kept by reset and expiry. `members.primary_dentist_id` has no foreign key (documented in `database/README.md`); the store validates it.

**Added (B4, sprint 2):** migration `009_reports.sql` (`report_items`: synthetic claims, EOBs and copay-style visits per member; amounts as integer cents in `data_json`; `kind` claim, eob, copay, other; `paid_status` unpaid, paid, not_applicable). Seeded for AC (five documents matching his visits, all paid) and Marc (one open EOB, $90) in `demo_household.json`; cloned into sandboxes, restored by reset, deleted with the sandbox or person; older databases get the template rows from `core.backfill_template_reports()`. `Store` gains `list_report_items`, `get_report_item`, `add_report_item` (demo family only, max 100 per person), `mark_report_paid`, `delete_report_item`. `core.seed()` now skips tables a database does not have yet.

## Template rename upgrade
`core.upgrade_template_names()` runs after every `migrate()`. It renames the shared template family (Rivera to Halog) in an already-seeded database, only where a value is still exactly the old default. It is idempotent, leaves ids, sandboxes and deliberate edits alone, and is a no-op on a fresh database. Tests: `backend/tests/test_name_upgrade.py`.
