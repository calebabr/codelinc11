# Task T13: End-to-end and contract tests

**Role:** tests
**Read first:** agents/README.md, agents/tests-agent.md, agents/tasks/PLAN.md, docs/DEMO.md, docs/summaries/tests_summary.md, tests/README.md

## Goal
Prove the three demo moments and the API contract automatically, so a teammate's change that breaks them is caught.

## You may edit
`tests/` (e2e, contract, fixtures), and new test files only under `backend/tests/test_contract_*.py` and `frontend/src/**/*.test.tsx` that are not already owned. Do not change production code or existing golden expectations.

## Scope
- Contract tests (backend, pytest, TestClient): every endpoint in docs/ARCHITECTURE.md exists in `/openapi.json`; response shapes for `/auth/demo-login`, `/households/{id}`, `/members/{id}/overview`, `/schedule`, `/estimate`, `/annual-cost`; visibility rules (primary sees all, adult only self, Maya cannot sign in); the golden numbers (cleaning $0, crown $625 fresh, $800 with $1,100 used, OON $925 with $300 balance billing, plan-year $2,300 to $1,405 saves $895) through the HTTP API.
- Demo-moment test (backend): sign in as Alex, overview shows $400 left, schedule S2 gives the golden numbers, assistant `/chat` with a fake provider returns only tool-sourced numbers.
- Frontend: a smoke test per page that the app renders the six routes with a mocked session without console errors.
- Optional if time: a Playwright script under tests/e2e that runs the demo (document how to run; do not require it in CI).

## Acceptance checks
`cd backend && .venv/Scripts/python -m pytest -q` and `ruff check .` pass; `cd frontend && npm run test` passes. Report new test counts.

## Docs to update
tests/README.md.

## Report
Format in agents/README.md.
