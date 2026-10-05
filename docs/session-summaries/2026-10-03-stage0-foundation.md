# Session summary: Stage 0 foundation (2026-10-03)

## What was done
Stage 0 of the build plan (`agents/tasks/PLAN.md`): four agents worked in parallel to lay the foundation of the main product, then the docs agent wrote the project docs (T15).

- **T01 Design:** portal tokens in `frontend/src/index.css`, style guide at `/style`, rules in `docs/design/portal-look.md`.
- **T02 Frontend:** portal shell, six routes, `/login` placeholder, member switcher, assistant button, mock Lincoln household; 10 tests.
- **T03 Integration:** Caleb's engine, search, quote parser, questions and agent seam ported; three plan tiers; keyword chat fallback removed; 148 backend tests.
- **T04 Database:** SQLite schema, seed and access layer for the Lincoln household; 17 tests.
- **T15 Docs:** README, SETUP, ARCHITECTURE, MATH, AI, DEMO, PRESENTATION, PROJECT-STORY, TASKS, summaries.

## Why
The hackathon demo is Sunday 2026-10-04 at 10:00 AM. The team merges four prototypes into one product, in stages, so each part can be checked.

## Key decisions
See `docs/decisions/README.md`: family (D1), sign-in (D2), API chatbot with Anthropic first (D3), six pages (D4), portal look (D5), three tiers (D6), server-side per-person context (D9), dental only (D10), deadline and demo priorities (D12, D13).

## Verified on 2026-10-03
- `backend`: `.venv/Scripts/python -m pytest -q` gives 148 passed; `ruff check .` clean.
- `frontend`: `npm run test` gives 10 passed.
- `POST /schedule` with scenario S2 (via TestClient, no server) gives 2300, 1405, 895. Crown with $1,100 used gives $800 in network.

## Files changed by the docs pass
`README.md`, `docs/README.md`, `docs/SETUP.md`, `docs/ARCHITECTURE.md`, `docs/MATH.md`, `docs/AI.md`, `docs/DEMO.md`, `docs/PRESENTATION.md`, `docs/PROJECT-STORY.md`, `docs/TASKS.md`, `docs/summaries/*`, this file, `frontend/README.md` (status note at top).

## Open issues
- Backend and frontend are not connected; the household API (T05) and AI assistant on Anthropic (T06) are not built.
- Six pages are placeholders (T07 to T12). Login UI is T17.
- `FEATURES.md` F5 says 6 tool steps; code uses 5. `FEATURES.md` mentions about 30 procedure codes; the data has 16.
- D7 (real plan data) and D8 (stored data location) are still open in the log.
- Not verified: Node version requirements, running the frontend against a live backend (nothing calls it yet), browser view of the shell (orchestrator checks that).

## Agents involved
| Agent | Task | Result |
|---|---|---|
| Design | T01 | Tokens, style guide, rules |
| Frontend | T02 | Shell, routes, mock session |
| Integration | T03 | Backend ported |
| Database | T04 | Schema, seed, access layer |
| Docs | T15 | This docs pass |
