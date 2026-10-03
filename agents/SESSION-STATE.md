# Orchestrator session state (handoff to myself)

Read this first after a context compaction or a new session. It records where the project stands so no decision or lesson is lost. Update it at each checkpoint. Written 2026-10-03 evening; the demo is **Sunday 2026-10-04, 10:00 AM**.

## Who the user is
Caleb (git identity `calebabr`, `cjabrantes06@gmail.com`), team lead at the codeLinc 11 hackathon (Lincoln Financial, Path 1: dental benefits). Teammates: **Wrigley** (chatbot, family profiles), **Sai** (portal prototype tarball), **Ulisses** (router shell, theme, now building the login UI). Refer to teammates by name; never rank or blame them.

## Where everything is
- Repo: `C:\Users\cal3b\OneDrive\FilesforCaleb\AuburnUniversity\codelinc11` (GitHub `calebabr/codelinc11`).
- **Main product work happens in a git worktree:** `.worktrees/main-product`, branch `integration/main-product`, based on `origin/main` (`21d16eb`). The worktree is excluded locally via `.git/info/exclude`. The main checkout sits on `proto/dental-prototype`.
- **Uncommitted:** the scaffolding in the worktree (agents/, database/, tests/, infra/, docs decisions and prototypes, README, CLAUDE.md) and everything agents write. Commit and push **only when Caleb asks**.
- **Pushed prototypes (never edit, delete or rewrite):** `proto/dental-prototype` (Caleb, commits `c70b4f7`, `059bce9`), `prototype/sai-benefits-portal` (`055c51c`, standalone, with the tarball), `fe/chatbot` and `main` (Wrigley, PR #3), `fe/router-pages` (Ulisses, `71379b6`).
- Caleb's backend and frontend source to port: `git show proto/dental-prototype:<path>`.
- Memory notes are saved in the session memory folder (preserve-prototypes-before-merge, prototype-feature-catalog).

## Decisions (full log: `docs/decisions/README.md`)
Family with per-person context (usage, history, preferences, chat memory) in a **server database**; **demo sign-in** on a real data model (households, roles, invites; adults 18+ can have a login by invite; the primary sees everything); **Anthropic first**, Ollama as the local option, **no keyword chatbot**; PDF upload with **sample documents only**; **six pages** (Home, Plans, Family, Costs, Plan My Year, Assistant) plus a global chat button; **Sai's portal look** (burgundy `#650030`, orange `#FF4F17`); **three tiers**, Preferred is the golden plan with a **$50 deductible**; dental only. Demo priorities: (1) sign in and see each member's own view, (2) Plan My Year, (3) personalized assistant per person.

## The plan
`agents/tasks/PLAN.md` (stages, dependencies, shared contracts, cutline) and briefs `T01`–`T12`. T13–T16 briefs are still to be written; T17 is Ulisses (login UI).
- Stage 0, parallel: T01 design tokens, T02 shell, T03 port Caleb's backend, T04 database.
- Stage 1: T05 backend household API, T06 AI assistant, then T07 Home, T08 Family, T09 Plan My Year, T10 Assistant, T11 Costs, T12 Plans.
- Stage 2: T13 tests, T14 review, T15 docs, T16 CI.
- After T01 and T02 pass, Caleb must push `integration/main-product` so Ulisses can build the login in the new structure.

## How I run agents (see `agents/orchestrator.md`)
Start agents with: "You are the `<role>` agent. Read `agents/README.md` and `agents/<role>-agent.md`, then do `agents/tasks/<file>`." Give disjoint file lists. Agents never run git. **I verify every result myself**: backend `pytest -q` and `ruff check .`; frontend `npm run typecheck`, `npm run test`, `npm run build`; then the browser. Golden numbers (Preferred): cleaning $0; crown fresh year $625; crown with $1,100 used $800; out of network fresh year $925 ($300 balance billing); plan-year scenario $2,300 → $1,405, saves $895.

## Environment prepared in the worktree
- `backend/.venv` with fastapi, uvicorn, pydantic, httpx, python-dotenv, pytest, ruff, sqlmodel, anthropic, python-multipart.
- `frontend/node_modules` plus vitest, Testing Library and jsdom; `test` script and `vitest.config.ts` added.
- `ANTHROPIC_API_KEY` goes in `backend/.env` (Caleb adds it; it is never pasted in chat or committed). Agents run tests without a key.

## Lessons learned (avoid repeating)
- **Windows path length:** very long scratch paths break `git worktree add` and `git hash-object <path>`; use short paths or feed files by stdin.
- **tar on Windows:** use `--force-local` or the `C:` is read as a remote host.
- **Vite orphan:** stopping the npm wrapper leaves the Vite process holding port 5173; kill by port with PowerShell.
- **Servers:** background commands time out; start with a long timeout and report when stopped. Backend without `--reload` serves old code until restarted.
- **Agent docs written before the code exist are unverified:** have the docs agent read the code.
- **Parser bug found by testing a realistic quote** (header date read as a procedure); always test realistic inputs.
- External code (a teammate's tarball, branches) is read, not run, unless Caleb says "go ahead"; a permission block means ask him, do not work around it.
- AskUserQuestion can be dismissed; if so, stop asking and wait. Caleb prefers plain feature lists, not scorecards or tech comparisons.

## Caleb's stated preferences
Interactive visuals over dropdowns; likes the savings tips and questions-to-ask-your-dentist; likes the features of his earlier pages but not the look (look and layout, clutter and extra steps, hard-to-read charts, not portal-like); wants git work under his name and account with no Claude co-author; wants every prototype preserved before merging; no blame or rankings of people.

## Current status (update me)
- [x] Decisions recorded, folders and agent briefs created, build plan and T01–T12 written, handoff for teammates written (`agents/HANDOFF.md`).
- [x] Worktree environment ready (backend venv with deps, frontend `node_modules`, vitest, `test` script, `vitest.config.ts` and `src/test/setup.ts`).
- [ ] **NEXT ACTION (after the user compacts and says go): start Stage 0 as four parallel background agents (T01 design, T02 frontend, T03 integration, T04 database), using the prompt in "How I run agents". Then verify everything myself and report.** Do not start Stage 1 until T03 and T04 have landed and passed.
- [ ] Stage 0 agents (T01–T04) started and verified.
- [ ] `integration/main-product` pushed for Ulisses (needs Caleb's go-ahead).
- [ ] Stage 1, Stage 2.
