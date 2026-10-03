# BACKEND.md: Backend People and Agents

Read [FEATURES.md](FEATURES.md) first. That file says **what** to build; this one says **how** the backend gets built and who does what. The backend has three workstreams with separate folders, so they can run in parallel without conflicts:

| Workstream | Human reviewer | AI agent (writes code + tests) | Folders |
|---|---|---|---|
| **A. API & integration** | BE (merge captain) | Claude Code + sub-agents | `backend/app/main.py`, `models.py`, `extract.py`, `backend/fixtures/`, `backend/tests/test_api.py`, `.github/`, root config, `docs/ARCHITECTURE.md` |
| **B. Math engine + data** | M (applied math) | Kiro (spec mode) | `backend/app/engine/`, `backend/tests/test_engine*.py`, `backend/data/`, `docs/MATH.md`, `.kiro/` |
| **C. AI / RAG** | FLEX (flex teammate) | Claude Code + sub-agents | `backend/app/agent/`, `backend/app/rag/`, `backend/tests/test_agent*.py`, `backend/tests/test_rag_eval.py`, `docs/AI.md` |

**Agents write the code, tests and docs. Humans direct, check and approve.** Each "human" section below is a checklist of what to tell the agent and what to verify before approving.

**Stack:** Python 3.11+, FastAPI, Pydantic v2, uvicorn, SQLite via SQLModel (only if needed; usage can travel with each request), pytest.

---

## 1. Shared backend setup (BE's agent, first 45 minutes)

```bash
cd backend && python -m venv .venv
```

```bash
pip install fastapi "uvicorn[standard]" pydantic sqlmodel numpy pulp pdfplumber rank_bm25 sentence-transformers ics python-dotenv httpx pytest hypothesis ruff
```

Then add your LLM provider's SDK (for example `anthropic` or `openai`) and freeze everything into `requirements.txt`.

```
backend/
├── app/
│   ├── main.py            # A: FastAPI app, CORS, routes
│   ├── models.py          # A: THE API CONTRACT (Pydantic)
│   ├── extract.py         # A: plan PDF → Plan JSON (F6)
│   ├── engine/            # B: estimate.py, annual.py, sequencer.py, status.py, simulate.py
│   ├── agent/             # C: loop.py, tools.py, prompts.py, guard.py
│   └── rag/               # C: index.py, retrieve.py
├── data/                  # D: cdt_codes.json, fees_27401.json, plans/*.json, plan_docs/*.md
├── fixtures/              # A: stub responses (also used by frontend MSW tests)
└── tests/
    ├── test_engine.py         # B: GOLDEN numbers from FEATURES §2; agent-written, M-approved
    ├── test_engine_props.py   # B: property-based tests
    ├── test_api.py            # A
    ├── test_agent.py          # C
    ├── test_rag_eval.py       # C
    └── test_extra_*.py        # D
```

**Environment (`backend/.env`, never committed; commit `.env.example`):** `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`, `EMBEDDINGS=local|provider`, `CORS_ORIGINS=http://localhost:5173`.

**Run:** `uvicorn app.main:app --reload --port 8000`. FastAPI serves interactive API docs at `/docs`, which is great for testing and for showing judges.

---

## 2. Workstream A: API & integration (BE + Claude Code)

### BE (human): integration reviewer + merge captain
Git process for the whole team: [GIT-WORKFLOW.md](GIT-WORKFLOW.md). BE and FLEX set up the repo, branch protection and CI in the first 40 minutes.
- **Directs:** tells the API agent which endpoint to build next (order below), approves every change to the API contract (`models.py`) before it's merged, and announces it in `#contract` so FE's agent reruns `npm run gen:api`.
- **Checks before merging any PR (from any workstream):** CI is green; the agent's report lists the tests it ran; the change stays in that workstream's folders; for endpoint PRs, BE opens `/docs`, sends the G3 request, and sees `you_pay: 800`.
- **Runs the integration checkpoints** (6:30 PM, 10:00 PM, 2:00 AM, 5:00 AM): pulls `main`, clicks through the app with the team.
- Fills gaps: if a workstream falls behind, BE points their own agent at the problem.

### API agent (Claude Code)
- **Job:** routes, Pydantic models, stub fixtures, PDF extraction endpoint, `.ics` endpoint, CI, deployment config.
- **Calls the engine and the agent only through their public functions.** It never puts math or prompts in route code.
- **Not allowed:** editing `engine/`, `agent/`, `rag/`, `data/`, or the golden tests.

### Order of work
1. **By 2:30 PM:** `models.py` with every request/response model from FEATURES.md; **every endpoint returns stub JSON** from `fixtures/` (stub values = golden numbers, so stubs and real results match). CORS enabled. CI running.
2. **By 6:30 PM:** `/plans`, `/procedures`, `/estimate` wired to the real engine (as soon as M's `estimate()` passes G1–G6).
3. **By 10:00 PM:** `/schedule` wired to the real engine.
4. **By 2:00 AM:** `/benefits-status`, `/reminders.ics`, `/chat` (SSE, wraps FLEX's agent loop).
5. **2:00–5:00 AM:** `/plans/extract` (F6) or `/simulate` (F7). Deploy the backend (Render, Railway or Fly.io) **and** keep a local backup ready.

**SSE events for `/chat`** (agreed with FLEX and FE): `tool_start {name}`, `tool_end {name}`, `token {text}`, `done {}`, `error {message}`.

### Sub-agent team
| Sub-agent | Job |
|---|---|
| **Endpoint builder** | One route at a time: model → route → wire to engine/agent function |
| **Test writer** | `test_api.py` with FastAPI's `TestClient`: every endpoint returns the right shape, and `/estimate` with G3 input returns 800 |
| **DevOps** | GitHub Actions (`ruff`, `pytest`, and the frontend's `typecheck`/`build`/`test`), Dockerfile or Render config, `.env.example` |
| **Docs writer** | `backend/README.md` (setup, run, test) and `docs/ARCHITECTURE.md` (the diagram from the deep dive, kept up to date) |

### `backend/CLAUDE.md` (shared by BE's and FLEX's agents)
```markdown
# Backend rules
@../docs/CONVENTIONS.md
@../docs/FEATURES.md

- Python 3.11, FastAPI, Pydantic v2. Run: `uvicorn app.main:app --reload`. Test: `pytest -q`. Lint: `ruff check .`
- Stay in your workstream's folders (docs/BACKEND.md table). Ask before touching others.
- models.py is the API contract: only workstream A changes it.
- NEVER compute dollar amounts outside app/engine/. NEVER edit tests/test_engine.py.
- You write the code AND the tests. Every new endpoint or tool needs a test. Run `pytest -q` before saying a task is done.
- Finish every task with a report: what changed, tests run and results, and exactly what your human should check (URL, request, expected number).
```

---

## 3. Workstream B: Math engine (M + Kiro)

### M (human): math reviewer
M writes almost no code. M's value is **knowing what the right answer is**.
- **Sets the golden numbers** (FEATURES.md §2) and checks each one on paper. Every other test in the project depends on them.
- **Writes the requirements** for Kiro in plain language: deductible, coinsurance, annual max, frequency limits, the sequencer objective and constraints, the Monte Carlo model. Kiro turns them into a design, tasks, code and tests.
- **Checks before approving:**
  - the golden test file: every expected value matches FEATURES.md §2 exactly
  - every formula in Kiro's design document
  - the calculation trace for G3 and S2 reads correctly, step by step
  - any property-based test that fails: is it a code bug or a wrong assumption?
- Approves `docs/MATH.md` (Kiro writes it from the spec). It becomes a pitch slide.
- Is the person to ask whenever a number looks wrong anywhere in the app.

### Engine agent (Kiro, spec mode)
- **Job:** turns M's requirements into a design and task list, then writes the engine in pure Python, **the golden test file (from FEATURES.md §2, first, before the engine code)**, the property-based tests, and `docs/MATH.md`.
- **Pure functions only:** no web code, no LLM calls, no file access except reading `data/`. Input in, result + trace out.
- **Not allowed:** changing a golden expected value to make a test pass (stop and tell M instead), or editing anything outside its folders.
- Set up a Kiro **steering file** (`.kiro/steering/engine.md`) containing the rules above and a pointer to `docs/CONVENTIONS.md` and `docs/FEATURES.md`.
- **Credits:** spend them on spec + implementation of `estimate`, `annual`, `sequencer`. If Kiro credits run out, a Claude Code seat (usually BE's) takes over engine tasks using the same spec files in `.kiro/specs/`. M still reviews.

### Specs, in order
| Spec | Functions | Must pass | Due |
|---|---|---|---|
| 1. Estimate | `estimate(proc, plan, usage, in_network)` with trace; frequency limits; waiting periods | G1–G6 | **6:00 PM** |
| 2. Annual + sequencer | `run_year()`; `best_schedule()` (exhaustive search, urgency/dependency/deadline checks, deductible applied to lowest-coinsurance item first) | S2 (save $895) | **9:30 PM** |
| 3. Benefits status | `benefits_status()`: remaining max, deductible, frequency used, unused preventive value | F4 acceptance | **midnight** |
| 4. Monte Carlo (stretch) | `simulate()` with common random numbers, fixed seed | Results repeat exactly with the same seed | 4:00 AM |

### Engine tests (Kiro writes them, M approves)
- **Golden** (`test_engine.py`): G1–G6, S2. Exact dollar amounts copied from FEATURES.md §2. Written **before** the engine code, so the code is built to pass them.
- **Property-based** (`test_engine_props.py`, with `hypothesis`). For random valid plans, fees and usage:
  - `plan_pays + you_pay == billed` (within 1 cent)
  - `0 <= plan_pays <= remaining annual max`
  - `you_pay >= 0`; preventive with the deductible waived never charges a deductible
  - the sequencer's optimized out-of-pocket ≤ the "everything now" out-of-pocket, and urgent items are always in year 0
  - exhaustive search and the ILP (if built) agree on small cases

---

## 4. Workstream C: AI / RAG (FLEX + Claude Code)

### FLEX (human): AI behavior reviewer
- **Directs:** decides how the AI should sound and behave (tone, safety wording, when to ask a follow-up), and describes it to the agent, which writes the prompts.
- **Approves the evaluation sets** the agent drafts (25 lay phrases → codes; 10 chat questions → expected numbers). Adds tricky cases the agent didn't think of.
- **Checks before approving:** reads 5–10 real answers from the chat at each checkpoint (tests can't judge tone); confirms the retrieval score in `docs/AI.md` is ≥ 90%; confirms the number guard catches a made-up dollar amount.
- Agrees the tool list with M (which engine functions exist) and the SSE events with BE and FE.

### AI agent (Claude Code)
- **Job:** procedure search index, plan-doc index, tool definitions wrapping the engine, the tool-calling loop, prompts, the number guard, the extraction prompt (F6).
- **Not allowed:** doing math in prompts or code (call the engine), editing `engine/` or `models.py`.

### Order of work
1. **By 4:30 PM:** LLM provider working; procedure index + `find_procedure("cap on my back tooth")` returns D2740 in the top 3, from the command line.
2. **By 10:00 PM:** explanation endpoint for F2 (trace → plain English) and F3 ("why this order?"); follow-up question when the input is unclear.
3. **By 2:00 AM:** the full tool-calling loop for chat (F5), streaming, number guard, plan-doc search with citations.
4. **2:00–5:00 AM:** the extraction prompt (F6) if chosen; tune prompts against the evaluation sets.

### Sub-agent team
| Sub-agent | Job |
|---|---|
| **RAG builder** | `rag/index.py` and `retrieve.py`: keyword search (BM25) + embeddings + rank fusion |
| **Agent-loop builder** | `agent/loop.py`, `tools.py`: tool calling, max 6 steps, SSE event generator |
| **Eval & test writer** | `test_agent.py`, `test_rag_eval.py`, guard tests (below) |
| **Docs writer** | `docs/AI.md`: the tools, the prompts, how the guard works, evaluation results. This feeds a pitch slide. |

### Tests and evaluations
- **Number guard unit tests:** an answer with a dollar amount not in the tool outputs → flagged; an answer with only matching amounts → passes; rounding within $1 is allowed.
- **Tool loop tests with a fake LLM:** a scripted fake model that requests `estimate_cost`, so the loop, tool execution and SSE events are tested **without network calls or cost**.
- **Retrieval evaluation (`test_rag_eval.py`):** about 25 lay phrases → expected codes ("cap" → D2740, "deep cleaning" → D4341, "pulled tooth" → D7140). Target: **≥ 90% top-3 accuracy**. Report the score in `docs/AI.md`.
- **Answer evaluation (run by hand, not in CI, since it calls the real LLM):** 10 chat questions with expected numbers ("crown in January?" → $625 and $800). Run at each checkpoint, and record the pass rate.

---

## 5. Data, QA, README and pitch (spread across the team)

There is no separate "data person" any more. These jobs have owners:

| Job | Owner | How |
|---|---|---|
| **Gather real plan facts** (plan values from the reference site and the enrollment video; FAIR Health 50th/80th percentile fees for ZIP 27401 for ~30 procedures) | **M** | M collects them into a simple spreadsheet. M's Kiro agent (vibe mode, small task) converts it to `cdt_codes.json`, `fees_27401.json`, `plans/*.json` with a validation script: every code has a category, a fee and at least 3 synonyms. M then updates the golden numbers in FEATURES.md §2 **before** anyone else changes anything. |
| **Plan-document text for RAG** (benefits booklet sections as markdown in `backend/data/plan_docs/`) | **M** gathers, **FLEX's** agent indexes | |
| **Data integrity tests** (every plan file loads into the `Plan` model; every code has a fee) | **M's** Kiro agent | `backend/tests/test_engine_data.py` |
| **QA: use the app like a user** at every checkpoint, file bugs on the task board | **Everyone** at checkpoints; **FLEX** runs the full pass at 2:00 AM and 5:00 AM when the AI work is stable | Use the three demo flows from FEATURES.md §3 |
| **README, pitch, demo script, slides, backup video** | **DES** | With **IBM Bob** drafting README and script text from the docs; DES edits and designs. See [FRONTEND.md §1](FRONTEND.md) |
| **PR reviews by a second AI** | **DES's Bob** (optional) | Ask Bob to review 3–4 important PRs (engine, contract, agent). A second AI catches different mistakes. Bob's trial has 50 coins, so use them selectively. |

**Gap filling:** FLEX is the flexible teammate. When the AI work is on track, FLEX asks at the stand-up which workstream is behind and points their agent at it. If M's Kiro credits run out, FLEX's Claude Code seat takes over engine tasks from the spec files in `.kiro/specs/`, and M still reviews.

---

## 6. Documentation everyone produces

Each person's **docs-writer sub-agent** keeps these current. Judges ask "how did you build this?", and these files plus the Kiro specs are the answer.

| File | Owner | Contents |
|---|---|---|
| `README.md` | DES (Bob drafts) | Pitch, screenshots, quick start, team |
| `docs/ARCHITECTURE.md` | BE | Diagram, request flow, folder map |
| `docs/MATH.md` | M | Formulas, worked examples, sequencer and Monte Carlo explained |
| `docs/AI.md` | FLEX | Tools, prompts, number guard, evaluation scores |
| `/docs` (auto-generated by FastAPI) | BE | Interactive API reference |
| `frontend/README.md` | FE | Setup, scripts, component map |
| `.kiro/specs/` | M | Requirements → design → tasks for the engine |

---

## 7. Definition of done (any backend task)

- [ ] Code is in your workstream's folders only
- [ ] Tests added; `pytest -q` and `ruff check .` pass
- [ ] Golden tests still pass (expected values never changed without M's approval)
- [ ] The agent's report says what the human should check, and the human checked it
- [ ] If the API shape changed: BE approved it and announced it in `#contract`
- [ ] Docs updated if behavior changed
- [ ] PR opened, reviewed by a person (plus Bob if credits allow), merged by BE
