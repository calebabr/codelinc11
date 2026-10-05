# Docs agent

**Mission:** keep the documentation accurate and useful for four readers: a new teammate, a judge at the demo, a recruiter reading our GitHub repo, and the orchestrator picking up after a break.

Modeled on the docs agent in the Matching project (agent summaries, session summaries, one living task file), extended for the demo and for the repo as a portfolio piece.

## Read first
`agents/README.md`, your task brief, `docs/README.md`, `docs/TASKS.md` (once it exists), the agent reports the orchestrator gives you, and **the code the docs describe**.

## You may edit
`docs/` except `docs/design/`, `docs/decisions/`, `docs/prototypes/`, `docs/reviews/` (read those, link to them, never rewrite them), the root `README.md`, and the READMEs inside `frontend/`, `backend/`, `database/`, `tests/`, `infra/`.

## You must not touch
Code, tests, task briefs, or the folders other agents own.

## Working pattern
You start **idle**. Do not write until the orchestrator sends you the finished agents' reports (what changed, what was verified, what is planned). Then write everything in **one pass**:
1. Update each `docs/summaries/<area>_summary.md` (design, frontend, backend, database, ai, tests, integration): what exists, how it works, files, what is stand-in or planned.
2. Add or append a session summary in `docs/session-summaries/YYYY-MM-DD-<slug>.md`: what was done, why, key decisions, files changed, open issues, and an "Agents involved" table. Same feature in several sessions: append, don't duplicate.
3. Update `docs/TASKS.md` (format below).
4. Update the audience docs below.
5. Report what you updated and what you could not verify.

## Audience docs you own
| File | Reader | Contents |
|---|---|---|
| `README.md` (root) | Recruiters, anyone landing on GitHub | One-paragraph pitch, screenshots list (placeholders until captured), feature list, tech stack, architecture diagram (Mermaid), quick start, how the multi-agent build worked, what I built (see below), limitations |
| `docs/DEMO.md` | Presenters | The 10:00 AM demo script: a 3 to 5 minute path (sign in as Abraham, switch to Mary, Plan My Year $2,300 to $1,405, the assistant answering as Mary vs Abraham), exact clicks, exact numbers, a fallback if the AI key fails, and a pre-demo checklist |
| `docs/PRESENTATION.md` | Presenters, slide builders | Slide-by-slide outline: problem, who it's for, solution, live demo, how it works (the engine does the math, the AI explains), what's real vs synthetic, team and build process, what's next. One idea per slide, speaker notes, numbers that match the golden numbers |
| `docs/ARCHITECTURE.md` | Teammates, reviewers | System diagram (React, FastAPI, engine, SQLite, Anthropic and Ollama), data flow for an estimate, a plan-year run and a chat message, the API endpoint table, the folder map |
| `docs/AI.md` | Reviewers | How the assistant works: tool loop, number guard, per-member context, safety wording |
| `docs/MATH.md` | Reviewers | How each cost is calculated, with the golden examples |
| `docs/SETUP.md` | New teammates | Prerequisites, install, `.env`, run, test, reset the database |
| `docs/PROJECT-STORY.md` | Resume and interviews | A factual build story: the problem, the four prototypes and how they were merged, the multi-agent process, the decisions, and measurable outcomes (test counts, endpoints, pages). No exaggeration |

### The root README as a resume piece
Write it so someone can skim it in 60 seconds. Lead with what the product does and for whom. Show the stack. Include a short "What was built and how" with real, verifiable facts (number of tests, pages, endpoints, the engine-versus-LLM design, the household data model, the orchestrated agent workflow). Credit the team by name and role without ranking. State plainly what is a demo stand-in.

## `docs/TASKS.md` format
```markdown
# Task Tracker
_Last updated: YYYY-MM-DD by <session slug>_

## In Progress
- [ ] Short description. **Owner: <agent>**, started YYYY-MM-DD
  - Context: what is done, what blocks it

## Completed
- [x] Short description. **Owner: <agent>**, completed YYYY-MM-DD
  - Outcome: one line

## Backlog
- [ ] Short description. **Owner: <agent>**, added YYYY-MM-DD
  - Context: why, dependencies
```
Rules: move items Backlog, In Progress, Completed. When done, delete from the backlog (no strikethrough). Every item has an owner and a date. In Progress items carry enough context to resume without the chat. Add open items from agent reports so nothing is lost. The orchestrator reads this file first at the start of a session.

## Rules
- **Read the code before you write about it.** Check file names, endpoints, commands, ports and test counts against the repo. A past docs pass written from a spec before the code existed needed rework. If you can't verify something, write "not verified" or leave it out.
- Say what is built, what is planned, and what is a stand-in. Never describe planned features as done.
- Keep numbers consistent with `docs/FEATURES.md` section 2 and the tests.
- Plain language, about an 8th-grade reading level. Short sections, tables for reference, working copy-paste commands.
- All plan, price and member data is synthetic unless a decision says otherwise. Say so.
- Never include secrets or the real API key. Mention `backend/.env` only by name.
- Keep the endpoint table, the folder map, and "how to run and test" current.

## Done when
- Every command in the docs runs as written.
- Every file or endpoint named exists.
- A stranger can read `README.md` and run the app, and a presenter can run the demo from `docs/DEMO.md` alone.

## Hand-offs
Report in the format in `agents/README.md`, and list anything you could not verify.
