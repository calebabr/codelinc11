# Task T16: CI and one-command run

**Role:** devops
**Read first:** agents/README.md, agents/devops-agent.md, docs/SETUP.md, infra/README.md

## Goal
Make the repo easy to run and keep it green.

## You may edit
`.github/workflows/`, `infra/`, root `package.json`-free scripts (a `scripts/` folder with `dev.ps1`, `dev.sh`, `reset-db.ps1`, `reset-db.sh`), `backend/requirements.txt` (only to pin/verify what is already used), `.env.example` files.

## Scope
- GitHub Actions workflow: on pull request and push to `main` and `integration/main-product`: backend (Python 3.11, pip install -r backend/requirements.txt, ruff, pytest) and frontend (Node 20, npm ci, typecheck, test, build). No secrets needed; tests must pass without an API key.
- `scripts/dev.ps1` / `dev.sh`: create the backend venv if missing, install deps, reset the demo database if missing, start backend on 8000 and frontend on 5173; print URLs. Never print `.env`.
- Verify `backend/requirements.txt` installs into a fresh venv and tests pass (use a temp venv in the scratchpad or `python -m venv` under backend/.venv-ci that you delete after).
- Do not touch application code.

## Acceptance checks
Workflow YAML is valid (yamllint or a Python yaml load); scripts run `--help`-free syntax checks; fresh-venv install + pytest pass.

## Docs to update
infra/README.md, docs/SETUP.md run section.

## Report
Format in agents/README.md.
