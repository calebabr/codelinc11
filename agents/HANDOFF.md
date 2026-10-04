# Handoff: pick up exactly where we stopped

_Rewritten 2026-10-03 (night) by the docs agent from the code and a test run. The demo is **Sunday 2026-10-04, 10:00 AM**. Caleb leads the team (git identity `calebabr`, `cjabrantes06@gmail.com`). Teammates: **Wrigley** (chatbot; owns text to speech), **Sai** (portal prototype; gets code as a tarball because git does not work for him), **Ulisses** (landing page and login design)._

## 0. State in one paragraph
The product is called **Molar Money**. All the work described below is on branch **`feature/choose-a-plan`**, which is **not pushed and not merged**. `main` is the production version; a teammate (using Kiro) deploys `main`. Merging to `main` is Caleb's call. When this file was written the changes were **uncommitted in the working tree** (about 159 changed or new paths) and, in the local clone I looked at, `main`, `origin/main`, `feature/choose-a-plan` and the checked-out branch `sprint/family-providers-reports` all pointed at the same commit (`a3568ea`); check `git status` and `git branch --show-current` before you trust a branch name. Last checks (2026-10-03): backend **391 tests pass**, ruff clean; frontend **151 tests** (on my full run 150 passed and one sign-in test, `SessionContext.test.tsx`, timed out under load; it passes alone, 6 of 6), typecheck and build clean (first JavaScript download about 162 kB gzip).

## 1. What changed since the last handoff (all verified live by the orchestrator, then re-checked by tests)
1. **Name:** Molar Money everywhere a user can see it (it was "bitewise" on the landing page and "Dental Benefits" in the app).
2. **Every visitor gets their own demo family.** `POST /auth/demo-login {member_id, sandbox, household_id}` clones the Rivera household (ids end in `.xxxxxx`, 24 hour expiry, cap 300, about 4.4 KB each; 410 when expired). `GET /auth/demo-accounts?household_id=`. `POST /demo/reset` restores only your own family. One-tap **Try the demo** on the landing page and `/login`. **Name your family** card on Home and `PUT /households/{id}/names` (primary only, demo copies only; names 1 to 24 characters: letters, spaces, apostrophes, hyphens, periods). Demo accounts carry member status. Code: `backend/app/db/sandbox.py`, `backend/app/routers/auth.py`, `households.py`; tests `backend/tests/test_sandboxes.py`.
3. **Rate limiting** (`backend/app/ratelimit.py`, in memory, per process): `RATE_LIMIT_ENABLED`, `RATE_LOGIN_PER_MINUTE` 10, `RATE_LOGIN_PER_HOUR` 60, `RATE_CHAT_PER_MINUTE` 12, `RATE_CHAT_PER_DAY` 200, `CHAT_GLOBAL_DAILY_CAP` 3000, `RATE_ATTACH_PER_MINUTE` 5, `RATE_COMPUTE_PER_MINUTE` 60, `RATE_RESET_PER_MINUTE` 5, `TRUST_PROXY`. Over a limit: 429 with `Retry-After`. All are in `.env.example`. Tests: `test_ratelimit.py`.
4. **Monte Carlo "Which plan fits us?"** (`POST /simulate`, `engine/simulate.py`, assistant tool `compare_plans` with `plan_terms`, "Ask next" follow-up chips, percentage number guard). **Saving a comparison** to Plan My Year: `POST/GET/PUT/DELETE /members/{id}/saved-simulations` (the server computes the summary). Spec: `docs/features/F7-choose-a-plan-monte-carlo.md`.
5. Assistant chips **Summarize the plan simulations** and **How are the simulations calculated?** (up to 7 chips). `DELETE /members/{id}/chat` clears a person's chat.
6. **Questions to ask your dentist** is a plain list.
7. **Phones:** lazy-loaded pages, `viewport-fit`, 16 px inputs, 44 px targets, full-screen assistant panel, manifest and icons, `/join` **Scan to try** QR page, `CORS_ORIGINS` and `CORS_ORIGIN_REGEX`, `scripts/lan-url.*`, `scripts/make_qr.py`, `npm run dev:lan`, [../docs/DEMO-PHONES.md](../docs/DEMO-PHONES.md) (mode A same Wi-Fi with the Vite `/api` proxy, mode B tunnel, mode C public hosting).
8. **AWS kit** in `infra/aws/` (CloudFormation, runbook, deploy scripts). It is a reference only and was **not run in AWS**; a teammate deploys `main`.

Counts: 36 API routes, 14 database tables over 4 migrations, 28 backend test files, 17 frontend test files.

## 2. What is a stand-in (say it plainly)
- The odds in "Which plan fits us?" are synthetic placeholders, not claims data (M to review the rates).
- Sign-in is a demo with no passwords. Anyone with the link can start a demo family.
- Rate limits are in memory in one process and reset on restart.
- One server and one SQLite file.
- All plan, fee and member data is synthetic (decision D7 open).

## 3. What is left, in order
1. **Caleb:** commit the work, push `feature/choose-a-plan`, open a pull request into `main`, merge when satisfied. Nobody else does this.
2. **A teammate with Kiro:** deploy `main` (the `infra/aws/` kit is only a reference).
3. **Humans:** click "Which plan fits us?" and the saved comparisons through in a browser (only tests and the API were checked for those); test the QR flow with a real iPhone and Android phone; rehearse [../docs/DEMO.md](../docs/DEMO.md) three times; record a backup video; capture the README screenshots.
4. **Access code idea (not built):** a short code before a visitor can start a demo family, so a public link cannot fill the sandbox cap or spend the assistant quota.
5. **Wrigley:** text to speech (`fe/text-to-speech`). **Ulisses:** optional login redesign.
6. Backlog is in [../docs/TASKS.md](../docs/TASKS.md): Playwright end-to-end tests, first CI run on GitHub, flaky sign-in test timeout, shared rate-limit store if more than one server, real plan values (D7).

## 4. Where everything is
- **Main folder:** `C:\Users\cal3b\OneDrive\FilesforCaleb\AuburnUniversity\codelinc11`. A spare worktree `.worktrees/main-product` (detached HEAD, older) holds a duplicate `backend/.env`; ignore it and do not use it.
- `backend/.env` (git-ignored) holds `ANTHROPIC_API_KEY`. **Never print it, paste it, or commit it.** A fresh clone needs its own key (ask Caleb privately). Without a key, chat says "unavailable" and everything else works.
- **Preserved prototypes (never edit, delete or rewrite):** `proto/dental-prototype`, `prototype/sai-benefits-portal`, `fe/chatbot`, `fe/router-pages`, `fe/landing`.
- Sai's tarball `main-product.tar.gz` (repo root, git-ignored) is a snapshot of `main`; rebuild it with `git archive --format=tar.gz --prefix=codelinc11-main-product/ -o main-product.tar.gz HEAD` and check it holds no `.env`, no key, no `.venv`, no `node_modules`.

## 5. How to run and verify
- Backend (Python 3.11), from `backend/`: `python -m venv .venv`; `.venv/Scripts/python -m pip install -r requirements.txt`; `.venv/Scripts/python -m app.db --reset`; `.venv/Scripts/python -m uvicorn app.main:app --port 8000` (copy `.env.example` to `backend/.env` first). Mac/Linux: `.venv/bin/python`. **No `--reload`** on Windows (leaves an orphan process).
- Frontend (Node 20), from `frontend/`: `npm install`; `npm run dev` (http://localhost:5173/welcome); `npm run dev:lan` for phones.
- Checks: `cd backend && .venv/Scripts/python -m pytest -q && .venv/Scripts/python -m ruff check --no-cache .` (391 tests, about 2 minutes); `cd frontend && npm run typecheck && npm run test && npm run build`.
- URLs: `/welcome` landing, `/join` Scan to try, `/login` (Try the demo, then Jordan, Alex or Noah), then `/`, `/plans`, `/family`, `/costs`, `/plan-year`, `/assistant`. API docs: http://localhost:8000/docs.
- Golden numbers (Preferred plan; never change them to make code pass): cleaning **$0**; crown fresh year **$625**; crown with $1,100 used **$800**; out of network fresh year **$925** ($300 balance billing); Plan My Year **$2,300 to $1,405, saves $895**. Which plan fits us (Rivera, average care, seed 42): Basic 82%, Preferred 17%, Premium 1%; with Alex's crown Preferred 54%.

## 6. How to continue with agents
Open Claude Code in the main folder and paste:
> You are the orchestrator. Read `agents/HANDOFF.md`, `agents/SESSION-STATE.md`, `agents/orchestrator.md`, `agents/README.md` and `docs/TASKS.md`. Check `git status` and the current branch first. Verify every result yourself (tests, build, browser). Commit and push only when I ask.

Agents are started with: "You are the `<role>` agent. Read `agents/README.md` and `agents/<role>-agent.md`, then do `agents/tasks/<file>`." Give parallel agents separate files. Roles: frontend, backend, ai, database, design, tests, docs, devops, integration, review (briefs in `agents/`). Only the orchestrator runs git.

## 7. Rules the user set (follow them)
- **Git work is under Caleb's name and account only.** Follow the attribution rule in the current session's instructions; never force-push; never edit prototype branches. Commit and push only when asked.
- Never paste or commit the API key. The key lives only in `backend/.env`.
- Do not run teammates' external code unless Caleb says "go ahead"; read it instead. A permission block means ask, do not work around it.
- No blame or rankings of teammates; refer to them by name and role.
- Prefer interactive visuals (cards, tapping) over dropdowns; plain feature lists over scorecards; plain language, estimate disclaimer on every result; never recommend delaying urgent care.
- Anything that creates cloud resources or costs money needs the user's approval first.
- If a question to the user is dismissed, stop and wait.

## 8. Decisions (full log `docs/decisions/README.md`)
| Topic | Decision |
|---|---|
| Family | Each person has their own usage, history, preferences and chat memory, in a server database (SQLite). |
| Login | Demo sign-in on the real data model (households, roles, invites). Adults 18+ can have their own account; the primary sees everyone; children are managed by a parent. Every visitor gets a private demo family. |
| Chat | Anthropic first (default model `claude-haiku-4-5`), Ollama optional, no keyword answers. The model never does math; it calls the engine through tools. |
| Pages | Home, Plans, Family, Costs, Plan My Year, Assistant, plus an assistant button everywhere, a landing page and a Scan to try page. |
| Look | Portal look (burgundy `#650030`, orange `#FF4F17`); landing keeps its own scoped `.landing` look. |
| Plans | Basic, Preferred, Premium. Preferred is the golden demo plan with a $50 deductible. The primary can switch the family plan; reset with "Back to Preferred" or the demo reset. Dental only. |
| Data | All plan, fee and member data is synthetic. |

## 9. Gotchas learned
- Long Windows paths break some git commands; use short paths or feed files by stdin. `tar` on Windows needs `--force-local`.
- Git allows a branch in only one worktree/folder.
- OneDrive can lock an empty folder during a branch switch ("Deletion of directory failed"): answer `n`, then check the branch.
- A blank page after installing packages means restart Vite. The backend reads `.env` only at start.
- Many phones on one connection share one sign-in rate limit (10 a minute per address by default): raise `RATE_LOGIN_PER_MINUTE` and `RATE_LOGIN_PER_HOUR` for a room, or set `TRUST_PROXY=1` behind a tunnel.
- Phones block the microphone on plain `http://`; voice input needs HTTPS (a tunnel).
- Agents' docs written before the code exists are unreliable; have the docs agent read the code. Test with realistic inputs.
- Prompt-only fixes for the assistant did not hold against the real model; the tips, dentist-question and plan-comparison flows are deterministic code pre-steps in `backend/app/agent/loop.py`.
