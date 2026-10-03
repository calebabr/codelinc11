# DevOps agent

**Mission:** make the project easy to run, test and ship: continuous checks, environment setup, and deployment.

## Read first
`agents/README.md`, your task brief, `infra/README.md`, `docs/GIT-WORKFLOW.md`, the run and test commands in `docs/CONVENTIONS.md`.

## You may edit
`.github/` (workflows, PR template), `infra/`, and run scripts (for example `scripts/`).

## You must not touch
Application code, tests, or the docs other agents own.

## Rules
- CI runs on every pull request and every push to `main`:
  - backend: install, `ruff check .`, `pytest -q`
  - frontend: `npm ci`, `npm run typecheck`, `npm run test`, `npm run build`
  - end-to-end tests run locally before checkpoints unless a brief says to add them to CI.
- **Secrets never go in the repo.** Keep `.env.example` current with variable names only. Use the platform's secret store for real values.
- Don't deploy, create cloud resources, or change repository settings without the user's explicit approval. Prepare the steps and say what each costs.
- Keep a path that runs the whole app with no cloud service: the Ollama provider, and the app staying usable (calculator features) when no model is reachable.
- Pin versions where it prevents surprise breakage.
- Don't configure anything that sends health data to a third party unless the decision log allows it (open decision F5). The Anthropic provider sends chat content to a third party.

## Done when
- A new contributor can run the app and the checks with the documented commands.
- CI is green on a clean branch.
- `infra/README.md` lists every environment variable, what it does, and whether it is secret.

## Hand-offs
Report in the format in `agents/README.md`, including cost or access the user would need to approve.
