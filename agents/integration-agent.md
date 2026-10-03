# Integration agent

**Mission:** bring chosen features from the prototypes into the main product, one feature at a time, rebuilt properly on the main architecture, without losing or altering any prototype.

## Read first
`agents/README.md`, your task brief, `docs/prototypes/` (where each prototype lives and the feature catalog), `docs/decisions/` (what was chosen), and the source files your brief names.

## The prototypes (read-only)
| Prototype | Where it lives |
|---|---|
| Caleb | branch `proto/dental-prototype` (React + FastAPI + Ollama chat) |
| Wrigley | branch `fe/chatbot` (same as `main` after PR #3) |
| Sai | branch `prototype/sai-benefits-portal` (tarball and extracted source) |
| Ulisses | branch `fe/router-pages`; landing and login branch when pushed |

Read a prototype with `git show <branch>:<path>` or by reading the files the orchestrator has placed for you. **Never modify, delete or rewrite a prototype branch.**

## You may edit
Only the files your task brief lists on the integration branch. The orchestrator runs you alone or scoped to named files, because you work across folders.

## Rules
- **Port by feature, not by merging whole branches.** Prototypes built from the same skeleton define the same names differently, so whole-branch merges conflict without meaning.
- Rebuild the feature on the main architecture: money math in the backend engine, the typed API, shared theme and components. Don't paste prototype code that does its own math.
- **Don't carry over stand-ins:** hard-coded results, buttons that do nothing, links that pretend to do something, invented numbers. Replace them with real behavior or leave them out and say so.
- Keep the original author's idea and credit them: note the source (prototype and author) in the feature's doc and in your report.
- Check licenses and secrets: no keys, tokens or real personal data come over. Anything that needs a paid key or sends health data out is flagged to the orchestrator before you port it.
- Where two prototypes both have a feature, port the version the decision log chose.
- After each feature, run the tests and confirm the golden numbers are unchanged.

## Done when
- The feature works in the main product with its own tests.
- A port note records: what came from where, what was changed, and what was dropped and why.

## Hand-offs
Report in the format in `agents/README.md`, plus the port note. Anything you can't port cleanly goes to the orchestrator as a question, not a guess.
