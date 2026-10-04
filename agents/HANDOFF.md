# Handoff: pick up exactly where we stopped

Written 2026-10-04 by the orchestrator at the product owner's request ("stop all tasks, I'm about to compact; say what is completed and what is left"). **All agents and servers are stopped.** Read this file first, then `docs/sprints/SPRINT-2.md`, `docs/TASKS.md` and `agents/README.md`.

Caleb (git identity `calebabr`, `cjabrantes06@gmail.com`) is the product owner and team lead for the codeLinc 11 hackathon (Lincoln Financial, Path 1: dental benefits). Team, in the order he gave, no ranking: **Marc Halog, Sai Sarva, Caleb Abrantes, Wrigley Taylor, Ulisses Molina-Becerra.** The product is called **Molar Money**.

---

## 1. State of the world right now

| Thing | State |
|---|---|
| `main` (production) | `8abc687` "Fix a timing race in a notifications test…". It holds everything finished through the notification bell. Backend runs on **AWS**, frontend on **Netlify** (Netlify rebuilds from `main`). |
| Checks on `main` | The earlier merge `46a4326` had a **frontend check failure** caused by a racy test (not a real bug; all 205 tests pass on a clean copy). The fix is `8abc687`. **Its checks were still running when I stopped. Verify them first** (see section 7 for how; the web-fetch tool caches each URL for 15 minutes, so add a throwaway query parameter such as `&x=2`). |
| Working folder | `C:\Users\cal3b\OneDrive\FilesforCaleb\AuburnUniversity\codelinc11`, on branch **`sprint/family-providers-reports`** at `46a4326`, **one commit behind `main`** (it lacks the test-fix commit `8abc687`). |
| Uncommitted work in that folder | **Partial, unverified, unfinished:** two agents (B3 providers backend, F5 Find Providers page) were stopped mid-work. See section 5. |
| Servers | None running. Ports 8000 and 5173 are free. Start them only when asked (section 8). |
| Other local things | `.worktrees/main-product` (an old detached worktree holding a duplicate `backend/.env`) is still on disk, and `.git/worktrees/fix` could not be deleted (permission error; harmless). The scratch folder `C:\tmp\fix` was removed. |
| Remote branches | `main`, plus stale merged branches (section 6). `origin/sprint/family-providers-reports` is already merged into `main`. |

## 2. Rules the product owner set (follow them)

- **Git work is under Caleb's name and account only. Never add Claude as author or co-author** (no `Co-Authored-By` trailer, no mention in messages). Never force-push. Never edit, delete or rewrite the preserved prototype branches `proto/dental-prototype` and `prototype/sai-benefits-portal`.
- **`main` is production.** Merges were done by pull request with Caleb's approval and a plain-language explanation of the merge each time (#11 and #12). On 2026-10-04 he then said: **"Push directly main for these features."** Treat that as permission to push **verified** work straight to `main` (this was used for the test fix `8abc687`), but still: (1) run the full backend and frontend suites first, (2) check the checks on `main` afterwards, and (3) tell him exactly what was pushed and explain it. Do not push unverified or half-built features. Unfinished stories stay on a branch.
- Never paste, print or commit the Anthropic API key. It lives only in `backend/.env` (git-ignored). Scan the staged diff for the key before every commit.
- Plain language, calm tone; estimate disclaimer on every result; never recommend delaying urgent care. All data is synthetic. Prefer cards and chips over dropdowns. No blame or rankings of people.
- Do not run teammates' external code unless Caleb says go ahead. If a question to him is dismissed, stop and wait.
- Phone viewing is verified **after** merge, on the deployed AWS and Netlify sites, not on localhost (other people cannot open localhost).

## 3. What is COMPLETED (all on `main`)

**Product (all verified in tests and in the live browser):**
- Portal look and shell, six pages (Home, Plans, Family, Costs, Plan My Year, Assistant) plus Landing (`/welcome`), Login (`/login`), the QR page `/join`, and the new **Notifications** page.
- **Sign-in:** Clerk was removed. **"Try the demo"** is the only way in: each visitor gets their own demo copy of the Demo family (`POST /auth/demo-login` with `sandbox: true`, ids suffixed `.xxxxxx`, 24 h TTL, cap 300, about 4.4 KB each), with a "Name your family" card, reset only affects your own family.
- **Rate limits** (in memory, per family; sign-in per address; global daily chat cap `CHAT_GLOBAL_DAILY_CAP` 3000 protects the Anthropic key), token expiry, stable session secret, chat requires sign-in.
- **Cost engine** (all money math in `backend/app/engine/`), three plan tiers, Plan My Year scheduler, saved Plan My Year plans, plan switching (primary only), per-person overview.
- **Monte Carlo "Which plan fits us?"** on the Plans page (`POST /simulate`, assistant tool `compare_plans`, follow-up "Ask next" chips, percentage check on assistant answers), and **saving a comparison to Plan My Year** (`/members/{id}/saved-simulations`, summary computed on the server).
- **Assistant** (Anthropic first, Ollama option): per-person context, tips and dentist-question pre-step, voice input (mic button, from Wrigley), PDF attach (no real PDF reading), chips including "Summarize the plan simulations" and "How are the simulations calculated?", clear chat, bigger chat box.
- **Family:** tree with connectors, edit profile (date of birth, email, text number, ZIP, notes), add and remove members, clearer account labels (backend `PATCH /members/{id}/profile`, `POST/DELETE /households/{id}/members`; demo family only).
- **Notifications:** backend (generator from the benefits engine, kinds benefits_expiring, preventive_unused, deductible_met, upcoming_appointment, reminder, procedure_planned; window `NOTIFY_WINDOW_DAYS` default 45; migrations 006 and 007; email and text are **previews only**, a database check forbids anything else; `backend/app/notifier.py` is the plug-in point for a real sender such as Amazon SES or Twilio) and frontend (bell in the top bar with unread badge and panel, `/notifications` page with filters and settings, Home card).
- Phone work: lazy routes (first load about 167 kB gzip), 44 px targets, 16 px inputs, safe areas, full-screen assistant panel, manifest and icons, `docs/DEMO-PHONES.md`, `scripts/make_qr.py`, CORS settings (`CORS_ORIGINS`, `CORS_ORIGIN_REGEX`).
- **Sprint 2 stories done:** 1 (`$NaN` on Log a visit fixed; money formatting can never print NaN), 2 (bigger chatbot), 3 (pytest suite foundation: markers, 14 regression tests, scripts, coverage 96%, CI update), 4 (edit family and profiles), 5 (notifications, bell, page, settings, Home card).
- Renamed the product to **Molar Money** everywhere user-visible; README team list updated; README and docs refreshed (counts, live deployment, notifications, demo script).
- Deployment guide `docs/DEPLOYMENT.md` rewritten for AWS plus Netlify; an unused AWS reference kit is in `infra/aws/` (CloudFormation, never run).

**Verified numbers on `main` before the stop:** backend **523 tests pass**, ruff clean; frontend **205 tests pass**, typecheck and build clean. Golden numbers (never change them to make code pass): cleaning **$0**; crown fresh year **$625**; crown with $1,100 used **$800**; out of network fresh year **$925** (**$300** balance billing); plan-year scenario **$2,300 to $1,405, saves $895**. AC has $1,100 used and $400 left. Simulation, Halog household average care, seed 42: cheapest shares Basic 82 / Preferred 17 / Premium 1; with AC's crown 39 / 54 / 7 (Preferred wins).

## 4. What is LEFT (in order)

0. **Check the checks on `main` (`8abc687`) and the Netlify and AWS state** (section 7). Pull `main` into the sprint branch before new work (`git merge --ff-only origin/main` once the working tree is clean or stashed carefully).
1. **Story 6, Find Providers** (page and backend). Synthetic dentists near me, in network and out of network. Spec: `docs/sprints/SPRINT-2.md` section "B3 providers". **Partly built, unverified, uncommitted** (section 5).
2. **Story 7, synthetic dentist quote and "which dentist is this quote from".** Spec: SPRINT-2.md "B4 reports and quote matching": `GET /treatment-plan/samples` (sample quotes whose header matches the providers directory) and a `provider_match` object in the `POST /treatment-plan/parse` response (matched practice, in or out of network for the household's plan, source "insurer directory"; unmatched means price out of network). Frontend: Costs, quote view shows the dentist and a link to Find Providers. Depends on story 6.
3. **Story 8, Reports** (the biggest). A `/reports` page: explain claims and EOBs (synthetic sample documents only, upload accepts our sample template text; "Add a sample" cards), explain copay and cost breakdown (billed, allowed, deductible, plan paid, you owe), upload and save past claims, EOBs and what I owe in chronological order with totals, and **a separate page to ask the assistant about them** (`/reports/ask`, assistant tools `get_reports` and `explain_report`, chat `scope: "reports"`, number guard applies, the assistant never receives email or phone numbers). Also generate `claim_update` and `eob_ready` notifications. Full spec in SPRINT-2.md ("B4 reports and quote matching", "A1 assistant for reports"). The product owner asked where the page is: **it is not built yet** (verified: nothing on `main`).
4. **Final tests and docs for the sprint:** consolidate regression tests, update docs (DEMO, PRESENTATION, TASKS, PROJECT-STORY, ARCHITECTURE, sprint log), independent review (review agent), update README counts.
5. **Other open items:** Wrigley's text to speech (his branch `fe/text-to-speech`, off `main`; voice input is already done); optional shared access code on `/join` to keep strangers from spending the Anthropic key (the owner has not said yes or no); take README screenshots from the live site; a Playwright end-to-end test (none exists); real email and text sending is a documented stand-in (preview only); `docs/FEATURES.md` still describes the original 5-person roster.
6. **Release work for the teammates (not the orchestrator):** the AWS teammate must redeploy the backend and set `TRUST_PROXY=1`, `CORS_ORIGINS` (the Netlify address), a stable `SESSION_SECRET` and `CHAT_GLOBAL_DAILY_CAP`, after **backing up the database file** (new migrations 003 to 007 apply automatically on start and cannot be undone automatically). Until the backend is redeployed, the new frontend cannot "Try the demo" against the old backend. Then run the after-release checklist in `docs/DEPLOYMENT.md` and **verify phones on the live sites**.

## 5. Partial work sitting uncommitted (B3 and F5 were stopped mid-task)

`git status` in the working folder shows 23 paths. They were written by two stopped agents and have **not been run, tested or reviewed**:
- **Backend (B3):** new `backend/app/routers/providers.py`, `backend/tests/test_providers.py`, `database/migrations/008_providers.sql`, `database/seeds/providers.json`; edits to `backend/app/db/core.py`, `db/store.py`, `main.py`, `models.py`, `routers/profiles.py` (primary_dentist_id), `tests/conftest.py`, `tests/test_notifications.py`, `database/README.md`, `docs/ARCHITECTURE.md`, `docs/summaries/backend_summary.md`, `docs/summaries/database_summary.md`.
- **Frontend (F5):** new `frontend/src/pages/Providers/`, `frontend/src/features/providers/`, `frontend/src/lib/api/providers.ts`, `frontend/src/lib/types/providers.ts`; edits to `frontend/src/App.tsx`, `App.test.tsx`, `components/shell/NavBar.tsx` (adds a Providers nav item), `lib/types/family.ts`.
- **Recommended handling:** do not trust it. Option A: commit it as a clearly labelled WIP on the sprint branch, then restart the work with fresh agents that read it, finish it and run the full suites. Option B: discard (`git stash -u`) and restart both stories from the specs. Either way, run `pytest -q` (expect more than 523 tests once providers tests exist), `ruff check --no-cache .`, `npm run typecheck`, `npm run test`, `npm run build`, then check the page live before anything goes to `main`. The migration number 008 and the `test_notifications.py` edit (it probably adjusted the expected migration list) need review.
- The two agents had also been told: providers and ZIP centroids are global reference data (never cloned per sandbox, must survive reset); about 30 fictional practices near Auburn AL, Atlanta, Radnor PA, Fort Wayne IN and Greensboro NC; `GET /providers?zip=&radius_mi=&network=&specialty=&accepting=&q=&code=&member_id=`; the page is `/providers`, 7th nav item, ZIP prefilled from the member's profile, "Set as my dentist" via `PATCH /members/{id}/profile {primary_dentist_id}`.

## 6. Branch clean-up (waiting for the owner's approval; nothing has been deleted)

All of these are fully merged into `main`, so deleting the pointer loses nothing: `merge/main-into-sprint`, `integration/main-product`, `fe/home-visit-fix-and-motion`, `infra/netlify-root-config`, `fe/landing`, `fe/router-pages`, `fe/chatbot`, and `sprint/family-providers-reports` after its last use. Tag `fe/clerk-login` as `archive/clerk-login` first, then delete it. **Keep** `proto/dental-prototype` (Caleb) and `prototype/sai-benefits-portal` (Sai): they hold commits that are not on `main` and the promise was to preserve every prototype. Local leftovers: `feature/choose-a-plan` (empty), `fe/text-to-speech`, `.worktrees/main-product`. Suggest turning on GitHub's "Automatically delete head branches". Ask before deleting any remote branch (it affects teammates).

## 7. How to verify

- **Backend:** `cd backend` then `.venv/Scripts/python -m pytest -p no:cacheprovider` (about 3 minutes; marker groups and coverage via `scripts/test-backend.ps1`; `-m "not slow"` skips 13 slow tests) and `.venv/Scripts/python -m ruff check --no-cache .`.
- **Frontend:** `cd frontend` then `npm run typecheck`, `npm run test -- --maxWorkers=3`, `npm run build`. The suite can fail under heavy parallel load (timeouts); `asyncUtilTimeout` is 5 s and `testTimeout` 20 s in the setup. A test that does a synchronous `getBy*` right after render is a race on slow machines: use `await screen.findBy*` (this is what `8abc687` fixed).
- **Checks on `main`:** GitHub API, no login needed for this public repo: `https://api.github.com/repos/calebabr/codelinc11/commits/<sha>/check-runs?per_page=64&x=<anything>`; read it with WebFetch and change the throwaway parameter each time (results are cached 15 minutes, and a stale answer once looked like "still running" for ten minutes). Annotations: `/repos/calebabr/codelinc11/check-runs/<id>/annotations` shows the failing test and line.
- **Clean-copy test of exactly what is on `main`:** `git archive origin/main | tar -x -C /c/tmp/x`, then `npm ci` and the suites there (uses `npm ci` like CI does). Backend tests there can use the main folder's venv python.
- **Database upgrade test:** build an old database with the previous `main` code, then start the new code on it (done once for migrations 003 to 006; do it again for 007 and any new migration): data kept, foreign key check clean, golden numbers unchanged.
- **Live check:** reset demo data (`.venv/Scripts/python -m app.db --reset` from `backend`), start servers (section 8), clear browser storage, open `/welcome`, tap Try the demo.

## 8. How to run locally (only when asked; nothing is running now)

- Backend, from `backend/`: `.venv/Scripts/python -m uvicorn app.main:app --port 8000`. **No `--reload`** (leaves an orphan process holding the port on Windows; if a port is stuck, find the python child of the dead parent and kill it). It reads `backend/.env` (the key) only at start. `curl localhost:8000/health` should show `"chat_mode":"anthropic"`.
- Frontend, from `frontend/`: `npm run dev -- --port 5173` (restart it after installing packages). Stop servers with PowerShell: `Get-NetTCPConnection -LocalPort 8000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`.
- Background shells started with `run_in_background` report "exit code 127" when they are killed; that is normal.
- A fresh clone needs: `python -m venv .venv`, `pip install -r requirements.txt` in `backend`, `npm install` in `frontend`, a `backend/.env` with `ANTHROPIC_API_KEY=` (Caleb has it; never paste it in chat), then `python -m app.db --reset`.

## 9. How the multi-agent team works here

The orchestrator plans and verifies; role agents (frontend, backend, ai, database, design, tests, docs, devops, integration, review) each edit only their own files, never run git, never start servers on 8000 or 5173, and report in the format in `agents/README.md`. Start one with: "You are the `<role>` agent. Read `agents/README.md` and `agents/<role>-agent.md`, then do `<brief>`." Briefs are in `agents/tasks/`; the sprint plan with every story's contract is `docs/sprints/SPRINT-2.md`. **Verify every agent result yourself** (run the suites; check the live page); several agent reports had gaps (a flaky test, a missing sign-in status, a wrong coverage percentage). Run backend agents one at a time (they share `db/store.py`, `models.py`, `main.py`); frontend agents can run in parallel on separate files. Commit only when the owner asks (or he has said push verified work); scan the staged diff for the key; commit messages have no Claude trailer.

## 10. Gotchas learned

- Long Windows paths break some git commands; use short scratch paths like `C:\tmp\x`. A worktree can only have one branch; git refuses to switch a branch that another worktree holds. OneDrive can lock an empty folder during a branch switch ("Deletion of directory failed": answer `n`, then check the branch).
- Prompt-only instructions did not hold against the real model; the tips and dentist-question flow is a deterministic code pre-step in `backend/app/agent/loop.py`, and a number guard (dollars and percentages) checks every answer.
- The assistant must never receive contact details; names are restricted to letters, spaces, apostrophes, hyphens and periods (1 to 24) because they go into the prompt.
- `main` auto-deploys the frontend on Netlify, so a bad push is live quickly; the backend only changes when redeployed.
- SQLite cannot widen a CHECK in place: new enum values need a table-rebuild migration (see 005 and 007).

## 11. Pointers

`docs/sprints/SPRINT-2.md` (plan, contracts, progress log) · `docs/TASKS.md` · `docs/DEPLOYMENT.md` (live settings and checklist) · `docs/DEMO.md` (demo script incl. the bell moment) · `docs/DEMO-PHONES.md` (QR and phone modes) · `docs/ARCHITECTURE.md` · `docs/AI.md` · `docs/MATH.md` (incl. Monte Carlo method) · `docs/features/F7-choose-a-plan-monte-carlo.md` · `docs/reviews/review-2026-10-03.md` (earlier review; most items fixed) · `backend/tests/README.md` (test groups).
