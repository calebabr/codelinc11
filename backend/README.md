# Backend (FastAPI)

Python 3.11+, FastAPI, Pydantic v2. All dental money math lives in `app/engine/`. The API contract is `app/models.py`. Overview: [../docs/PROTOTYPE.md](../docs/PROTOTYPE.md); build spec: [../docs/PROTOTYPE-SPEC.md](../docs/PROTOTYPE-SPEC.md).

## Setup

From `backend/`:

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env   # optional; defaults work without it
```

Without activating, you can call the venv directly, e.g. `.venv/Scripts/python -m pytest -q`.

## Run

```bash
python -m uvicorn app.main:app --reload --port 8000
```

Interactive docs: http://localhost:8000/docs . Check http://localhost:8000/health .

## Test

```bash
python -m pytest -q
```

118 tests; they need no network and no Ollama. Golden numbers (G1-G6, S2) live in `tests/test_engine.py`; never adjust them to make code pass. Lint: `ruff check .`

## Environment variables

Read with python-dotenv from `backend/.env` (template: `../.env.example`). All optional.

| Variable | Default | Meaning |
|---|---|---|
| `OLLAMA_URL` | `http://localhost:11434` | Where Ollama listens |
| `OLLAMA_MODEL` | `llama3.2:3b` | Model used for chat |
| `OLLAMA_TIMEOUT` | `60` | Seconds to wait for a chat reply |

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | `ok`, `ollama_available`, `ollama_model`, `chat_mode` |
| GET | `/plans`, `/plans/{id}` | Sample plans (`demo_ppo`, `basic_ppo`) |
| GET | `/procedures?q=` | Procedure search |
| POST | `/estimate` | In/out-of-network estimate with trace |
| POST | `/schedule` | Plan My Year optimizer |
| POST | `/benefits-status` | Remaining benefits and reminder |
| GET | `/reminders.ics` | Calendar reminders (Dec 1 and Dec 15) |
| POST | `/treatment-plan/parse` | Parse pasted dentist quote text; rules always, optional Ollama assist (validated against catalog and source text) |
| POST | `/questions` | Deterministic questions to ask your dentist |
| POST | `/savings-tips` | Savings tips (math in `app/engine/tips.py`) |
| POST | `/chat` | SSE stream: `tool_start`, `tool_end`, `token`, `done`, `error` |

Request/response shapes are in `app/models.py`. CORS allows `http://localhost:5173`.

## Layout

```
app/main.py     routes          app/models.py   contract (do not edit casually)
app/treatment_parser.py  quote parser   app/questions.py  question templates
app/routers/    treatment_plan, questions, tips
app/data.py     seed loader     app/search.py   procedure search
app/engine/     estimate, annual, sequencer, status, tips
app/agent/      ollama_client, tools, loop, guard
app/rag/        empty placeholder (planned)
data/           plans/*.json, cdt_codes.json      tests/   pytest suites
```

## Chatbot and Ollama

The chat uses a small local open-source model through [Ollama](https://ollama.com). The model **never computes dollar amounts**: it calls tools that wrap the engine, and a number guard rejects any `$` amount in its answer that did not come from a tool result.

Install:
1. Download and install Ollama from https://ollama.com/download .
2. Pull the model: `ollama pull llama3.2:3b`
3. Make sure it is running: `ollama serve` (the desktop app starts it automatically; if the port is already in use, it is already running).

The real Ollama path is **not yet verified with a live model**: it is covered by tests using a fake client, and on the dev machine chat ran in offline mode.

Verify: open `/health`. With Ollama up you should see `"ollama_available": true` and `"chat_mode": "ollama"`.

The quote parser may also use Ollama to help with lines the rules could not read; anything it proposes is checked against the catalog and the source text, and any failure silently keeps the rules result. Questions and savings tips never use the LLM.

## Fallback (offline) mode

If Ollama is not installed or not running, times out, errors, or its answer fails the number guard, `/chat` automatically uses a deterministic handler: keyword intents (procedure name, "january"/"wait"/"schedule", "left"/"remaining"/"benefits") that call the same tools and write the answer from templates. Nothing breaks; the final `done` event carries `mode: "fallback"` and `/health` shows `chat_mode: "fallback"`. Everything except the chat's free-form language works identically.
