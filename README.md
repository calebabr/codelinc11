# codelinc11: Dental Benefits Prototype

Lincoln Financial codeLinc 11, Path 1. **Know what you'll owe before you sit in the chair.** Pick a dental plan, estimate what a procedure costs you, plan treatments across plan years to save money, track remaining benefits, and ask a chatbot.

- **Estimate**: plan pays vs you pay, in-network vs out-of-network, with the math shown.
- **Plan My Year**: finds the cheapest schedule for several treatments (demo: $2,300 down to $1,405).
- **My Benefits**: remaining maximum, deductible, cleanings, and a calendar reminder.
- **Dentist Quote**: paste a dentist's treatment plan, compare to typical prices, send it to Plan My Year.
- **Questions and savings tips**: a checklist to ask your dentist and tips like timing, network and FSA/HSA (overlapping, never add them up).
- **Chatbot**: local LLM via Ollama, with a guaranteed offline fallback. The LLM never does the math.

Stack: React + Vite + TypeScript (frontend), FastAPI + Pydantic v2 (backend), Ollama (optional).

## Quick start

Open two terminals from the repo root.

**Terminal 1: backend** (http://localhost:8000)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

**Terminal 2: frontend** (http://localhost:5173)

```bash
cd frontend
npm install
npm run dev
```

**Optional: real chatbot.** Install [Ollama](https://ollama.com/download), then `ollama pull llama3.2:3b` and `ollama serve`. Without it, chat runs in offline mode. Check http://localhost:8000/health.

Status: 118 backend and 58 frontend tests pass. Not built yet (planned): plan PDF extraction, Compare Plans, deployment; real Ollama not yet verified with a live model.

Tests: `python -m pytest -q` in `backend/`; `npm run typecheck && npm run build && npm run test` in `frontend/`.

## Docs

- [docs/PROTOTYPE.md](docs/PROTOTYPE.md): start here (features, dental terms, architecture, demo script)
- [docs/PROTOTYPE-SPEC.md](docs/PROTOTYPE-SPEC.md): the build spec and math rules
- [docs/FEATURES.md](docs/FEATURES.md): team roster, golden numbers, schedule
- [docs/CONVENTIONS.md](docs/CONVENTIONS.md): rules for people and agents
- [docs/GIT-WORKFLOW.md](docs/GIT-WORKFLOW.md): branches, PRs, merging
- [backend/README.md](backend/README.md) and [frontend/README.md](frontend/README.md)

## Team and branches

The prototype lives on branch `proto/dental-prototype`. Never commit directly to `main`; use short-lived branches and pull requests as described in the Git workflow doc. Each person or agent edits only their own folders.

All prices and plan rules are placeholder data, not real. Estimates only: actual costs depend on the dentist's charges and claim review.
