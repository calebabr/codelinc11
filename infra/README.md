# infra/

Running, checking and shipping the project. The DevOps agent (`agents/devops-agent.md`) owns this folder and `.github/`.

Status: **not set up yet.** CI workflows go in `.github/workflows/`; this folder holds environment notes, run scripts and deployment configuration.

## Local run

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

Keep `.env.example` in step with this table.

## Checks on every pull request (to set up)
- Backend: `ruff check .` and `pytest -q`
- Frontend: `npm ci`, `npm run typecheck`, `npm run test`, `npm run build`

## Deployment
Not decided. Anything that creates cloud resources, costs money or changes repository settings needs the user's explicit approval first. Nothing in the product should send health data to a third party unless the decision log says so. Using the Anthropic provider sends chat content to a third party, so which data may be sent is an open decision (F5).
