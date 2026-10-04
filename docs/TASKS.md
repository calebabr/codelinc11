# Task Tracker
_Last updated: 2026-10-04 by the docs agent, after sprint 2 stories 1 to 4 and the notifications part of story 5_

Hard deadline: **hackathon demo, 2026-10-04 10:00 AM.** Plan: [../agents/tasks/PLAN.md](../agents/tasks/PLAN.md). Handoff: [../agents/HANDOFF.md](../agents/HANDOFF.md).

**Where the code is:** `main` is production (merged 2026-10-04 in pull request #11: Clerk sign-in removed, **Try the demo** is the only way in; backend on AWS, frontend on Netlify, see [DEPLOYMENT.md](DEPLOYMENT.md)). Sprint 2 work is on branch `sprint/family-providers-reports`, not yet merged to `main`. Plan: [sprints/SPRINT-2.md](sprints/SPRINT-2.md).

## Before the demo
- [ ] Rehearse [DEMO.md](DEMO.md) three times. **Owner: Caleb and team**, due 2026-10-04 10:00 AM
- [ ] Record a backup screen recording of the demo path. **Owner: Caleb**, due 2026-10-04 10:00 AM
- [ ] Capture README screenshots (list at the end of `README.md`). **Owner: design lead**
- [ ] Test the QR flow with one iPhone and one Android phone (see [DEMO-PHONES.md](DEMO-PHONES.md)); raise `RATE_LOGIN_PER_MINUTE` and `RATE_LOGIN_PER_HOUR` if many phones share one connection. **Owner: Caleb**, added 2026-10-03

## In Progress (sprint 2, see [sprints/SPRINT-2.md](sprints/SPRINT-2.md))
- [ ] Story 6 Find Providers page; story 7 quote to dentist matching; story 8 Reports page and the report Q&A page. **Owner: backend, frontend, ai agents**, added 2026-10-04
- [ ] Email and text actually sending. **Owner: backend agent**, added 2026-10-04
  - Context: stand-in today is preview only (`backend/app/notifier.py`, `PreviewNotifier`); a real sender (Amazon SES, Twilio) would plug into the `Notifier` interface
- [ ] Final docs pass and an independent review of sprint 2. **Owner: docs and review agents**, added 2026-10-04

## In Progress (earlier)
- [ ] Merge `feature/choose-a-plan` into `main` (commit the work, push, open a pull request). **Owner: Caleb**, added 2026-10-03
  - Context: built and tested (backend 391 passed, ruff clean, frontend 151 tests, typecheck and build clean). Not clicked through in a browser by a human for the "Which plan fits us?" step; no Playwright test. Nothing here has been pushed. `main` is what runs in production.
- [ ] Deploy `main` to AWS. **Owner: a teammate, using Kiro**, added 2026-10-03
  - Context: the teammate deploys `main`. `infra/aws/` (CloudFormation, runbook, deploy scripts) is only a reference kit and was not run in AWS. Anything that creates cloud resources or costs money needs the user's approval first.
- [ ] Review the synthetic odds in "Which plan fits us?" (rates in [MATH.md](MATH.md)). **Owner: M (human)**, added 2026-10-03

## In Progress (teammates)
- [ ] Text-to-speech for assistant answers. **Owner: Wrigley**, branch `fe/text-to-speech` off `integration/main-product`
- [ ] Login page redesign (optional; `frontend/src/pages/Login/LoginPage.tsx`). **Owner: Ulisses**

## Completed
- [x] Sprint 2 story 1: `$NaN` on "Log a visit" fixed. Story 2: bigger chat box. Story 3: pytest suite foundation (markers, 14 regression tests, coverage 96%). **Owner: frontend and tests agents**, completed 2026-10-04
- [x] Sprint 2 story 4: profiles and family members (date of birth, email, text number, ZIP, notes; add and remove members, demo family only), API and Family page screens. **Owner: backend and frontend agents**, completed 2026-10-04
- [x] Sprint 2 story 5, notifications part: backend (migrations 006 and 007, `notifications.py`, `notifier.py`, routes), bell with unread badge in the app bar, `/notifications` page with filters and per-person settings, Delivery preview list, Home card. **Owner: backend and frontend agents**, completed 2026-10-04
  - Outcome: backend 523 tests pass, ruff clean; frontend 205 tests, typecheck and build clean. `claim_update` and `eob_ready` kinds are defined but not generated yet. Email and text are previews only
- [x] Product name is Molar Money everywhere a user can see it (it was "bitewise" on the landing page and "Dental Benefits" in the app). Completed 2026-10-03
- [x] T36 to T38 Per-visitor demo families: `POST /auth/demo-login` with `sandbox`, 24 hour expiry, cap 300, `GET /auth/demo-accounts?household_id=`, `POST /demo/reset` for your own family only, `PUT /households/{id}/names`, one-tap **Try the demo** on the landing page and login, **Name your family**; demo accounts carry member status. **Owner: database, backend and frontend agents**, completed 2026-10-03
  - Outcome: the shared-family problem is solved; each visitor changes only their own copy. About 4.4 KB per copy
- [x] T37 Rate limiting (`backend/app/ratelimit.py`): per-household chat, global daily chat cap, sign-in per IP, compute, upload, reset; 429 with `Retry-After`. **Owner: backend agent**, completed 2026-10-03
  - Outcome: protects the Anthropic key. In memory, per process
- [x] T27 to T29 F7 Monte Carlo ("Which plan fits us?"): `engine/simulate.py`, `POST /simulate`, assistant tool `compare_plans`, Plans page section, docs. **Owner: backend, frontend and docs agents**, completed 2026-10-03
  - Outcome: Rivera household, average care: Basic 82% / Preferred 17% / Premium 1% cheapest; with Alex's crown, Preferred 54%
- [x] T31 Plan-comparison follow-ups: "Ask next" chips, plan terms in the tool result, percentage number guard. **Owner: AI agent**, completed 2026-10-03
- [x] T34 and T35 Saved plan comparisons (`/members/{id}/saved-simulations`, the server computes the summary) and "Save to Plan My Year" / "Saved plan comparisons". **Owner: backend and frontend agents**, completed 2026-10-03
- [x] Assistant chips "Summarize the plan simulations" and "How are the simulations calculated?" (up to 7 chips); "Questions to ask your dentist" is a plain list. Completed 2026-10-03
- [x] T39 to T41 Phone support: lazy-loaded pages (first load about 162 kB gzip), `viewport-fit`, 16 px inputs, 44 px targets, full-screen assistant panel, manifest and icons, `/join` Scan to try page, [DEMO-PHONES.md](DEMO-PHONES.md) (same Wi-Fi with `npm run dev:lan` and the Vite `/api` proxy, tunnel, public hosting), `CORS_ORIGINS` and `CORS_ORIGIN_REGEX`, `scripts/lan-url.*` and `scripts/make_qr.py`. Completed 2026-10-03
- [x] T30 AWS kit written (`infra/aws/`: CloudFormation, runbook, deploy scripts). **Owner: DevOps agent**, completed 2026-10-03
  - Outcome: not run in AWS; a reference only
- [x] Clear chat: `DELETE /members/{id}/chat`. Completed 2026-10-03
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
- [x] T15 Docs passes: README, DEMO, PRESENTATION, ARCHITECTURE, SETUP, MATH, PROJECT-STORY, TASKS, summaries, READMEs updated to the built product. Completed 2026-10-03

## Backlog (after the demo)
- [ ] **Access code idea (not built):** require a short code before a visitor can start a demo family, so a public link cannot be used to fill the sandbox cap or spend the assistant quota. **Owner: backend agent**, added 2026-10-03
- [ ] Rate limits live in memory in one process; a second server or a restart resets them. Move to a shared store if the app runs on more than one server. **Owner: backend agent**, added 2026-10-03
- [ ] Browser end-to-end test (Playwright) for the demo path; `tests/e2e` and `tests/contract` are empty. **Owner: tests agent**
- [ ] A frontend test (`SessionContext.test.tsx`, "sends a signed-out visitor to the login page...") timed out once on a full run under load and passes alone. Raise its wait or find the slow step. **Owner: frontend agent**, added 2026-10-03
- [ ] Run the CI workflow on GitHub for the first time; `scripts/dev.ps1` and `dev.sh` were only syntax-checked. **Owner: devops agent**
- [ ] Treatment builder and quote items default to "flexible"; consider asking the user for urgency. **Owner: frontend agent**
- [ ] Generate frontend types from `models.py` instead of hand-written types; remove unused shadcn components. **Owner: frontend agent**
- [ ] Hide the `/style` page in production; stop hard-coding golden figures on the landing page. **Owner: frontend agent**
- [ ] The "Viewing" member resets to the signed-in person on a full page reload. **Owner: frontend agent**
- [ ] Real plan values and FAIR Health fees (D7). **Owner: M (human)**
- [ ] `FEATURES.md` F5 says max 6 tool steps; code uses 5. **Owner: orchestrator**
