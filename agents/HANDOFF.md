# Handoff: build the main product with your own Claude Code

For a teammate picking this up with their own Claude Code session. Everything is planned; **nothing beyond scaffolding is built yet.** Written 2026-10-03, about 15 hours before the **Sunday 10:00 AM demo**.

## What we're building
A dental benefits app for a signed-in family, in a portal look (Sai's styling). Six pages: Home, Plans, Family, Costs, Plan My Year, Assistant. Each family member has their own data and assistant context in a server database. The assistant is a real model (Anthropic first, Ollama as the local option). Caleb's tested prototype is the base; Sai's and Wrigley's ideas are rebuilt on top.

**Demo priorities, in order:** (1) sign in and see each family member's own view, (2) Plan My Year, (3) the personalized assistant per person. Then Costs, Plans, PDF upload.

## 1. Get the code
```bash
git clone https://github.com/calebabr/codelinc11.git
cd codelinc11
git fetch --all
git switch integration/main-product
```
(Caleb must push `integration/main-product` first. If it isn't there yet, ask him.)

Work on your own branch off it, for example `git switch -c ai/assistant`. Open pull requests **into `integration/main-product`, not `main`.**

**Prototypes (do not touch):** `proto/dental-prototype` (Caleb), `prototype/sai-benefits-portal` (Sai), `fe/chatbot` (Wrigley), `fe/router-pages` (Ulisses). They are preserved on purpose. Read them with `git show <branch>:<path>`.

## 2. Set up your machine
- Node 20+, Python 3.11, Git, Claude Code.
- Backend: `cd backend && python -m venv .venv && .venv/Scripts/python -m pip install -r requirements.txt` (on Mac/Linux use `.venv/bin/python`).
- Frontend: `cd frontend && npm install`.
- **API key:** create `backend/.env` containing `ANTHROPIC_API_KEY=...` (get it from Caleb). **Never paste it into chat or commit it.** `.env` is already ignored by git. Ollama is optional (`ollama pull llama3.2:3b`).
- Run: backend `cd backend && .venv/Scripts/python -m uvicorn app.main:app --port 8000`; frontend `cd frontend && npm run dev` (http://localhost:5173).

## 3. Git rules
- Use **your own** git name and email (`git config user.name`, `git config user.email`). Commits are under your name.
- **Never add Claude as author or co-author** in a commit message.
- Never force-push. Never edit, delete or rewrite a prototype branch. Never commit `.env`.
- Only the orchestrator session runs git for the agents. The agents themselves never run git.

## 4. Read these, in this order
1. `docs/decisions/README.md`: every decision made (family, login, chat engine, pages, theme, plans, privacy, deadline).
2. `agents/README.md`: the team roster, rules every agent follows, report format.
3. `agents/tasks/PLAN.md`: the staged plan, shared contracts, cutline.
4. `docs/FEATURES.md` section 2: the **golden numbers** every part must match.

## 5. Run the team
Open Claude Code in the repo root. Paste these prompts one at a time. Each agent is started with: *"You are the `<role>` agent. Read `agents/README.md` and `agents/<role>-agent.md`, then do `agents/tasks/<file>`."*

**Prompt 1: orient**
> You are the orchestrator. Read `agents/orchestrator.md`, `agents/README.md`, `agents/tasks/PLAN.md` and `docs/decisions/README.md`. Don't build anything yet. Summarize the plan back in 10 lines and tell me anything that looks blocked.

**Prompt 2: Stage 0 (foundation)**
> Run Stage 0 from `agents/tasks/PLAN.md`. Start tasks T01 (design), T02 (frontend), T03 (integration) and T04 (database) as four parallel agents, each using its task file. When they finish, verify the work yourself: backend `pytest -q` and `ruff check .`, frontend `npm run typecheck`, `npm run test` and `npm run build`, then open the app and check the shell at desktop and 375 px width. Don't commit. Tell me what passed, what failed and what I should look at.

**Then push the branch so Ulisses can start the login UI** (his work depends on T01 and T02).

**Prompt 3: Stage 1, wave A (needs T03 and T04 done)**
> Start T05 (backend), T06 (ai) and T09 (frontend Plan My Year) in parallel, each from its task file. Verify yourself when they finish, including the golden numbers.

**Prompt 4: Stage 1, wave B (needs T05 and T06 done)**
> Start T07 (Home), T08 (Family) and T10 (Assistant) in parallel. Then T11 (Costs) and T12 (Plans) if time allows. Verify each in the browser as Alex and as Jordan: numbers must differ per person.

**Prompt 5: Stage 2 (wrap-up)**
> Write task briefs for T13 (end-to-end and contract tests), T14 (review), T15 (docs and demo script) and T16 (CI and run script) from `agents/TASK-TEMPLATE.md`, then run them. Do a full click-through of the three demo moments and report honestly what works.

## 6. Check every stage yourself
- Backend: `cd backend && pytest -q && ruff check .`
- Frontend: `cd frontend && npm run typecheck && npm run test && npm run build`
- Golden numbers (Preferred plan): cleaning **$0**; crown, fresh year **$625**; crown with $1,100 used **$800**; out of network, fresh year **$925** (of which $300 is balance billing); plan-year scenario **$2,300 to $1,405, saves $895**.
- In the browser: sign in as the primary, switch to another member, and confirm every number changes with the person. Ask the assistant a question about each person and confirm answers differ.

## 7. Decisions in one table
| Topic | Decision |
|---|---|
| Family | Yes. Each person has their own usage, history, preferences and chat memory. |
| Login | Demo sign-in on the real data model (households, roles, invites). Adults 18 and over can have a login by invite; the primary sees everything. Ulisses builds the login UI. |
| Storage | Server database (SQLite first). Synthetic data only. |
| Chat | Anthropic first, Ollama as the local option. No keyword answers. PDF upload with sample documents only. |
| Pages | Home, Plans, Family, Costs, Plan My Year, Assistant, plus a chat button on every page. |
| Look | Sai's portal look (burgundy `#650030`, orange `#FF4F17`). |
| Plans | Basic, Preferred, Premium. Preferred is the golden demo plan with a **$50** deductible. Dental only (no vision). |

## 8. Cutline and cost control
- **Must work at 10:00 AM:** T01 to T10 with tests.
- **Next:** Costs, Plans, PDF upload. **Last:** invites, schedule polish.
- Each agent uses tokens. Run only the agents a stage names. If you're short on budget, run Stage 0, then the P0 tasks (T05, T06, T07, T08, T09, T10) and skip the P1 ones.
- Never fake a result to hit the deadline. If something isn't done, leave it out and say so.

## 9. Open items and who to ask
- **Caleb:** decisions, the API key, merging to `main`.
- **Ulisses:** the login UI (T17). Tell him once the shell is pushed.
- **Sai and Wrigley:** questions about their prototypes (read-only references).
- Task briefs T13 to T16 don't exist yet; Prompt 5 has the orchestrator write them.
- All plan, fee and member data is placeholder or synthetic.
