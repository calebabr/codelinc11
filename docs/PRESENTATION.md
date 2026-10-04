# PRESENTATION outline

One idea per slide. About 8 slides for a 3 to 5 minute demo plus talk. Everything below is built and was checked live on 2026-10-03. Numbers match the golden numbers in [FEATURES.md](FEATURES.md) section 2.

## 1. The problem
- Dental plans are hard to read. People do not know what a crown will cost, and they lose unused benefits every December.
- Speaker notes: a plan can pay 50% of a crown, but only until the yearly maximum runs out. Many people find out at the front desk.

## 2. Who it is for
- Employees with dental coverage, and their families.
- Notes: one household, several people, each with their own deductible, maximum and history.

## 3. The solution
- Three answers: What will I owe? When should I schedule care? What do I have left?
- Six pages: Home, Plans, Family, Costs, Plan My Year, Assistant, plus an assistant button on every page and a landing page.
- Molar Money is the product name. Anyone can scan a QR code, tap **Try the demo**, and get their own private demo family. Works on a phone.

## 4. Live demo
Follow [DEMO.md](DEMO.md). The key moment: **$2,300 now, $1,405 optimized, you save $895**, with the urgent root canal staying this year.
- Also useful: crown late in the year $800 vs $625 in January; out-of-network crown $925, of which $300 is balance billing.

### Moment 2: "Which plan fits us?" (Monte Carlo)
- One idea: nobody knows next year's dental care, so we simulate 5,000 possible years for the family and show how often each plan costs the least. Same engine, same seed, same answer.
- Numbers (Rivera household, average care, seed 42): Basic is cheapest in 82% of years; with Alex's crown as known care, Preferred is cheapest in 54%.
- You can save a comparison to Plan My Year and open it again later. The assistant answers "Summarize the plan simulations" from the same numbers.
- Notes: say plainly that the odds are synthetic placeholders, not a prediction. Built on `feature/choose-a-plan` (not merged to `main` yet); show it live only from a build that has it.

## 5. How it works
- The **engine does the math**, the **AI explains it**. The model never computes a dollar amount; a number guard rejects any dollar figure that did not come from a tool.
- Diagram: React app, FastAPI, engine, SQLite household database, Anthropic (Ollama optional). See [ARCHITECTURE.md](ARCHITECTURE.md).
- Notes: every estimate comes with a step-by-step trace ("show the math").

## 6. What is real and what is synthetic
| Real and tested | Synthetic or stand-in |
|---|---|
| Money engine, scheduler, savings tips, plan simulation (391 backend tests) | All plan values, fees and members; the odds in "Which plan fits us?" |
| Household database, per-person data and access rules, a private demo family for every visitor | Sign-in is a demo with no passwords; anyone with the link can start a demo family |
| Assistant on Anthropic with engine tools and a number guard (dollars and percentages) | Rate limits are in memory on one server; one SQLite file |
| Six connected pages, landing, phone layout, voice input (151 frontend tests) | The AWS kit in `infra/aws/` is a reference; it was not run |

## 7. The team and the build
- Four prototypes (Caleb, Wrigley, Sai, Ulisses) merged into one product; each is preserved.
- A team of AI agents (design, frontend, backend, database, AI, tests, docs), one orchestrator, every result checked by running tests. Agents edit only their own folders.
- Say it plainly: humans direct and approve; agents write code, tests and docs.

## 8. What is next
- Real plan values and fees (decision D7) and real sign-in (an access code for the demo is an idea, not built).
- Merge to `main` and deploy (a teammate deploys `main`).
- Browser end-to-end tests and CI on GitHub.
- Text-to-speech answers (Wrigley), more procedures, and real claims data to replace the placeholder odds in the plan comparison.
- Never imply the product replaces the dentist or the insurer: results are estimates.
