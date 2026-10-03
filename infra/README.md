# infra/

Running, checking and shipping the project. The DevOps agent (`agents/devops-agent.md`) owns this folder and `.github/`.

Status: CI is set up (`.github/workflows/ci.yml`). Run scripts are in `scripts/`. No deployment yet.

## Local run

One command (creates the backend venv, installs packages, builds the demo database if missing, starts both servers):

| System | Start | Rebuild the demo database |
|---|---|---|
| Windows (PowerShell) | `scripts/dev.ps1` | `scripts/reset-db.ps1` |
| Git Bash, Mac, Linux | `scripts/dev.sh` | `scripts/reset-db.sh` |

The scripts never print `.env`. Or run the parts by hand:

| Part | Command | URL |
|---|---|---|
| Backend | `cd backend && .venv/Scripts/python -m uvicorn app.main:app --port 8000` | http://localhost:8000 (API docs at `/docs`) |
| Frontend | `cd frontend && npm run dev` | http://localhost:5173 |
| Chat model (one of two providers) | Ollama: install it, then `ollama pull llama3.2:3b`. Or an Anthropic API key in `.env` | without a reachable model the assistant says it is unavailable; the rest of the app keeps working |

## Environment variables (names only; real values never go in the repo)

| Variable | What it does | Secret? |
|---|---|---|
| `OLLAMA_URL` | Where the local model runs (default `http://localhost:11434`) | No |
| `OLLAMA_MODEL` | Which local model to use (default `llama3.2:3b`) | No |
| `OLLAMA_TIMEOUT` | Seconds to wait for the model | No |
| `VITE_API_URL` | Where the frontend finds the backend | No |
| `ANTHROPIC_API_KEY` | Key for the Anthropic provider, if that provider is used | **Yes** |
| `ANTHROPIC_MODEL` | Anthropic model name (optional) | No |
| `ASSISTANT_PROVIDER` | `auto` (default), `anthropic`, `ollama` or `none` | No |
| `BENEFITS_DB_PATH` | Where the SQLite demo database lives (default `database/benefits.db`) | No |

Keep `.env.example` in step with this table.

## Checks on every pull request
`.github/workflows/ci.yml` runs on every pull request and on pushes to `main` and `integration/main-product`. It needs no secrets and no model (`ASSISTANT_PROVIDER=none`).
- Backend (Python 3.11): `pip install -r requirements.txt`, `ruff check .`, `pytest -q`
- Frontend (Node 20): `npm ci`, `npm run typecheck`, `npm run test`, `npm run build`

End-to-end tests are not in CI; run them locally before checkpoints.

## Deployment
Not decided. Anything that creates cloud resources, costs money or changes repository settings needs the user's explicit approval first. Nothing in the product should send health data to a third party unless the decision log says so. Using the Anthropic provider sends chat content to a third party, so which data may be sent is an open decision (F5).
