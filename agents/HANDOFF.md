# Handoff: run, check and finish the main product

For anyone picking this up with their own Claude Code session. Updated 2026-10-03 night. The demo is **Sunday 2026-10-04, 10:00 AM**. Most of the product is **built and tested**; what is left is listed in section 5.

## 1. What exists
A dental benefits app for a signed-in family (the Rivera household: Jordan, Alex, Maya, Noah), in a portal look.
- **Pages:** Landing (`/welcome`), Home, Plans, Family, Costs, Plan My Year, Assistant, plus an assistant button on every page, and a demo sign-in at `/login`.
- **Backend (FastAPI):** the cost engine (all money math), three plan tiers, a SQLite household database, demo sign-in, per-member overview, annual cost, saved Plan My Year plans, plan switching, and an assistant (Anthropic first, Ollama as an option) that calls the engine through tools. Latest checks: **244 backend tests**, frontend tests all passing, build and ruff clean.
- **Docs:** `README.md`, `docs/DEMO.md` (the 10:00 AM script), `docs/PRESENTATION.md`, `docs/PROJECT-STORY.md`, `docs/ARCHITECTURE.md`, `docs/SETUP.md`, `docs/AI.md`, `docs/MATH.md`, `docs/TASKS.md`, `docs/summaries/`, `docs/reviews/review-2026-10-03.md` (the code review with a ranked fix list).
- **Prototypes are preserved** on branches: `proto/dental-prototype` (Caleb), `prototype/sai-benefits-portal` (Sai), `fe/chatbot` (Wrigley), `fe/router-pages` and `fe/landing` (Ulisses). Never edit, delete or rewrite them.

## 2. Get the code
```bash
git clone https://github.com/calebabr/codelinc11.git
```
Then in the folder: `git fetch --all`, `git switch integration/main-product`, and make your own branch with `git switch -c <your-branch>`. Pull requests go **into `integration/main-product`, not `main`**.

## 3. Set up and run (Windows paths; on Mac/Linux use `.venv/bin/python`)
- **Backend (Python 3.11):** from `backend/`: `python -m venv .venv`, then `.venv/Scripts/python -m pip install -r requirements.txt`.
- **Key:** create `backend/.env` with one line `ANTHROPIC_API_KEY=<key>` (no quotes). Ask Caleb for the key. **Never paste it into chat, a commit or an issue.** `.env` is git-ignored. Without a key the chat says "unavailable" and everything else works. Ollama is optional.
- **Database:** from `backend/`: `.venv/Scripts/python -m app.db --reset` (deletes and rebuilds the demo data).
- **Run the backend** from `backend/`: `.venv/Scripts/python -m uvicorn app.main:app --port 8000`. **Do not use `--reload`**: on Windows it leaves an orphan process holding port 8000. If port 8000 is stuck, kill the leftover python child process.
- **Run the frontend** (Node 20) from `frontend/`: `npm install` then `npm run dev`, and open http://localhost:5173. Restart `npm run dev` after installing new packages.
- Scripts `scripts/dev.ps1` and `scripts/dev.sh` do this in one go (they were just added; not yet run end to end).

## 4. Check it works
- Backend: `cd backend`, then `.venv/Scripts/python -m pytest -q` and `.venv/Scripts/python -m ruff check .`.
- Frontend: `cd frontend`, then `npm run typecheck`, `npm run test`, `npm run build`.
- Golden numbers (Preferred plan): cleaning **$0**; crown, fresh year **$625**; crown with $1,100 used **$800**; out of network, fresh year **$925** (of which $300 is balance billing); plan-year scenario **$2,300 to $1,405, saves $895**. Never change them to make code pass.
- In the browser: switch members and confirm numbers change with the person; Plan My Year as Alex, "Try the demo case", shows $2,300 / $1,405 / $895; ask the assistant "What will a crown cost me?" as Alex and expect $800.

## 5. What is left (also in `docs/TASKS.md`)
1. **Switching plans** across the whole app: backend route `PUT /households/{id}/plan` is done; the Plans page "Switch to this plan" and live session refresh (agent task T24) may still be finishing. Check `/plans` as Jordan.
2. **Fixes from the review** (`docs/reviews/review-2026-10-03.md`), in this order: the demo sign-in flow (the app auto-signs in as Jordan, so `/login` is skipped; change to landing, then login, then pick a person); "Log a visit" on Home adds dollars in the browser and is not saved (add a backend visit route that returns updated usage); seed the database when it is empty on a fresh clone; assistant side panel needs dialog behavior (Escape, focus); `/chat` without sign-in can burn the API key; tokens never expire.
3. **Login design:** Ulisses redesigns `frontend/src/pages/Login/LoginPage.tsx` (Clerk sign-in from his branch was left out on purpose; demo sign-in uses our own household database).
4. **Text to speech** for the chatbot: Wrigley, on branch `fe/text-to-speech`. The chat component is `frontend/src/features/assistant/AssistantChat.tsx`.
5. **Docs pass** after each stage: test counts and "not built" markers go stale quickly.
6. Rehearse the demo three times from `docs/DEMO.md`; keep a backup recording; do not start the backend with `--reload` on stage.

## 6. How to keep working with agents
Open Claude Code in the repo and use this prompt:
> You are the orchestrator. Read `agents/SESSION-STATE.md`, `agents/orchestrator.md`, `agents/README.md`, `agents/tasks/PLAN.md`, `docs/TASKS.md` and `docs/reviews/review-2026-10-03.md`. Pick the next item from section 5 of `agents/HANDOFF.md`, write a task brief from `agents/TASK-TEMPLATE.md` into `agents/tasks/`, and start the matching role agent with: "You are the `<role>` agent. Read `agents/README.md` and `agents/<role>-agent.md`, then do `agents/tasks/<file>`." Give each parallel agent separate files. Verify every result yourself (tests, build, browser) before reporting. Don't commit unless I ask.

Rules the agents follow are in `agents/README.md`. Role briefs: frontend, backend, ai, database, design, tests, docs, devops, integration, review. The docs agent keeps `docs/` accurate and writes the demo, presentation and resume-ready README.

## 7. Git rules
- Use **your own** git name and email. **Never add Claude as author or co-author** in a commit message.
- Never force-push; never edit prototype branches; never commit `.env` or `database/benefits.db`.
- Only the orchestrator session runs git for the agents.

## 8. Decisions in one table
| Topic | Decision |
|---|---|
| Family | Each person has their own usage, history, preferences and chat memory, stored in the server database. |
| Login | Demo sign-in on the real data model (households, roles, invites). Adults 18+ can have their own account; the primary sees everyone; children are managed by a parent. |
| Chat | Anthropic first, Ollama as the local option. No keyword answers. The model never does math; it calls the engine. |
| Pages | Home, Plans, Family, Costs, Plan My Year, Assistant. |
| Look | Portal look (burgundy `#650030`, orange `#FF4F17`); landing keeps its own scoped look. |
| Plans | Basic, Preferred, Premium. Preferred is the golden demo plan with a $50 deductible. Dental only. |
| Data | All plan, fee and member data is synthetic. |

Full decision log: `docs/decisions/README.md`.

## 9. Gotchas learned the hard way
- Very long Windows paths break some git commands; use short paths.
- Vite leaves a process on port 5173 after Ctrl+C; kill it by port.
- A page that stays blank after installing packages means the Vite server needs a restart.
- Agents' docs written before the code exists are unreliable: have the docs agent read the code.
- Test with realistic inputs, not just clean ones (a header date was once read as a procedure).
