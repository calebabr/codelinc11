# Database summary
_Updated 2026-10-03_

**Built:** SQLite access layer in `backend/app/db/` (`core.py`, `store.py`, `sandbox.py`, `__main__.py`), four migrations in `database/migrations/` (14 tables, money in whole cents): `001_households.sql` (households, members, accounts, usage, visits, appointments, chat memory and more), `002_saved_plans.sql`, `003_saved_simulations.sql`, `004_sandboxes.sql`. Seed `database/seeds/demo_household.json`. Rivera household: Jordan (41, primary), Alex (39, spouse), Maya (9, managed, no login), Noah (23, child, pending student verification). Alex starts with $1,100 used and the deductible met. Demo clock `2026-11-01`. Access rules: the primary sees everyone, an adult sees only themselves, a managed member has no login, anything else raises `AccessDenied`. The API uses the database for every household and member call.

**Demo families:** `sandbox.py` clones the template household for each visitor (ids suffixed `.xxxxxx`, 24 hour expiry, cap 300, about 4.4 KB each) and can restore or delete one with all its dependent rows. `POST /demo/reset` restores only the caller's own family.

**Commands:** `python -m app.db` and `python -m app.db --reset` from `backend/`. Full reference: `database/README.md`.

**Stand-in:** one SQLite file on one server. Plans and fees for the engine still come from JSON in `backend/data/`. D8 (where stored data lives) is still marked open in the decision log.
