# SETUP

How to run and test the project on your own computer. Commands below are for Windows (Git Bash or PowerShell). On Mac or Linux, use `.venv/bin/python` instead of `.venv/Scripts/python`.

## Prerequisites
- Python 3.11 or newer
- Node.js and npm (the frontend uses Vite 6; a current LTS version should work, exact version not verified)
- Optional, for the chat assistant today: [Ollama](https://ollama.com) with the model `llama3.2:3b`

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
- Run the tests: `.venv/Scripts/python -m pytest -q` (148 tests, about 12 seconds, no internet or model needed)
- Lint: `.venv/Scripts/python -m ruff check .`

## Frontend
From `frontend/`:

```
npm install
npm run dev          # http://localhost:5173
npm run test         # 10 tests
npm run typecheck
npm run build
```

The frontend does not call the backend yet. It runs on a mock Rivera household (`frontend/src/state/SessionContext.tsx`). The backend allows requests from `http://localhost:5173` and `http://127.0.0.1:5173`.

## Environment variables
Copy `.env.example` (repo root) to `backend/.env`. The real `.env` is git-ignored. Never commit a key or paste it in chat.

| Variable | Used by | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | Planned Anthropic provider (T06) | Listed in `.env.example`; nothing reads it yet |
| `OLLAMA_URL` | Chat today | Default `http://localhost:11434` |
| `OLLAMA_MODEL` | Chat today | Default `llama3.2:3b` |
| `OLLAMA_TIMEOUT` | Chat today | Seconds, default 60 |
| `BENEFITS_DB_PATH` | Database | Default `database/benefits.db` |

`VITE_API_URL` is listed in `infra/README.md` for later; the frontend does not read it yet (not verified beyond a code search).

## Chat model
Without a reachable model, `/health` reports `chat_mode: "unavailable"` and the assistant says so plainly. The rest of the app keeps working. To use Ollama: install it, run `ollama pull llama3.2:3b`, and leave it running.

## Database
From `backend/`:

```
.venv/Scripts/python -m app.db            # create database/benefits.db and load the seed
.venv/Scripts/python -m app.db --reset    # delete it and rebuild
```

The demo clock is fixed at `2026-11-01`. The database is not connected to the API yet (T05). More: [../database/README.md](../database/README.md).

## Troubleshooting
- Port 8000 or 5173 already in use: stop the other process, or pick another port (and update the CORS list in `backend/app/main.py` for the frontend).
- `ModuleNotFoundError: app`: run commands from `backend/`.
- Chat says "unavailable": Ollama is not running or the model is not pulled.
