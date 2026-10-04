# SETUP

How to run and test the project on your own computer. Commands below are for Windows (Git Bash or PowerShell). On Mac or Linux, use `.venv/bin/python` instead of `.venv/Scripts/python`.

## Prerequisites
- Python 3.11 or newer
- Node.js 20 or newer and npm (checked with Node 20 and Node 24)
- For the assistant: an Anthropic API key in `backend/.env` (see below). Optional local alternative: [Ollama](https://ollama.com) with `llama3.2:3b`

## One-command run
From the repo root: `scripts/dev.ps1` (PowerShell) or `scripts/dev.sh` (Git Bash, Mac, Linux). It creates the backend venv if missing, installs packages, builds the demo database if missing, and starts the backend on 8000 and the frontend on 5173. `scripts/reset-db.ps1` / `reset-db.sh` rebuild the demo database. CI (`.github/workflows/ci.yml`) runs the same lint, test and build checks on every pull request.

## Backend
From `backend/`:

```
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
.venv/Scripts/python -m uvicorn app.main:app --port 8000
```

- API: http://localhost:8000. Interactive docs: http://localhost:8000/docs. Health check: http://localhost:8000/health
- Run the tests: `.venv/Scripts/python -m pytest -q` (262 tests, about 30 seconds, no internet or model needed)
- Lint: `.venv/Scripts/python -m ruff check .`

## Frontend
From `frontend/`:

```
npm install
npm run dev          # http://localhost:5173
npm run test         # 75 tests
npm run typecheck
npm run build
```

The frontend calls the backend at `VITE_API_URL` (default `http://localhost:8000`). The backend allows requests from `http://localhost:5173` and `http://127.0.0.1:5173`. Open http://localhost:5173/welcome (landing) or http://localhost:5173/login (demo sign-in). Restart Vite after installing packages.

## Environment variables
Copy `.env.example` (repo root) to `backend/.env`. The real `.env` is git-ignored. Never commit a key or paste it in chat.

| Variable | Used by | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | Assistant (default provider) | Required for chat unless Ollama runs |
| `ANTHROPIC_MODEL` | Assistant | Default `claude-haiku-4-5` |
| `ASSISTANT_PROVIDER` | Assistant | `auto` (default), `anthropic`, `ollama`, `none` |
| `SESSION_TTL_HOURS`, `SESSION_SECRET` | Sign-in tokens | Default 12 hours; secret saved to `database/.session_secret` if unset |
| `OLLAMA_URL` | Optional local chat | Default `http://localhost:11434` |
| `OLLAMA_MODEL` | Optional local chat | Default `llama3.2:3b` |
| `OLLAMA_TIMEOUT` | Optional local chat | Seconds, default 60 |
| `BENEFITS_DB_PATH` | Database | Default `database/benefits.db` |

`VITE_API_URL` (in `frontend/.env`, optional) points the frontend at the backend. The backend reads `backend/.env` only at start, so restart it after editing.

## Chat model
With `ANTHROPIC_API_KEY` set, `/health` reports `chat_mode: "anthropic"`. Without a reachable model it reports `"unavailable"` and the assistant says so plainly; the rest of the app keeps working. To use Ollama instead: install it, run `ollama pull llama3.2:3b`, and leave it running.

## Database
From `backend/`:

```
.venv/Scripts/python -m app.db            # create database/benefits.db and load the seed
.venv/Scripts/python -m app.db --reset    # delete it and rebuild
```

The demo clock is fixed at `2026-11-01`. The backend also seeds the database automatically when it is empty, and **Reset demo data** on Home (or `POST /demo/reset`) rebuilds it while running. More: [../database/README.md](../database/README.md).

## Troubleshooting
- Port 8000 or 5173 already in use: stop the other process, or pick another port (and update the CORS list in `backend/app/main.py` for the frontend).
- `ModuleNotFoundError: app`: run commands from `backend/`.
- Chat says "unavailable": `ANTHROPIC_API_KEY` is missing or wrong in `backend/.env` (restart the backend after fixing), or there is no internet.
- Do not start the backend with `--reload` on Windows: it can leave an orphan process holding port 8000.
- Blank page after `npm install`: restart Vite.
