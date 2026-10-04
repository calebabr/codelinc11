# Task T15: Docs pass (rerun after each stage)

**Role:** docs
**Read first:** agents/README.md, agents/docs-agent.md, docs/README.md, agents/tasks/PLAN.md, docs/decisions/README.md, docs/design/portal-look.md, docs/prototypes/PORT-NOTES.md, `database/README.md`, `frontend/README.md`, and the code itself.

## Goal
Write the project docs so a presenter, a recruiter and a new teammate can each use them. Run once now (Stage 0 facts), and again after later stages.

## Facts to document now (Stage 0, verified by the orchestrator)
- **Design (T01):** portal tokens in `frontend/src/index.css`, style guide at `/style`, rules in `docs/design/portal-look.md`.
- **Frontend (T02):** shell with six routes (`/`, `/plans`, `/family`, `/costs`, `/plan-year`, `/assistant`), `/login` placeholder, member switcher, assistant button; mock Halog household in `SessionContext`; 10 frontend tests. Old prototype pages remain unrouted in `frontend/src/pages/` until ported.
- **Backend (T03):** Caleb's engine, search, quote parser, questions and agent seam ported; three tiers (`basic`, `preferred`, `premium`); keyword fallback removed (chat reports "unavailable" without a model); 148 backend tests pass; golden numbers G1-G6 and S2 pass.
- **Database (T04):** SQLite via `backend/app/db/`, schema `database/migrations/001_households.sql`, seed `database/seeds/demo_household.json` (Halog household: Marc, AC, Sophia, Hannah), 17 tests, access rules (primary sees all, adults see themselves, managed members have no login).
- **Not built yet:** household API (T05), AI assistant on Anthropic (T06), the six real pages (T07 to T12), login UI (Ulisses, T17), CI.

## You may edit
Everything listed in `agents/docs-agent.md` under "You may edit". Create `docs/summaries/`, `docs/session-summaries/`, `docs/TASKS.md`, `docs/DEMO.md`, `docs/PRESENTATION.md`, `docs/ARCHITECTURE.md`, `docs/SETUP.md`, `docs/PROJECT-STORY.md`; update `docs/MATH.md` and `docs/AI.md` only with what exists.

## You must not touch
Code, tests, `docs/design/`, `docs/decisions/`, `docs/prototypes/`, `docs/reviews/`, `agents/`.

## Acceptance checks
- Every file path, command and endpoint you mention exists (check with the repo).
- `docs/DEMO.md` and `docs/PRESENTATION.md` clearly mark which demo moments are not built yet, and use the golden numbers exactly.
- The root `README.md` reads well as a GitHub landing page and lists test counts you verified.
- `docs/TASKS.md` lists the not-built items above with owners and the 2026-10-04 10:00 AM deadline.

## Docs to update
All of the above.

## Report
Format in agents/README.md. List anything not verified.
