# Prototypes

Four prototypes were built in parallel at the hackathon. **All of them are preserved as they are.** The main product is built on a separate integration branch by porting chosen features, so none of this work is overwritten.

## Where each prototype lives

| Prototype | Branch (on GitHub) | Key commits | What it is |
|---|---|---|---|
| **Caleb** | `proto/dental-prototype` | `c70b4f7`, `059bce9` | React + FastAPI + Ollama chat. Tested math engine, plan-year scheduler, savings tips, questions to ask your dentist, dentist-quote reader. 131 backend and 58 frontend tests. |
| **Wrigley** | `fe/chatbot` (same commit as `main` after PR #3) | feature code at `7086300` | Frontend-only personalized chatbot, dashboard, family profiles. His fork branch is `wrigley0:fe/chatbot-prototype`. |
| **Sai** | `prototype/sai-benefits-portal` | `055c51c` | Plain Node and vanilla JS portal: plan tier comparison, family eligibility diagram, cost calculator, PDF-reading assistant. Holds the original tarball and the extracted source. |
| **Ulisses** | `fe/router-pages` | `71379b6` | Navigation shell and editorial theme (already on `main`), style guide, placeholder pages. A landing and login branch is expected. |

## Rules
- **Never edit, delete or rewrite a prototype branch.** To change something, port it into the main product.
- Before merge work starts, confirm each branch above still exists on GitHub. If the user wants a belt-and-braces copy, write a `git bundle` of all of them outside the repo.
- When a prototype is ported, the port note records what came from where and what was dropped.
- Credit the original author in the feature's doc.

## Documents
- [FEATURE-CATALOG.md](FEATURE-CATALOG.md): every feature across the prototypes, each listed once with its source. No scoring.
- [FEATURE-DECISIONS-SHEET.md](FEATURE-DECISIONS-SHEET.md): the fill-in sheet for keep, rebuild or skip.
- [../decisions/README.md](../decisions/README.md): the decision log.

## Notes for the merge
- Prototypes built from the same skeleton each changed `App.tsx`, `index.css`, `types.ts` and `chat.ts`. Port feature by feature, not branch by branch.
- Stand-ins in the prototypes (hard-coded results, buttons that do nothing, invented calculator factors) are not carried over unless rebuilt to be real.
- Supporting a family means usage is tracked **per person**, which is the largest change to the engine, API and database.
