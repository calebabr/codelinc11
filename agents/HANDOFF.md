# Handoff: pick up exactly where we stopped

Written 2026-10-03 late evening by the orchestrator session, at the user's request ("stop work, someone else picks up exactly where we left off"). The demo is **Sunday 2026-10-04, 10:00 AM**. Caleb leads the team (git identity `calebabr`, `cjabrantes06@gmail.com`). Teammates: **Wrigley** (chatbot; owns text to speech), **Sai** (portal prototype; gets code as a tarball because git does not work for him), **Ulisses** (landing page and login design).

## 0. Read this first: state in one paragraph
Branch **`integration/main-product`** (pushed, last commit `04462d2`, "Merge main (Wrigley's speech-to-text)…") contains the whole merged product: portal shell, six real pages, backend with engine, household database, assistant on Anthropic, saved plans, plan switching, demo sign-in on a login page, landing page (`/welcome`), and Wrigley's voice input (mic button). It already contains everything on `main` (Ulisses's landing page, Wrigley's PR #5). **Nothing is half-done in the working tree.** Last full checks: backend **261 tests pass**, ruff clean; frontend **75 tests pass**, typecheck and build clean. The product has **not been merged into `main`**; that is Caleb's decision.

## 1. Where everything is
- **Main folder:** `C:\Users\cal3b\OneDrive\FilesforCaleb\AuburnUniversity\codelinc11`, on `integration/main-product`. Use this one.
- **Spare copy:** `.worktrees/main-product` (detached HEAD at `cff515d`, older). Safe to delete once Caleb confirms his main folder runs: `git worktree remove --force .worktrees/main-product`. It holds a duplicate `backend/.env`.
- `backend/.env` (git-ignored) holds `ANTHROPIC_API_KEY`. **Never print it, paste it, or commit it.** A fresh clone needs its own (ask Caleb privately). Without a key, chat says "unavailable" and everything else works.
- **Preserved prototypes (never edit, delete or rewrite):** `proto/dental-prototype` (Caleb, `059bce9`), `prototype/sai-benefits-portal` (`055c51c`), `fe/chatbot` (Wrigley), `fe/router-pages`, `fe/landing` (Ulisses). `main` is untouched by us except via the teammates' own pull requests.
- **Servers running at stop time** (start by background shell, may be gone in a new session): backend `uvicorn` on port 8000 from the main folder (no `--reload`); Vite on 5173 from the main folder. If a port is stuck on Windows, find and kill the orphan python child by parent id; stop Vite by port with PowerShell `Get-NetTCPConnection -LocalPort 5173` then `Stop-Process`.
- Sai's tarball: `main-product.tar.gz` in the repo root (git-ignored), built from `1a36e5b`, before the latest commits. Rebuild for him with `git archive --format=tar.gz --prefix=codelinc11-main-product/ -o main-product.tar.gz HEAD`, then check it contains no `.env`, no key (grep for the key value), no `.venv`, no `node_modules`.

## 2. Run and verify
- Backend (Python 3.11), from `backend/`: `python -m venv .venv`; `.venv/Scripts/python -m pip install -r requirements.txt`; `.venv/Scripts/python -m app.db --reset` (rebuilds demo data; also seeds automatically when empty); `.venv/Scripts/python -m uvicorn app.main:app --port 8000`. On Mac/Linux use `.venv/bin/python`. **Do not use `--reload`** (leaves an orphan process on Windows).
- Frontend (Node 20), from `frontend/`: `npm install`; `npm run dev`; open http://localhost:5173. Restart Vite after installing packages.
- Checks: `cd backend && .venv/Scripts/python -m pytest -q && .venv/Scripts/python -m ruff check --no-cache .`; `cd frontend && npm run typecheck && npm run test && npm run build`.
- URLs: `/welcome` landing, `/login` demo accounts (Jordan account holder, Alex adult, Noah waiting for approval; Maya has no login), then `/` Home, `/plans`, `/family`, `/costs`, `/plan-year`, `/assistant`. API docs at http://localhost:8000/docs. A demo reset is `POST /demo/reset` (primary only) or the "Reset demo data" button on Home.
- Golden numbers (Preferred plan; never change them to make code pass): cleaning **$0**; crown fresh year **$625**; crown with $1,100 used **$800**; out of network fresh year **$925** ($300 balance billing); plan-year scenario **$2,300 → $1,405, saves $895**. Alex starts with $1,100 used ($400 left).
- Live checks that passed this session: Alex crown = $800 in chat, root canal dentist questions answer immediately (`find_procedure` then `get_dentist_questions`), chat without a token = 401, plan switch Preferred ↔ Basic changes Alex's overview and switches back, saved plan for Alex is seeded, Alex gets 403 on Jordan's data.

## 3. What was done (high level)
Stage 0 foundation (design tokens, shell, ported backend, SQLite household DB) → Stage 1 (household API, assistant, Home, Family, Plan My Year, Costs, Plans, Assistant pages) → real session wiring → landing merge → saved plans + plan switching + Family connectors + clearer labels → review fixes (login flow, saved visits via `POST /members/{id}/visits`, chat auth, token expiry, seed-if-empty, assistant dialog, invite wording) → Wrigley's voice input merged. Task briefs and reports live in `agents/tasks/`; the full record is `docs/TASKS.md`, `docs/session-summaries/`, and the review `docs/reviews/review-2026-10-03.md`.

## 4. What is left, in order
1. **Look at the new screens in a browser** (nothing below was seen live by a human or the orchestrator): Family tree connectors (a measurement at a 308 px-wide pane showed the page scrolling sideways, `scrollWidth` 369; **likely a horizontal overflow bug on small screens**, check at 375 px and fix in `frontend/src/features/family/FamilyTree.tsx`), the Plans "Switch to this plan" flow, saved plans and the sticky treatments column in Plan My Year, the new login page on Ulisses's `AuthLayout` (`frontend/src/pages/Login/LoginPage.tsx`), the assistant panel dialog, the mic button.
2. **Rerun the docs agent** (`agents/tasks/T15-docs-pass.md`): docs are stale on test counts (now 261 backend / 75 frontend), saved plans, plan switching, Family labels, login flow, assistant tips and questions, voice input, `POST /members/{id}/visits`, `POST /demo/reset`, auth for `/chat`. Also `docs/DEMO.md` should start with landing → login → pick Jordan. `docs/PRESENTATION.md` and `README.md` (resume-ready) need the final numbers and a screenshots list.
3. **Text to speech** is **Wrigley's** (branch `fe/text-to-speech` off `integration/main-product`, PR into it). Voice *input* is done.
4. **Ulisses** may keep redesigning the login (`LoginPage.tsx`, self-contained). His Clerk sign-in was intentionally not wired in (demo sign-in uses our household database); his original Clerk files remain on `fe/landing`.
5. **Decision for Caleb:** merge `integration/main-product` into `main` (open a pull request on GitHub under his account). `main` currently has Wrigley's older chatbot structure; the integration branch already merged it, so a PR should be clean. Do not merge on his behalf without being asked.
6. **Remaining review items** (`docs/reviews/review-2026-10-03.md`): builder and quote items default to "flexible" so the scheduler can move unlabeled care to next year; the number guard checks `$` amounts only; no Playwright end-to-end test; frontend types are hand-written; unused shadcn components (one `<select>`); `/style` page is routed live; the landing page hard-codes golden figures; the CI workflow (`.github/workflows/ci.yml`) has never run on GitHub; `scripts/dev.ps1` and `dev.sh` were only syntax-checked.
7. **Demo rehearsal** three times from `docs/DEMO.md`; keep a backup recording; the assistant needs internet and the key (fallback: the `/docs` API page). Do not start the backend with `--reload` on stage.

## 5. How to continue with agents
Open Claude Code in the main folder and paste:
> You are the orchestrator. Read `agents/HANDOFF.md`, `agents/SESSION-STATE.md`, `agents/orchestrator.md`, `agents/README.md`, `agents/tasks/PLAN.md` and `docs/TASKS.md`. Start with item 1 of section 4 of the handoff: check the new screens in the browser at desktop and 375 px, fix what is wrong with a frontend agent, then run the docs agent. Verify every result yourself (tests, build, browser). Commit and push to `integration/main-product` only when I ask.

Agents are started with: "You are the `<role>` agent. Read `agents/README.md` and `agents/<role>-agent.md`, then do `agents/tasks/<file>`." Give parallel agents separate files. Roles: frontend, backend, ai, database, design, tests, docs, devops, integration, review (briefs in `agents/`). Only the orchestrator runs git.

## 6. Rules the user set (follow them)
- **Git work is under Caleb's name and account only. Never add Claude as author or co-author** (no `Co-Authored-By` trailer). Never force-push. Never edit prototype branches. Commit and push only when asked; the user asked for periodic pushes of `integration/main-product` so teammates can work, never to `main`.
- Never paste or commit the API key. The key lives only in `backend/.env`.
- Do not run teammates' external code unless Caleb says "go ahead"; read it instead. A permission block means ask, do not work around it.
- No blame or rankings of teammates; refer to them by name and role.
- Prefer interactive visuals (cards, tapping) over dropdowns; plain feature lists over scorecards; plain language, estimate disclaimer on every result; never recommend delaying urgent care.
- If a question to the user is dismissed, stop and wait.

## 7. Decisions (full log `docs/decisions/README.md`)
| Topic | Decision |
|---|---|
| Family | Each person has their own usage, history, preferences and chat memory, in a server database (SQLite). |
| Login | Demo sign-in on the real data model (households, roles, invites). Adults 18+ can have their own account; the primary sees everyone; children are managed by a parent. |
| Chat | Anthropic first (default model `claude-haiku-4-5`), Ollama optional, no keyword answers. The model never does math; it calls the engine through tools. |
| Pages | Home, Plans, Family, Costs, Plan My Year, Assistant, plus an assistant button everywhere and a landing page. |
| Look | Portal look (burgundy `#650030`, orange `#FF4F17`); landing keeps its own scoped `.landing` look. |
| Plans | Basic, Preferred, Premium. Preferred is the golden demo plan with a $50 deductible. The primary can switch the family plan; reset with "Back to Preferred" or the demo reset. Dental only. |
| Data | All plan, fee and member data is synthetic. |

## 8. Gotchas learned
- Long Windows paths break some git commands; use short paths or feed files by stdin. `tar` on Windows needs `--force-local`.
- Git allows a branch in only one worktree/folder; that is why the main folder could not switch until the worktree was detached.
- OneDrive can lock an empty folder during a branch switch ("Deletion of directory failed"): answer `n`, then check the branch.
- A blank page after installing packages means restart Vite. The backend reads `.env` only at start.
- Agents' docs written before the code exists are unreliable; have the docs agent read the code. Test with realistic inputs.
- Prompt-only fixes for the assistant did not hold against the real model; the tips and dentist-question flow is a deterministic code pre-step in `backend/app/agent/loop.py`.
