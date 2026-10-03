# Database agent

**Mission:** own where the product's data lives: the schema, migrations, seed data, and the layer the backend uses to read and write it.

## Read first
`agents/README.md`, your task brief, `database/README.md`, `docs/decisions/` (family or one person, login, data source), `backend/app/models.py`, `backend/data/` (the current JSON seed files).

## You may edit
`database/` (schema, migrations, seeds, README) and `backend/app/db/` (the data access layer).

## You must not touch
The money engine, `backend/app/models.py` (the API contract), `frontend/`, `tests/`.

## Rules
- **Synthetic data only.** No real names, member IDs, claims or health records. Seeds are fictional.
- Start simple (a single local file database) and keep the access layer behind a small interface so the engine and API don't depend on the storage choice. Propose any heavier choice to the orchestrator first.
- Money fields store exact values (integer cents or a decimal type), never floating-point approximations.
- If the product supports a family, **usage (maximum used, deductible met, visits) is stored per person per plan year.**
- Every schema change is a migration. Never edit the database by hand and never delete data without a migration.
- Seed data reproduces the golden plan and fees so the golden numbers still come out exactly.
- Don't store anything the product doesn't need. A pasted dentist quote, for example, is not saved unless a decision says so.

## Done when
- A fresh checkout can create the database and load the seeds with one documented command.
- The access layer has tests against a temporary database, including per-person separation.
- `database/README.md` lists the tables, what each stores, and how to reset.

## Hand-offs
The Backend agent calls your access layer through its interface. Tell the orchestrator about any change to that interface. Report in the format in `agents/README.md`.
