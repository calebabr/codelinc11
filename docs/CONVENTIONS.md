# CONVENTIONS.md: Rules for Every Person and Every AI Agent

Every agent instruction file points here: `CLAUDE.md` (Claude Code), `.kiro/steering/` (Kiro), Bob's project rules. Keep it short. Details live in [FEATURES.md](FEATURES.md), [FRONTEND.md](FRONTEND.md) and [BACKEND.md](BACKEND.md).

## Stack
- **Frontend:** React + Vite + TypeScript, Tailwind, shadcn/ui, TanStack Query, Recharts. Tests: Vitest, React Testing Library, MSW, Playwright.
- **Backend:** Python 3.11+, FastAPI, Pydantic v2, pytest, hypothesis, ruff.

## Who does what
- **Agents write the code, tests and docs.** Humans direct, check and approve.
- Edit only your own folders (see the roster in FEATURES.md §1). If you need a change elsewhere, stop and tell your human.
- When a task is done, report: what changed, which tests ran and passed, and **exactly what your human should check** (a URL to open, a number to compare against FEATURES.md §2).

## Hard rules
1. **All money math lives in `backend/app/engine/`.** The LLM and the frontend never compute dollar amounts.
2. **Never change the golden numbers** (FEATURES.md §2 and the expected values in `backend/tests/test_engine.py`) to make code pass. Only the engine agent edits that test file, with M's approval.
3. **`backend/app/models.py` is the API contract.** Only CS1's workstream changes it; announce changes in `#contract`; the frontend regenerates types with `npm run gen:api`.
4. **No secrets in code, commits or chats.** Use `.env`; commit `.env.example`.
5. **Every change comes with tests**, and tests pass before a task is called done.
6. **Update docs** when behavior changes.

## Git
- Branch names: `fe/<thing>`, `api/<thing>`, `engine/<thing>`, `ai/<thing>`, `data/<thing>`.
- Small commits with clear messages. PR to `main` every 60–90 minutes. CS1 merges. `main` must always run.
- Parallel agents on one machine: use a separate git worktree for each.

## Commands
- Backend: `uvicorn app.main:app --reload --port 8000` · `pytest -q` · `ruff check .`
- Frontend: `npm run dev` · `npm run typecheck` · `npm run build` · `npm run test` · `npm run e2e` · `npm run gen:api`

## Product wording
- Plain language, calm tone, about an 8th-grade reading level.
- Every result shows: "This is an estimate. Your actual cost depends on your dentist's charges and claim review."
- Never recommend delaying urgent care.
