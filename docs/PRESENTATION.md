# PRESENTATION outline

One idea per slide. About 8 slides for a 3 to 5 minute demo plus talk. Items marked **[NOT BUILT]** must not be shown as working until they are (status as of 2026-10-03; see [TASKS.md](TASKS.md)). Numbers match the golden numbers in [FEATURES.md](FEATURES.md) section 2.

## 1. The problem
- Dental plans are hard to read. People do not know what a crown will cost, and they lose unused benefits every December.
- Speaker notes: a plan can pay 50% of a crown, but only until the yearly maximum runs out. Many people find out at the front desk.

## 2. Who it is for
- Employees with dental coverage, and their families.
- Notes: one household, several people, each with their own deductible, maximum and history.

## 3. The solution
- Three answers: What will I owe? When should I schedule care? What do I have left?
- Six pages: Home, Plans, Family, Costs, Plan My Year, Assistant. **[pages NOT BUILT; shell and routes are built]**

## 4. Live demo
Follow [DEMO.md](DEMO.md). The key moment: **$2,300 now, $1,405 optimized, you save $895**, with the urgent root canal staying this year. **[Plan My Year page NOT BUILT; engine and API are built]**
- Also useful: crown late in the year $800 vs $625 in January; out-of-network crown $925, of which $300 is balance billing.

## 5. How it works
- The **engine does the math**, the **AI explains it**. The model never computes a dollar amount; a number guard rejects any dollar figure that did not come from a tool.
- Diagram: React app, FastAPI, engine, database, Anthropic or Ollama. See [ARCHITECTURE.md](ARCHITECTURE.md).
- Notes: every estimate comes with a step-by-step trace ("show the math").

## 6. What is real and what is synthetic
| Real and tested | Synthetic or stand-in |
|---|---|
| Money engine, scheduler, 148 backend tests | All plan values, fees and members |
| Household database and access rules (17 tests) | Sign-in is a demo "choose your account" |
| Streaming chat with number guard (Ollama) | Anthropic assistant and per-person context **[NOT BUILT]** |
| Portal-style shell, 10 frontend tests | Six real pages **[NOT BUILT]** |

## 7. The team and the build
- Four prototypes (Caleb, Wrigley, Sai, Ulisses) merged into one product; each is preserved.
- A team of AI agents (design, frontend, backend, database, AI, tests, docs), one orchestrator, every result checked by running tests. Agents edit only their own folders.
- Say it plainly: humans direct and approve; agents write code, tests and docs.

## 8. What is next
- Household API and sign-in, per-person assistant on Anthropic, the six pages, end-to-end tests, CI.
- Real plan values and fees (decision D7). PDF upload for the assistant. Plan comparison and annual cost calculator.
- Never imply the product replaces the dentist or the insurer: results are estimates.
