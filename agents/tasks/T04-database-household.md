# Task T04: Households, members and context in the database

**Role:** database
**Read first:** agents/README.md, agents/database-agent.md, agents/tasks/PLAN.md ("Data"), `database/README.md`, `docs/decisions/README.md` (D1, D2, D9, F2, F3)

## Goal
A server database holding households, members, per-person usage, history, upcoming care and each person's assistant context, with seed data for the demo household and a small access layer the backend and AI agent call.

## Scope
- Decisions D1 (family, per-person context), D2 and F2 (adults 18+ can have a login by invite; the primary sees everything), D9 (context in a server database).
- Reference, read-only: Sai's `member.json` (`git show prototype/sai-benefits-portal:benefits-portal/member.json`) and Wrigley's seed (`git show origin/main:frontend/src/lib/seed.ts`) for shape.

## You may edit
`database/` (schema, migrations, seeds, README) and `backend/app/db/` (the access layer).

## You must not touch
The engine, `backend/app/models.py`, other `backend/app/` code (T03, T05, T06), `frontend/`.

## Interfaces
- Start with a single local file database (SQLite) behind a small interface. Money in integer cents.
- Tables (names are yours to refine): households, members, accounts (demo logins), invites, plan tiers, member usage (per member per plan year), visits and claims, appointments and reminders, member context (plan highlights, preferences and must-haves, chat memory).
- Access-layer functions the others will call (agree names in your report): get household, get member, list demo accounts, get member usage, record a visit (updates usage), get/append member context, list upcoming schedule, create invite.
- **Demo household and seeds:** see "Data" in agents/tasks/PLAN.md. Jordan, Alex, Maya, Noah. **Alex starts with $1,100 used and deductible met** (so Plan My Year gives $2,300 to $1,405, saving $895). Noah is 23 and pending student verification. Adults 18+ (Jordan, Alex, Noah) can have a demo login; Maya cannot.
- Synthetic data only. Context for each person is separate; no query may return one member's context under another member's id.
- **Running at the same time:** T01, T02, T03.

## Acceptance checks
- One documented command creates the database and loads the seeds from a clean checkout.
- Tests (temporary database) cover: per-person usage separation, recording a visit updates only that person, context isolation between members, the primary can read everyone, an adult reads only their own, a managed member has no login.
- `database/README.md` lists tables and how to reset.

## Docs to update
`database/README.md`.

## Report
Format in agents/README.md, including the access-layer function list for T05 and T06.
