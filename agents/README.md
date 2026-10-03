# Agent Team

Role briefs for the AI agents that build the main product. The **orchestrator** (the lead Claude session the user talks to) breaks a request into tasks, starts the agents it needs, checks their work, and integrates it.

How a request flows:

1. The user asks for something ("build the family profiles", "create a team for the quote reader").
2. The orchestrator reads the open decisions in `docs/decisions/`, picks the roles, and writes a **task brief** for each (`TASK-TEMPLATE.md`, saved in `agents/tasks/`).
3. Each agent gets: *"You are the `<role>` agent. Read `agents/README.md` and `agents/<role>-agent.md`, then do the task brief."* Agents on separate files run in parallel.
4. Each agent reports back (format below). The orchestrator then **runs the checks itself** (tests, build, browser) and does not take a report on trust.
5. The orchestrator fixes or sends back anything that fails, updates the docs, and tells the user what to check. It commits only when the user asks.

## Roster

| Agent | Brief | May edit | Does not touch |
|---|---|---|---|
| Orchestrator | [orchestrator.md](orchestrator.md) | `agents/`, `docs/decisions/`; runs all git commands | |
| Frontend | [frontend-agent.md](frontend-agent.md) | `frontend/src/` (pages, components, lib, state, routes) and its own tests | `backend/`, `database/`, theme tokens |
| Design | [design-agent.md](design-agent.md) | `docs/design/`, theme tokens in `frontend/src/index.css` | Components' logic, `backend/` |
| Backend | [backend-agent.md](backend-agent.md) | `backend/app/` (engine, models, routers, main) and its own tests | `backend/app/agent/`, `backend/app/rag/`, `backend/app/db/`, `frontend/` |
| AI | [ai-agent.md](ai-agent.md) | `backend/app/agent/`, `backend/app/rag/`, its own tests, `docs/AI.md` | The money engine, `frontend/` |
| Database | [database-agent.md](database-agent.md) | `database/`, `backend/app/db/` | Engine math, `frontend/` |
| Tests | [tests-agent.md](tests-agent.md) | `tests/` (end-to-end, contract, shared fixtures) | Any non-test code |
| Docs | [docs-agent.md](docs-agent.md) | `docs/` (except `design/`, `decisions/`, `prototypes/`, `reviews/`), READMEs | Code and tests |
| DevOps | [devops-agent.md](devops-agent.md) | `.github/`, `infra/`, run scripts | Application code |
| Integration | [integration-agent.md](integration-agent.md) | Only the files its task brief lists; prototypes are read-only | Prototype branches |
| Review | [review-agent.md](review-agent.md) | `docs/reviews/` only | All code |

Unit tests live next to the code and are written by the agent that writes the code. The Tests agent owns the cross-cutting layers (end-to-end, contract, golden regression).

## Rules for every agent

1. **Stay in your folders.** If you need a change elsewhere, stop and say so in your report.
2. **Never run git** (`add`, `commit`, `push`, `switch`, `merge`, `reset`, anything). Only the orchestrator does, under the user's own identity. No agent is ever the author or co-author of a commit.
3. **Never touch the prototypes.** Branches `proto/dental-prototype`, `prototype/sai-benefits-portal`, `fe/chatbot` and `fe/router-pages` are preserved as they are. Read them if your brief says so. Never edit, delete or rewrite them.
4. **Money math lives only in `backend/app/engine/`.** The AI model and the frontend never compute a dollar amount. They display values the engine returned.
5. **Never change a golden number** (`docs/FEATURES.md` section 2, and the expected values in the engine tests) to make code pass. If one looks wrong, stop and report it.
6. **Every change ships with tests, and you run them before reporting.** Do not say "done" for something you did not run.
7. **No secrets, no real personal data.** Keys go in `.env` (never committed; `.env.example` lists the names). Use synthetic members and fake plan data. Health information is never stored beyond what a task needs.
8. **No new dependencies** without the orchestrator's approval.
9. **Do not start servers** on ports 8000 or 5173 unless your brief says to. The orchestrator does the browser check.
10. **Plain language and the disclaimer.** Calm, plain wording. Every result shows "This is an estimate, not a guarantee." Never suggest delaying urgent or painful care.
11. **Visual controls, not dropdowns.** Use cards, chips, sliders, month strips and charts instead of native `<select>` menus.
12. **Mobile friendly.** Layouts must work at 375 px width.

## Working in parallel

- Two agents running at the same time must have **disjoint file lists**. If they can't, run them one after the other.
- The API contract (`backend/app/models.py`) belongs to the Backend agent. The database schema belongs to the Database agent. Others ask the orchestrator for changes.
- The Integration agent edits across folders, so the orchestrator runs it **alone**, or scopes it to named files.

## Report format

Every agent ends with a short report:

1. **What changed:** files created or edited.
2. **What I ran:** commands and results (counts, pass/fail).
3. **Assumptions and anything blocked.**
4. **What a human should check:** a URL, a request, or a number to compare with `docs/FEATURES.md` section 2.

## Related

- Decisions and open questions: [../docs/decisions/](../docs/decisions/)
- Where each prototype lives: [../docs/prototypes/](../docs/prototypes/)
- Existing project rules and golden numbers: [../docs/CONVENTIONS.md](../docs/CONVENTIONS.md), [../docs/FEATURES.md](../docs/FEATURES.md)
- Git process: [../docs/GIT-WORKFLOW.md](../docs/GIT-WORKFLOW.md)
