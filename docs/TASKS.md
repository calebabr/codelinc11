# Task Tracker
_Last updated: 2026-10-03 by stage0-foundation (docs pass T15)_

Hard deadline: **hackathon demo, 2026-10-04 10:00 AM.** Plan: [../agents/tasks/PLAN.md](../agents/tasks/PLAN.md). Cut from the bottom if time runs short; never cut tests for P0 items or fake a result.

## In Progress
- [ ] T05 Household, auth and overview API. **Owner: backend agent**, due 2026-10-04 10:00 AM
  - Context: not started. Needs T03 and T04 (both done). Adds demo sign-in, household, member overview and schedule, invites, `POST /annual-cost`. Wires `backend/app/db/` into the API.
- [ ] T06 Provider interface and per-person assistant (Anthropic first, Ollama second). **Owner: AI agent**, due 2026-10-04 10:00 AM
  - Context: not started. Replaces the seam in `backend/app/agent/loop.py`. Needs a key in `backend/.env` (added by Caleb, never in chat). Adds `/chat/suggestions` and `/chat/attachments`.
- [ ] T07 Home page and member switcher with real data. **Owner: frontend agent**, due 2026-10-04 10:00 AM
  - Context: needs T05. Shell and mock switcher exist.
- [ ] T08 Family page. **Owner: frontend agent**, due 2026-10-04 10:00 AM (needs T05)
- [ ] T09 Plan My Year page. **Owner: frontend agent**, due 2026-10-04 10:00 AM
  - Context: the engine and `POST /schedule` are ready, so this can start now. Must show $2,300 to $1,405, save $895.
- [ ] T10 Assistant page and global chat button. **Owner: frontend agent**, due 2026-10-04 10:00 AM (needs T06)
- [ ] T11 Costs page (P1). **Owner: frontend agent**, due 2026-10-04 10:00 AM (calculator needs T05)
- [ ] T12 Plans page (P1). **Owner: frontend agent**, due 2026-10-04 10:00 AM (needs T05)
- [ ] T13 End-to-end and contract tests. **Owner: tests agent**, due 2026-10-04 10:00 AM
  - Context: `tests/e2e`, `tests/contract`, `tests/fixtures` are empty. Needs T07 to T10.
- [ ] T14 Review and fix list. **Owner: review agent**, due 2026-10-04 10:00 AM
- [ ] T16 CI, run script, environment. **Owner: devops agent**, due 2026-10-04 10:00 AM
  - Context: `.github/workflows/` is empty. Planned checks: `ruff check .`, `pytest -q`, `npm ci`, `npm run typecheck`, `npm run test`, `npm run build`.
- [ ] T17 Login UI. **Owner: Ulisses (by hand)**, due 2026-10-04 10:00 AM
  - Context: `/login` is a placeholder route in `frontend/src/App.tsx`. Needs the integration branch pushed and T05.
- [ ] T15 Docs pass, rerun after each stage. **Owner: docs agent**
  - Context: Stage 0 pass done 2026-10-03. Rerun after T05, T06, T09 and update `DEMO.md`, `PRESENTATION.md`, `ARCHITECTURE.md`, `AI.md` and the summaries.

## Completed
- [x] T01 Portal tokens and style guide. **Owner: design agent**, completed 2026-10-03
  - Outcome: tokens in `frontend/src/index.css`, style guide at `/style`, rules in `docs/design/portal-look.md`.
- [x] T02 Portal shell and six routes. **Owner: frontend agent**, completed 2026-10-03
  - Outcome: six routes, `/login` placeholder, member switcher, assistant button, mock Rivera household; 10 frontend tests.
- [x] T03 Port Caleb's backend onto main. **Owner: integration agent**, completed 2026-10-03
  - Outcome: engine, search, quote parser, questions, agent seam; three tiers; keyword fallback removed; 148 tests pass; golden numbers G1 to G6 and S2 pass.
- [x] T04 Households, members and context in the database. **Owner: database agent**, completed 2026-10-03
  - Outcome: SQLite schema and seed for the Rivera household, access layer, 17 tests.
- [x] T15 Docs pass, Stage 0. **Owner: docs agent**, completed 2026-10-03
  - Outcome: README, SETUP, ARCHITECTURE, MATH, AI, DEMO, PRESENTATION, PROJECT-STORY, summaries and a session summary.

## Backlog
- [ ] Remove old unrouted prototype pages from `frontend/src/pages/` once ported. **Owner: frontend agent**, added 2026-10-03
  - Context: `Chatbot`, `Coverage`, `Dashboard`, `Estimate`, `GetStarted`, `Home.tsx`, `PlanYear.tsx`, `Profiles` still exist.
- [ ] Remove or update stale text in `frontend/README.md` (top sections still describe the old prototype). **Owner: frontend agent**, added 2026-10-03
- [ ] `FEATURES.md` F5 says max 6 tool steps; code uses 5. Decide which is right. **Owner: orchestrator**, added 2026-10-03
- [ ] Real plan values and FAIR Health fees (D7). **Owner: M (human)**, added 2026-10-03
- [ ] Stored data location (D8) is still marked open in the decision log although the database exists. **Owner: orchestrator**, added 2026-10-03
- [ ] Capture screenshots for the README and a backup demo recording. **Owner: design lead**, added 2026-10-03
- [ ] Add `.env.example` entries for `OLLAMA_*`, `BENEFITS_DB_PATH` and `VITE_API_URL` (names are in `infra/README.md`). **Owner: devops agent**, added 2026-10-03
- [ ] Invites UI and schedule polish (P2). **Owner: frontend agent**, added 2026-10-03
