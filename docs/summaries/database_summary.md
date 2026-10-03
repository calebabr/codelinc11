# Database summary
_Updated 2026-10-03 (T04)_

**Built:** SQLite access layer in `backend/app/db/` (`core.py`, `store.py`, `__main__.py`), schema `database/migrations/001_households.sql` (11 tables, money in whole cents), seed `database/seeds/demo_household.json`. Rivera household: Jordan (41, primary), Alex (39, spouse), Maya (9, managed, no login), Noah (23, child, pending student verification). Alex starts with $1,100 used and the deductible met. Demo clock `2026-11-01`. Access rules: the primary sees everyone, an adult sees only themselves, a managed member has no login, anything else raises `AccessDenied`. Context queries always filter by member id. 17 tests in `backend/tests/test_db.py` pass.

**Commands:** `python -m app.db` and `python -m app.db --reset` from `backend/`. Full reference: `database/README.md`.

**Not done:** the API does not use the database yet (T05). Plans and fees for the engine still come from JSON in `backend/data/`. D8 (where stored data lives) is still marked open in the decision log.
