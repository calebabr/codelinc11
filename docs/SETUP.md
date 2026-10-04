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
- Run the tests: `.venv/Scripts/python -m pytest -q` (391 tests, about 2 minutes, no internet or model needed)
- Lint: `.venv/Scripts/python -m ruff check .`

## Frontend
From `frontend/`:

```
npm install
npm run dev          # http://localhost:5173
npm run dev:lan      # same, but phones on your Wi-Fi can open it (see DEMO-PHONES.md)
npm run test         # 151 tests, about 1 minute
npm run typecheck
npm run build
```

The frontend calls the backend at `VITE_API_URL` (default `http://localhost:8000`). The backend allows requests from `http://localhost:5173` and `http://127.0.0.1:5173` (change with `CORS_ORIGINS` / `CORS_ORIGIN_REGEX` in `backend/.env`). Open http://localhost:5173/welcome (landing) or http://localhost:5173/login (demo sign-in). Restart Vite after installing packages.

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
| `ASSISTANT_ALLOW_ANONYMOUS` | Assistant | Default `0`. Set `1` only for local experiments without sign-in |
| `NOTIFY_WINDOW_DAYS` | Notification bell | Appointments and reminders this many days ahead (or fewer) of the demo clock get a notification. Default 45 |
| `DEMO_SANDBOX_TTL_HOURS`, `DEMO_MAX_SANDBOXES` | Demo families | Each visitor's private demo family lives 24 hours (default); at most 300 at once (default) |
| `RATE_LIMIT_ENABLED` | Rate limits | Default `1`. `0` turns every limit off |
| `RATE_LOGIN_PER_MINUTE`, `RATE_LOGIN_PER_HOUR` | Rate limits | Creating demo families, per client address. Defaults 10 and 60. Raise them for a room full of phones on one connection |
| `RATE_CHAT_PER_MINUTE`, `RATE_CHAT_PER_DAY` | Rate limits | Chat messages per household. Defaults 12 and 200 |
| `CHAT_GLOBAL_DAILY_CAP` | Rate limits | Chat messages for everyone per day (protects the Anthropic key). Default 3000 |
| `RATE_ATTACH_PER_MINUTE` | Rate limits | PDF uploads per minute. Default 5 |
| `RATE_COMPUTE_PER_MINUTE` | Rate limits | `/simulate`, `/schedule`, `/estimate`, `/annual-cost` and visits per minute. Default 60 |
| `RATE_RESET_PER_MINUTE` | Rate limits | Demo resets per minute. Default 5 |
| `TRUST_PROXY` | Rate limits | Default `0`. Set `1` behind a trusted proxy or tunnel so the first `X-Forwarded-For` address counts as the client |
| `CORS_ORIGINS`, `CORS_ORIGIN_REGEX` | CORS | Browsers allowed to call the API. Default the two localhost:5173 addresses. The regex is for tunnel addresses (for example `https://.*\.trycloudflare\.com`) |

Limits are counted in memory in one server process and restart with it. They are listed with comments in `.env.example`.

`VITE_API_URL` (in `frontend/.env`, optional) points the frontend at the backend. The backend reads `backend/.env` only at start, so restart it after editing.

## Chat model
With `ANTHROPIC_API_KEY` set, `/health` reports `chat_mode: "anthropic"`. Without a reachable model it reports `"unavailable"` and the assistant says so plainly; the rest of the app keeps working. To use Ollama instead: install it, run `ollama pull llama3.2:3b`, and leave it running.

## Database
From `backend/`:

```
.venv/Scripts/python -m app.db            # create database/benefits.db and load the seed
.venv/Scripts/python -m app.db --reset    # delete it and rebuild
```

The demo clock is fixed at `2026-11-01`. The backend also seeds the database automatically when it is empty. **Reset demo data** on Home (or `POST /demo/reset`) restores only the signed-in person's own demo family; other visitors' families are not touched. `python -m app.db --reset` rebuilds everything (stop the backend first). More: [../database/README.md](../database/README.md).

## Troubleshooting
- Port 8000 or 5173 already in use: stop the other process, or pick another port (and add the new frontend address to `CORS_ORIGINS` in `backend/.env`).
- `ModuleNotFoundError: app`: run commands from `backend/`.
- Chat says "unavailable": `ANTHROPIC_API_KEY` is missing or wrong in `backend/.env` (restart the backend after fixing), or there is no internet.
- Do not start the backend with `--reload` on Windows: it can leave an orphan process holding port 8000.
- Blank page after `npm install`: restart Vite.

## Deploy on AWS
`main` is deployed by a teammate (using Kiro). The kit below is only a reference and was not run in AWS. A CloudFormation kit and step-by-step runbook are in [../infra/aws/RUNBOOK.md](../infra/aws/RUNBOOK.md) (CloudFront + S3 for the frontend, one EC2 server for the backend, about $12 to $20 a month). It needs an AWS account and the AWS CLI; the Anthropic key goes in AWS Parameter Store, not in the repo.

## Open it on a phone (QR code)
Same Wi-Fi, a tunnel, or public hosting, plus a QR script and a pre-demo checklist: [DEMO-PHONES.md](DEMO-PHONES.md).
