# Task Tracker
_Last updated: 2026-10-03 (evening) by the orchestrator, after a live check of every page_

Hard deadline: **hackathon demo, 2026-10-04 10:00 AM.** Plan: [../agents/tasks/PLAN.md](../agents/tasks/PLAN.md). Handoff: [../agents/HANDOFF.md](../agents/HANDOFF.md).

## Before the demo
- [ ] Rehearse [DEMO.md](DEMO.md) three times. **Owner: Caleb and team**, due 2026-10-04 10:00 AM
- [ ] Record a backup screen recording of the demo path. **Owner: Caleb**, due 2026-10-04 10:00 AM
- [ ] Decide whether to merge `integration/main-product` into `main` (pull request on GitHub). **Owner: Caleb**
- [ ] Capture README screenshots (list at the end of `README.md`). **Owner: design lead**

## In Progress (teammates)
- [ ] Text-to-speech for assistant answers. **Owner: Wrigley**, branch `fe/text-to-speech` off `integration/main-product`
- [ ] Login page redesign (optional; `frontend/src/pages/Login/LoginPage.tsx`). **Owner: Ulisses**

## Completed
- [x] T01 to T04 Stage 0: portal tokens, shell, backend port, household database. Completed 2026-10-03
- [x] T05 Household, demo sign-in, member overview, invites, `POST /annual-cost`, visits, saved plans, plan switching, demo reset. Completed 2026-10-03
- [x] T06 Per-person assistant on Anthropic (Ollama optional), suggestions, PDF attachments, tips and dentist-question pre-step. Completed 2026-10-03
- [x] T07 to T12 Home, Family, Plan My Year, Assistant, Costs, Plans pages on real data. Completed 2026-10-03
- [x] T14 Review (`docs/reviews/review-2026-10-03.md`) and fixes (login flow, chat auth, token expiry, seed-if-empty). Completed 2026-10-03
- [x] T16 CI workflow and dev scripts written (`.github/workflows/ci.yml`, `scripts/`). Completed 2026-10-03
- [x] T17 Login page on Ulisses's `AuthLayout` with demo accounts. Completed 2026-10-03
- [x] Landing page (Ulisses) and voice input (Wrigley) merged. Completed 2026-10-03
- [x] Live check of every page at desktop and 375 px: no sideways scrolling; golden numbers on screen. Completed 2026-10-03
- [x] Fix: the same "ask about a cheaper option" tip showed twice when a treatment was listed twice. Completed 2026-10-03
- [x] T15 Docs pass: README, DEMO, PRESENTATION, ARCHITECTURE, SETUP, MATH, PROJECT-STORY updated to the built product. Completed 2026-10-03

## Backlog (after the demo)
- [ ] Browser end-to-end test (Playwright) for the demo path; `tests/e2e` and `tests/contract` are empty. **Owner: tests agent**
- [ ] Run the CI workflow on GitHub for the first time; `scripts/dev.ps1` and `dev.sh` were only syntax-checked. **Owner: devops agent**
- [ ] Treatment builder and quote items default to "flexible"; consider asking the user for urgency. **Owner: frontend agent**
- [ ] Number guard checks `$` amounts only. **Owner: AI agent**
- [ ] Generate frontend types from `models.py` instead of hand-written types; remove unused shadcn components. **Owner: frontend agent**
- [ ] Hide the `/style` page in production; stop hard-coding golden figures on the landing page. **Owner: frontend agent**
- [ ] The "Viewing" member resets to the signed-in person on a full page reload. **Owner: frontend agent**
- [ ] Real plan values and FAIR Health fees (D7). **Owner: M (human)**
- [ ] `FEATURES.md` F5 says max 6 tool steps; code uses 5. **Owner: orchestrator**
