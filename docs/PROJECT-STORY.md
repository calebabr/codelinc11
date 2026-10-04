# PROJECT STORY

A factual build story for resumes and interviews. Facts as of 2026-10-04: `main` is production (backend on AWS, frontend on Netlify; sign-in is **Try the demo** only), and sprint 2 work (profiles, notifications) is on branch `sprint/family-providers-reports`, not yet merged. Numbers were checked by running the tests that day. No claim here goes beyond what exists.

## The problem
People with employer dental plans rarely know what a procedure will cost, and they lose unused benefits when the plan year resets. The hackathon challenge (codeLinc 11, Path 1, dental) asks for a tool that helps with that.

## The product
Molar Money, a dental benefits copilot for a household: estimate a procedure's cost with a step-by-step explanation, plan treatments across two plan years to pay the least, and see what is left. An AI assistant explains the results, but a tested engine does all the math. Plan and member data is synthetic.

## The four prototypes and how they were merged
Four teammates built prototypes in parallel (see [prototypes/README.md](prototypes/README.md)):
- **Caleb:** React and FastAPI with a tested money engine, plan-year scheduler, savings tips, dentist questions, quote reader, and an Ollama chat.
- **Wrigley:** a frontend-only personalized chatbot, dashboard and family profiles.
- **Sai:** a vanilla JS benefits portal with plan tiers, a family eligibility diagram and a cost calculator.
- **Ulisses:** the navigation shell and theme.

The team decided what to keep from each one (feature catalog and decision log in [prototypes/](prototypes/README.md) and [decisions/](decisions/README.md)). Every prototype branch is preserved untouched, and features are ported into a separate integration branch, not merged wholesale. Stand-ins such as invented calculator factors were not carried over unless rebuilt to be real.

## The multi-agent process
- One orchestrator (the lead Claude session) breaks requests into task briefs and starts role agents: design, frontend, backend, database, AI, tests, docs, DevOps, integration, review.
- Each agent has a brief and may edit only its own folders. Rules include: money math only in `backend/app/engine/`, never change a golden number to pass a test, no secrets, synthetic data only.
- The orchestrator runs the tests itself and does not take a report on trust. Only the orchestrator runs git, under the user's own identity.
- Briefs live in [../agents/](../agents/README.md).

## Key decisions (see the decision log)
Family, not one person (D1); a sign-in on a real household data model (D2, F1); an API chatbot with Anthropic first and Ollama as the local option, no keyword answers (D3); six pages (D4); Sai's portal look (D5); three plan tiers (D6); per-person context stored on the server (D9); dental only (D10).

## Measurable outcomes (2026-10-03)
| Measure | Value |
|---|---|
| Backend tests | 523 passing on the sprint branch (391 before sprint 2; 262 before the Monte Carlo plan comparison, demo sandboxes and rate limits); coverage 96% |
| Frontend tests | 205 passing on the sprint branch (151 before sprint 2). Typecheck and production build clean |
| First page load on a phone | about 162 kB of JavaScript, gzipped (other pages load on demand) |
| Golden scenarios | G1 to G6 and S2 pass (S2: $2,300 to $1,405, saves $895) |
| API endpoints built | 36 routes on `feature/choose-a-plan` (engine, plan simulation, demo sign-in with per-visitor families, household and renaming, member overview, visits, saved plans, saved plan comparisons, plan switching, assistant) |
| Frontend routes | Landing (`/welcome`), demo sign-in (`/login`), Scan to try (`/join`), six pages (Home, Plans, Family, Costs, Plan My Year, Assistant) |
| Database tables | 14 across four migrations, including per-person usage, visits, saved plans, saved plan comparisons, demo sandboxes and assistant memory |
| Procedure codes | 16 |
| Plan tiers | 3 |
| Lint | `ruff check .` clean |

Not done: browser end-to-end tests (Playwright); the CI workflow has not run on GitHub yet; the AWS kit in `infra/aws/` has not been run in AWS (a teammate deploys `main`); an access code for the demo is an idea, not built.

## Sprint 2 so far (branch `sprint/family-providers-reports`)
Done: the `$NaN` fix, a bigger chat box, a pytest suite foundation (markers, 14 regression tests), editable profiles and family members (demo family only), and notifications: a bell with an unread badge, a `/notifications` page with filters and per-person settings, a Home card, and notifications made from the person's data and the benefits engine. Email and text are **delivery previews only**; a `Notifier` interface marks where a real sender would plug in. Not built yet: Find Providers, quote to dentist matching, Reports, and real email or text sending.

## What I would say honestly
- Every visitor gets their own private demo family (a clone of the seeded household, 24 hours, cap of 300), so a public demo is not spoiled by one person. In-memory rate limits protect the Anthropic key. The app was made to work on phones, with a QR page to join.
- On `feature/choose-a-plan` (not yet merged) the Plans page can also simulate 5,000 possible years for the household and show how often each plan is cheapest. It prices through the same engine; the odds are synthetic placeholders, not claims data.
- The engine, database, API and all six pages are real, connected and tested; each person in the household sees their own numbers.
- The assistant runs on Anthropic (`claude-haiku-4-5`) and calls the engine through tools; a number guard checks every dollar figure. It needs internet and a key.
- Sign-in is a demo with no passwords, and anyone with the link can start a demo family. Rate limits are in memory on one server, and the data is one SQLite file.
- All plan values, fees and members are synthetic placeholders.
