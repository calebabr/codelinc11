# Build Plan: main product for the Sunday 10:00 AM demo

Written 2026-10-03, about 15 hours before the demo. **Nothing here is started.** The orchestrator starts a stage only when the user asks. Decisions behind this plan are in `docs/decisions/README.md`.

## What we're building
A signed-in household in a portal-style app (Sai's look). Six pages: **Home**, **Plans**, **Family**, **Costs**, **Plan My Year**, **Assistant** (plus a chat button on every page). Each family member has their own data and assistant context, stored in a server database. The assistant is a real model (Anthropic first, Ollama as the local option). Caleb's engine and API are the base; ideas from Sai and Wrigley are rebuilt on top.

## Demo priorities (from the user)
1. **Sign in and see each family member's own view.** (P0)
2. **Plan My Year.** (P0)
3. **Personalized assistant per person**, with suggested questions. (P0)
4. Costs page: estimate, dentist quote, savings tips, questions to ask your dentist. (P1)
5. Plans comparison, annual cost calculator, PDF upload. (P1)
6. Invites, polish of the upcoming schedule. (P2)

If time runs short, cut from the bottom. Never cut tests for P0 items or fake a result.

## Stages and tasks
Tasks marked **parallel** touch separate files and can run together. Each brief is in this folder.

| Stage | Task | Role | Depends on | Priority |
|---|---|---|---|---|
| **0 Foundation** | [T01 Portal tokens and style guide](T01-design-portal-tokens.md) | design | none | P0 |
| | [T02 Portal shell and six routes](T02-frontend-shell.md) | frontend | none (uses agreed token names) | P0 |
| | [T03 Port Caleb's backend onto main](T03-integration-backend-port.md) | integration | none | P0 |
| | [T04 Households, members and context in the database](T04-database-household.md) | database | none (parallel with T03) | P0 |
| **1 Core** | [T05 Household, auth and overview API](T05-backend-household-api.md) | backend | T03, T04 | P0 |
| | [T06 Provider interface and per-person assistant](T06-ai-assistant.md) | ai | T03, T04 | P0 |
| | [T07 Home page and member switcher](T07-frontend-home.md) | frontend | T02, T05 | P0 |
| | [T08 Family page](T08-frontend-family.md) | frontend | T02, T05 | P0 |
| | [T09 Plan My Year page](T09-frontend-plan-year.md) | frontend | T02, T03 | P0 |
| | [T10 Assistant page and global chat button](T10-frontend-assistant.md) | frontend | T02, T06 | P0 |
| | [T11 Costs page](T11-frontend-costs.md) | frontend | T02, T03 (calculator needs T05) | P1 |
| | [T12 Plans page](T12-frontend-plans.md) | frontend | T02, T05 | P1 |
| **2 Wrap-up** | T13 End-to-end and contract tests | tests | T07–T10 | P0 |
| | T14 Review and fix list | review | T07–T12 | P0 |
| | T15 Docs, architecture and demo script | docs | all | P1 |
| | T16 CI, run script, environment | devops | T03 | P1 |
| | T17 Login UI (Ulisses, by hand) | Ulisses | T02 pushed, T05 | P0 |

T13–T16 get their own briefs when Stage 1 is done.

## Order of work
1. Stage 0 runs as one parallel group. **As soon as T01 and T02 pass, the orchestrator pushes the integration branch so Ulisses can start the login UI.**
2. Stage 1 starts when T03 and T04 land (T05 and T06 need them). The page tasks T07–T12 start as their dependencies land and run in parallel on separate page folders.
3. Stage 2 runs once the P0 pages work. The orchestrator checks everything itself and does a browser click-through at each checkpoint.

## Shared contracts (every brief relies on these; the owning agent keeps them current)

### Look (T01 defines, T02 and all pages use)
CSS variables and matching Tailwind names: `--burgundy #650030`, `--burgundy-dark #45001f`, `--orange #FF4F17`, `--orange-dark #d93d0a`, `--ink #1c1c1e`, `--muted #5f6368`, `--line #e6e1e3`, `--soft #faf6f7`, `--ok #1a7f4b`, `--warn #b26a00`. Pages use tokens, never raw colors.

### Data (T04 owns the schema; T05 exposes it)
- **Household:** id, name, plan tier (`basic` | `preferred` | `premium`), members.
- **Member:** id, household id, name, relationship (`self` | `spouse` | `child`), age, full-time student, status (`active` | `pending`), role (`primary` | `adult` | `managed`), has login (adults 18 and over only), per-person plan-year **usage** (maximum used, deductible met, visits), eligibility by service.
- **Per-person context:** plan highlights, history of procedures and what was paid, preferences and must-haves, chat memory. Stored in the database.
- **Visibility:** the primary account holder can read **everything** for everyone in the household. An adult with a login reads their own data. A managed member (under 18) has no login.
- **Demo household** (fictional, from Sai's data): Jordan Rivera (41, primary), Alex Rivera (39, spouse), Maya Rivera (9, managed), Noah Rivera (23, child, pending student verification). Seeds must give **Alex** a starting usage of $1,100 used and deductible met so Plan My Year reproduces $2,300 to $1,405 (saves $895). The demo clock is fixed to **November** so timing advice is stable.

### Plans (T03 and T04)
Preferred is the golden demo plan: deductible $50, maximum $1,500, preventive 100%, basic 80%, major 50%. Basic and Premium use the numbers in `docs/decisions/README.md` (D6).

### API (T05 and T06 own; the frontend codes against these)
| Endpoint | Purpose |
|---|---|
| `GET /auth/demo-accounts`, `POST /auth/demo-login` | Demo sign-in: choose an account, get a session |
| `GET /households/{id}` | The household, its members and roles |
| `GET /members/{id}/overview` | Plan, usage, benefits left, reminder, eligibility for one person |
| `GET /members/{id}/schedule` | Upcoming care and reminders |
| `POST /households/{id}/invites` | Invite an adult (demo-level) |
| `GET /plans` | The three tiers |
| `POST /annual-cost` | Yearly cost for a tier, household size and expected care, computed by the engine |
| `POST /estimate`, `POST /schedule`, `POST /savings-tips`, `POST /questions`, `POST /treatment-plan/parse` | Caleb's endpoints, carried over |
| `POST /chat` (streamed), `GET /chat/suggestions?member_id=` | Assistant for the active member |
| `POST /chat/attachments` | Upload a PDF for the assistant (sample documents only) |

### Frontend file layout (so parallel page tasks never collide)
Each page task owns `frontend/src/pages/<Page>/` and `frontend/src/features/<page>/`, its API calls in `frontend/src/lib/api/<page>.ts`, and its types in `frontend/src/lib/types/<page>.ts`. Only T02 edits the router, app shell and shared context.

## Cutline
- **Must work at 10:00 AM:** T01–T10, with tests (T13).
- **Next:** T11, T12, PDF upload (inside T06 and T10).
- **If still on schedule:** invites, schedule polish.
