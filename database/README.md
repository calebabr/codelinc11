# database/

Where the product's household data lives: schema, migrations and seed data. The Database agent (`agents/database-agent.md`) owns this folder and `backend/app/db/`.

Status: **households, members, per-person usage, history, schedule and assistant context are built** (SQLite, money in integer cents). Plans and fees for the engine still come from `backend/data/` JSON files.

```
database/
├── migrations/   001_households.sql ... applied in filename order
├── seeds/        demo_household.json (synthetic Rivera household)
└── README.md
backend/app/db/   core.py (connect, migrate, seed, reset), store.py (access layer), __main__.py (CLI)
```

## Create or reset the database
From `backend/`:

```
python -m app.db            # creates database/benefits.db if missing; seeds it whenever it has no households
python -m app.db --reset    # deletes it and rebuilds from the seeds
```

The API also seeds an empty database on startup. `POST /demo/reset` (primary only) puts the data back to the original demo state in place (`core.reseed`); member ids do not change, so signed-in sessions stay valid. The session signing secret is kept in `database/.session_secret` (git-ignored) unless `SESSION_SECRET` is set.

Set `BENEFITS_DB_PATH` to use another file. `*.db` is git-ignored. Every schema change is a new `NNN_name.sql` file in `migrations/`; `Store(...)` applies any that are missing.

## Tables
| Table | What it stores |
|---|---|
| `plan_tiers` | Basic, Preferred, Premium: premium, yearly maximum, deductible, coverage percentages (cents) |
| `households` | A household and its plan tier |
| `members` | Name, relationship (self, spouse, child), age, student flag, status (active, pending), role (primary, adult, managed), has_login. A check rule allows a login only for adults 18+, never for managed members |
| `accounts` | Demo logins (email, display name), one per member with a login |
| `invites` | Primary invites an adult by email; token; pending, accepted or cancelled |
| `member_usage` | Maximum used, deductible met, visits, cleanings used, **per member per plan year** |
| `visits` | Past procedures: date, code, billed, plan paid, patient paid |
| `appointments` | Upcoming appointments and reminders per member |
| `member_context` | Plan highlights text per member |
| `member_preferences` | Preferences and must-haves per member |
| `chat_memory` | The assistant's saved chat turns per member |
| `saved_plans` | Saved Plan My Year plans per member: name, items (JSON: id, code, urgency, after; no dollar amounts), created and updated times. Alex has one seeded (the S2 case) |
| `schema_migrations` | Which migrations have run |

Not stored: pasted dentist quotes, uploaded documents.

## Demo household (synthetic)
Jordan Rivera (41, primary), Alex Rivera (39, spouse), Maya Rivera (9, managed, no login), Noah Rivera (23, child, pending student verification). Jordan, Alex and Noah have demo logins. **Alex starts with $1,100 used and the deductible met** ($400 left of the $1,500 Preferred maximum), and his visit history adds up to that $1,100, so Plan My Year gives $2,300 to $1,405. The demo clock is `2026-11-01`.

## Access layer (`from app.db import Store, AccessDenied, NotFound, DEMO_TODAY`)
`Store(path=None)` uses `BENEFITS_DB_PATH` or the default file. Every call takes the signed-in `viewer_id`. The primary reads everyone in the household; an adult reads only their own data; a managed member has no login. Anything else raises `AccessDenied`. Context queries always filter by member id, so one person's context never comes back under another's id.

| Function | Purpose |
|---|---|
| `list_demo_accounts()` | Accounts for the demo sign-in screen |
| `get_account_member(account_id)` | Member for a demo login |
| `get_household(viewer_id, household_id)` | Household, plan tier, and the members this viewer may see |
| `set_household_plan(viewer_id, household_id, tier_id)` | Primary only switches the plan tier (others `AccessDenied`, unknown tier `NotFound`); returns the household |
| `get_member(viewer_id, member_id)` | One member |
| `can_access(viewer_id, member_id)` | True or False |
| `get_member_usage(viewer_id, member_id, plan_year=None)` | Usage for one person and year (zeros if none) |
| `record_visit(viewer_id, member_id, visit_date, description, billed_cents, plan_paid_cents, patient_paid_cents, procedure_code=None, deductible_applied_cents=0)` | Adds a visit and updates only that person's usage |
| `list_visits(viewer_id, member_id)` | Dental history |
| `get_member_context(viewer_id, member_id, chat_limit=20)` | Plan highlights, usage, history, preferences, must-haves, recent chat |
| `append_member_context(viewer_id, member_id, kind, text, role=None)` | kind is `preference`, `must_have` or `chat` (chat needs role `user` or `assistant`) |
| `list_upcoming_schedule(viewer_id, member_id=None, today=None)` | Appointments and reminders from today on |
| `create_invite(viewer_id, email, member_id=None)` | Primary only; adults 18+ only |
| `list_invites(viewer_id)` / `accept_invite(token)` | Primary lists; accepting gives the adult profile a login |
| `list_saved_plans(viewer_id, member_id)` | Saved Plan My Year plans, newest first |
| `create_saved_plan(viewer_id, member_id, name, items)` | Saves a plan, returns it |
| `update_saved_plan(viewer_id, member_id, plan_id, name=None, items=None)` | Renames or replaces items; unknown id raises `NotFound` |
| `delete_saved_plan(viewer_id, member_id, plan_id)` | Deletes one plan; unknown id raises `NotFound` |

Tests: `backend/tests/test_db.py` (temporary database).
