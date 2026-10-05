# Tasks T36 to T38: every visitor gets their own demo household, plus rate limiting

**User request (2026-10-04):** new log ins should create their own household; add rate limiting; everyone in the audience should be able to demo the app on their own phone at the same time.

## Why
Today all visitors share one Lincoln household in one SQLite database. One person switching the plan, logging a visit or resetting the data changes it for everyone, and one open sign-in can spend the Anthropic key without limit.

## Design (decided)
- **Sandbox household per visitor.** A visitor's first sign-in clones the template Lincoln household (household, 4 members, accounts, usage, visits, appointments, preferences, saved plans, plan tier) into new rows with unique ids: `<template id>.<sid>` where `sid` is 6 lowercase hex characters (for example `m-alex.3f9a1c`, `hh-rivera.3f9a1c`). Chat memory starts empty. Plan tier starts as Preferred.
- **Backward compatible.** Without the new field behavior is unchanged (the shared template household), so the existing 300+ backend tests and `python -m app.db` keep working.
- **Storage:** SQLite, same file. Sandboxes expire after `DEMO_SANDBOX_TTL_HOURS` (default 24) and the oldest are evicted when more than `DEMO_MAX_SANDBOXES` (default 300) exist; cleanup runs lazily when a sandbox is created. Deleting a sandbox deletes all of its rows.
- **Rate limiting:** in-memory sliding windows (single server), configurable by environment, answering **429** with a `Retry-After` header and JSON `{"detail": "<friendly sentence>", "retry_after": <seconds>}`.

## Contract
`POST /auth/demo-login` body `{member_id, sandbox?: bool = false, household_id?: str}`
- `sandbox` false: unchanged.
- `sandbox` true and no `household_id`: create a sandbox from the template, sign in as the member that corresponds to `member_id` (a template id like `m-alex`). Response is today's `{token, member, household}` plus `sandbox: {household_id, expires_at}`; all ids in the response are the suffixed ones.
- `sandbox` true with `household_id`: reuse that sandbox if it exists and has not expired; `member_id` may be a template id (mapped to the suffixed one) or a suffixed one. Unknown or expired sandbox: **410 Gone** (the client then creates a new one).
- `GET /auth/demo-accounts?household_id=<sandbox id>` lists that sandbox's accounts (suffixed ids); without the parameter it lists the template accounts as today.
- `POST /demo/reset` (primary only) resets the **caller's own household**: for a sandbox, restore it to the template state in place (same ids, existing tokens stay valid); for the template household, as today.
- Tokens are still the signed member id (unique per sandbox), so visibility rules and everything else keep working unchanged.

Rate limits (all environment-configurable, defaults shown; key = the caller's household id from the token, falling back to the client IP):
| Route | Default |
|---|---|
| `POST /auth/demo-login` creating a sandbox | 10 per minute and 60 per hour per client IP |
| `POST /chat` | 12 per minute and 200 per day per household; **global** cap `CHAT_GLOBAL_DAILY_CAP` 3000 per day (protects the Anthropic key) |
| `POST /chat/attachments` | 5 per minute per household |
| `POST /simulate`, `POST /schedule`, `POST /estimate`, `POST /annual-cost`, `POST /members/{id}/visits` | 60 per minute per household |
| `POST /demo/reset` | 5 per minute per household |
Client IP is the socket address unless `TRUST_PROXY=1`, then the first hop of `X-Forwarded-For`.

## T37 backend: rate limiting (scope)
New `backend/app/ratelimit.py` (sliding window, thread-safe, injectable clock, a `reset_for_tests()` helper), applied as FastAPI **dependencies** on the routes above (edit only the router files, no middleware, so `main.py` stays untouched): `routers/chat.py`, `routers/simulate.py`, `routers/auth.py` (login creation limit is applied only when `sandbox` is true; T36 later adds the sandbox itself, so make the limiter a reusable function it can call), `routers/annual_cost.py`, `routers/treatment_plan.py` and the schedule and estimate routes in `main.py` ONLY via a one-line dependency if needed (otherwise skip them and say so), `routers/members.py` visits route. Tests in `backend/tests/test_ratelimit.py` using the injectable clock (429 with `Retry-After`, window expiry, per-household isolation, global chat cap, env overrides, `TRUST_PROXY`). Existing tests must keep passing: set a very high default in the test configuration (a `conftest.py` fixture or env) rather than weakening assertions. `.env.example` documents the new variables. Docs: `docs/AI.md` (cost protection), `docs/summaries/backend_summary.md`.

## T36 backend: sandboxes (scope, starts after T34 and T37 are done)
`backend/app/db/` (clone, reset-in-place, expiry and cap cleanup), `backend/app/routers/auth.py` (the new login behavior and `demo-accounts` parameter), `backend/app/routers/session.py` and `households.py` only if needed, `/demo/reset` scoping, `backend/tests/test_sandboxes.py` (clone has unique ids and the same numbers as the template; two sandboxes are isolated: a plan switch, visit, saved plan or reset in one does not touch the other or the template; template untouched; reuse by `household_id`; 410 for unknown or expired; TTL and cap eviction; tokens only see their own household; golden numbers still come out right inside a sandbox: Mary has $400 left, crown $800), `database/README.md`, `docs/summaries/backend_summary.md`, `docs/ARCHITECTURE.md`.

## T38 frontend (scope, starts after T35 and T36's contract is final)
`frontend/src/state/SessionContext.tsx`, `pages/Login/LoginPage.tsx`, `lib/api/*` where needed, `features/assistant/*` and any page that must show a 429 politely. Behavior: sign-in sends `sandbox: true` and remembers the sandbox `household_id` in `localStorage` (try/catch, versioned key) so a refresh or coming back reuses the same family; on 410 or unknown it creates a fresh one; **one-tap entry:** a large "Try the demo" button on the landing page (`/welcome`, hero and nav) and at the top of `/login` signs in as Abraham (the account holder) in a brand-new sandbox with no further choices (the three account cards stay below it for choosing Mary or Robert in the same family); a visitor with a remembered sandbox sees "Continue your demo family" instead; no sign-up form, email or password anywhere; "Start a fresh family" on the login page forgets it; the demo-accounts list is requested with the sandbox id; remove any hard-coded template member ids from logic (Robert's pending label must come from the account or member status, not from `m-noah`); on any 429 show a plain message with the wait time (chat: inside the conversation with a retry that waits), never a crash; a calm line on the login page and Home: "This is your own demo family. Changes you make don't affect anyone else." The shared `Reset demo data` button now says it resets your demo family. Tests: sign-in creates then reuses the sandbox, 410 recovery, 429 handling in chat, no literal template ids in logic, frontend suites stay green.

## All
Never run git write commands; do not start or stop servers; never read `backend/.env`; do not change golden numbers. Report in the format in agents/README.md.


## Addendum (2026-10-04): "Name your family" (cosmetic, part of T36 backend and T38 frontend)
**What the user sees:** right after the first "Try the demo" sign-in in a new family, a friendly optional card "Name your family" with four labeled fields, prefilled with the defaults and a "Skip" button: **You** (Abraham, the account holder), **Your spouse** (Mary), **Your young child** (Tad; "you manage their account") and **Your older child** (Robert; "too old to be a dependent, has their own account"). Also a "Family surname (optional)" field that changes "Lincoln household" to "<Surname> household". A "Use made-up names, this is a demo" helper line. Saving updates every screen. The same form is reachable later from the Family page ("Rename family", primary only).
**Contract (backend, T36):** `PUT /households/{id}/names` (bearer token, **primary only**, **sandbox households only**; the shared template household returns 403 so nobody can rename it) body `{household_name?: str, members: [{member_id: str, name: str}]}` returns the same shape as `GET /households/{id}`. Only the `name` of existing members of that household changes (ids, roles, ages, plan and usage never change). **Validation:** each name 1 to 24 characters after trimming, only letters (including accents), spaces, apostrophes, hyphens and periods; no digits, no angle brackets or other symbols (422 with a plain message). `household_name` same rules, max 30 characters, and the household display name becomes "<household_name> household" unless it already ends with the word household. Names are used as stored by the assistant context, suggestions, simulation and everything else, so make sure nothing hard-codes "Abraham", "Mary", "Tad", "Robert" or "Demo" outside seeds and tests (the assistant suggestions and simulation follow-ups already read names from the database; verify with grep and fix any literal in backend/app). Reset (`POST /demo/reset`) restores the default names.
**Why the strict characters:** names are placed into the assistant's prompt as context, so they must not be able to carry instructions or markup.
**Tests:** rename flows into overview, family page data, assistant context, `compare_plans` members and suggestions; non-primary 403; template household 403; invalid characters and length 422; ids unchanged; reset restores defaults.
