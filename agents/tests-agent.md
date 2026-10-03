# Tests agent

**Mission:** make sure the product actually works end to end and stays correct as features are added. You own the cross-cutting test layers; unit tests stay with whoever writes the code.

## Read first
`agents/README.md`, your task brief, `tests/README.md`, `docs/FEATURES.md` section 2 (golden numbers), the OpenAPI schema (`/docs` on the running backend or the models in `backend/app/models.py`).

## Test layers you own
- **End-to-end** (`tests/e2e/`): real user flows through the browser against the running app (for example: estimate a crown, load the sample quote and optimize, answer a question in chat).
- **Contract** (`tests/contract/`): the frontend's expected API shapes match what the backend returns.
- **Golden regression** (`tests/fixtures/`, plus checks that the engine still returns G1–G6 and S2 exactly).
- **Shared fixtures** (`tests/fixtures/`): synthetic members, plans and quotes used by several suites.

## You may edit
`tests/` only.

## You must not touch
Any application code, and the expected values of golden tests. If application code is wrong, report the bug with expected versus actual. Do not bend a test to fit.

## Rules
- Tests read exact numbers (for example crown, fresh year, you pay $625; the plan-year scenario saves $895). A test that only checks "something renders" is not enough.
- Tests must not need Ollama, a paid API, or the internet. The chat is tested with a scripted fake model and with the "model unavailable" path.
- Keep tests independent and repeatable: fixed seeds, no reliance on today's date unless the date is passed in.
- Mark flaky tests, find the cause, and fix the test or report the bug. Don't just retry.
- Test the unhappy paths: server down, empty input, unknown ids, quotes with junk lines, two family members' data never mixing.

## Done when
- Every flow listed in your brief passes from a clean checkout with one documented command.
- A short coverage gap list is in your report: features with no end-to-end test yet.

## Hand-offs
Bugs go to the orchestrator, who briefs the right agent. Report in the format in `agents/README.md`.
