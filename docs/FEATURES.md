# FEATURES.md: What We're Building, Who Builds It, and When It's Done

**This is the shared source of truth.** Every person and every AI agent reads this file. If a feature changes, it changes here first.
Companion briefs: [FRONTEND.md](FRONTEND.md) (FE + DES and the UI agent) and [BACKEND.md](BACKEND.md) (M, BE, FLEX and their agents). Full technical detail: [planning/path1-deep-dive.md](planning/path1-deep-dive.md).

---

## 1. Team roster: people and agents

**Agents write nearly all of the code and tests. Humans direct the agents, check the results, and approve.** A human's job each hour is: give the agent a clear task → check the result (in the browser, against the golden numbers, by reading the explanation) → approve, or send it back with specific feedback.

| Person | Who they are | Human role (direct, check, approve) | AI tool | Agent's job (writes the code and tests) | Folders the agent may edit |
|---|---|---|---|---|---|
| **M** | Applied math (CS minor), **backend** | **Math reviewer + data owner:** sets the golden numbers, writes the requirements in plain language, checks every formula and test, gathers the real plan values and FAIR Health fees | **Kiro** (spec mode) | "Engine agent": engine code, golden test code (from §2), property-based tests, data JSON files, `docs/MATH.md` | `backend/app/engine/`, `backend/tests/test_engine*.py`, `backend/data/`, `docs/MATH.md`, `.kiro/` |
| **BE** | CS major, **backend** (FastAPI) | **Integration reviewer + merge captain:** approves the API contract, merges PRs that touch shared files, runs checkpoints | **Claude Code** + sub-agents | "API agent": routes, contract, fixtures, PDF extraction, API tests, CI, deployment, architecture doc | `backend/app/main.py`, `models.py`, `extract.py`, `backend/fixtures/`, `backend/tests/test_api.py`, `.github/`, root config, `docs/ARCHITECTURE.md` |
| **FE** | CS major, **frontend** (React) | **Build reviewer:** checks every screen in the browser (desktop + phone) against the Figma frames, directs the UI agent | **Claude Code** + sub-agents | "UI agent": screens, charts, chat drawer, component + end-to-end tests, frontend docs | `frontend/`, `docs/FRONTEND.md` |
| **DES** | **Frontend design** (Figma) | **Design owner + pitch owner:** makes the style tile and mockups, hands them to the UI agent, reviews screenshots and files polish tickets, writes the demo script and slides | **Figma** (+ **IBM Bob** for README/pitch drafts, optional) | Bob: README, pitch and demo-script drafts, PR review comments. (Frontend code changes go through FE's agent as polish tickets.) | `docs/design/`, `docs/pitch/`, `README.md` |
| **FLEX** | CS major, **flex** (any team) | **AI behavior reviewer + gap filler:** checks tone, safety wording and answer quality; approves prompts and evaluation sets. When the AI work is on track, picks up whichever workstream is behind | **Claude Code** + sub-agents | "AI agent": LLM tool loop, RAG search, prompts, number guard, agent tests, evaluations, `docs/AI.md` | `backend/app/agent/`, `backend/app/rag/`, `backend/tests/test_agent*.py`, `backend/tests/test_rag_eval.py`, `docs/AI.md` |

**Team shape:** 2 frontend (FE + DES), 2 backend (M + BE), 1 flex (FLEX). The AI/RAG workstream is the biggest one with no natural owner, so it goes to FLEX.

**Shared files** (`docs/FEATURES.md`, `docs/BACKEND.md`, `docs/CONVENTIONS.md`): changed only after agreement at a stand-up. FEATURES.md §2 (the golden numbers) changes only with M's approval.

**Each Claude Code seat is an orchestrator.** It plans each feature and hands focused tasks to its own small team of sub-agents (builder, test writer, docs writer, and for the frontend a design polisher). Sub-agents running at the same time must work on separate files. Team details: [FRONTEND.md §7](FRONTEND.md) and [BACKEND.md §2 and §4](BACKEND.md). Shared rules: [CONVENTIONS.md](CONVENTIONS.md). Git, branches and merging: [GIT-WORKFLOW.md](GIT-WORKFLOW.md).

**Why it's organized this way:** we split **ownership by layer** (each agent stays in its own folders, so there are no merge conflicts) but **schedule by feature** (everyone builds the same feature at the same time, see section 4). This means each integration checkpoint finishes one complete feature from end to end, instead of five half-built layers that don't connect.

**Who decides what:**
- **M** decides the math: whether a formula or number is correct.
- **BE** decides the API contract (`models.py`) and what gets merged.
- **DES** decides how things look (the Figma design is the reference); **FE** decides how they behave and signs off that the build matches.
- **DES** decides what goes in the demo and the pitch (with the whole team's input).
- **FLEX** decides how the AI sounds.
- Scope changes (adding or cutting a feature) are a quick team decision at a stand-up.

---

## 2. Demo plan and golden numbers

Every layer uses this **one demo plan** so numbers match everywhere. Values are placeholders until M replaces them with real numbers from the reference material. **If they change, M updates the golden numbers below, and only then does anyone change code.**

**Demo PPO:** deductible $50 (waived for preventive) · annual max $1,500 · coinsurance: preventive 100%, basic 80%, major 50% · plan year starts Jan 1 · cleanings limited to 2 per plan year · out-of-network uses the same coinsurance rates, paid on the in-network allowed amount (the dentist can bill the difference).

| Code | Procedure | Category | Typical fee (in-network, p50) | Out-of-network billed (p80) |
|---|---|---|---|---|
| D1110 | Cleaning (adult) | preventive | $120 | $160 |
| D2392 | Filling, 2-surface, back tooth (composite) | basic | $200 | $260 |
| D3330 | Root canal, molar | basic | $1,100 | $1,400 |
| D2740 | Crown, porcelain/ceramic | major | $1,200 | $1,500 |

### Golden scenarios (M sets and checks these numbers; the engine agent turns them into `backend/tests/test_engine.py`; M approves the test file)

| ID | Situation | Expected result |
|---|---|---|
| **G1** | Cleaning, fresh year | Plan pays $120, **you pay $0** (deductible waived, 100%) |
| **G2** | One filling, fresh year | Deductible $50 → 80% × $150 = $120 plan → **you pay $80** |
| **G3** | Crown, deductible not yet met, $1,100 of max already used | 50% × $1,150 = $575, capped at $400 left → **you pay $800** |
| **G4** | Same crown, next plan year (fresh) | Plan pays $575 → **you pay $625** (G3 vs G4: waiting saves $175) |
| **G5** | Crown, out-of-network, fresh year | Plan pays $575 (on $1,200 allowed), billed $1,500 → **you pay $925**, of which **$300 is balance billing** |
| **G6** | 3rd cleaning in the same plan year | **Not covered** (frequency limit) → you pay $120, with the reason shown |

### Sequencer scenario S2 (the main demo moment)

It's November. Deductible already met; $1,100 of the $1,500 max used ($400 left).
Treatment: root canal D3330 (**urgent**), crown D2740 (after the root canal, can wait until January), 2 fillings D2392 (flexible).

| | Plan pays | You pay |
|---|---|---|
| **Everything now:** covered would be $880 + $600 + $160 + $160 = $1,800, but only $400 is left | $400 | **$2,300** |
| **Optimized, this year:** root canal only. Covered $880, capped at $400 | $400 | $700 |
| **Optimized, next year (fresh max):** crown first (deductible $50 → 50% × $1,150 = $575), then fillings ($160 + $160) | $895 | $705 |
| **Optimized total** | $1,295 | **$1,405** |

**Savings: $895.** The urgent root canal stays in the current year.
Note for M: in a fresh year, apply the deductible to the item with the **lowest coinsurance** (here the crown). Putting it on a filling instead costs the patient $15 more ($720 vs $705). Order within a year matters, and the engine should handle it.

---

## 3. Features

Priority: **P0** = must have for the demo · **P1** = should have · **P2** = stretch, only if P0 and P1 are done.
Each feature lists what each layer owes. A feature is **done** only when every box is checked, **its tests pass, its docs are updated, and it works on `main`**.

**Tests and docs every feature needs** (built by each workstream's test-writer and docs-writer sub-agents):
- **Engine:** golden test(s) for the feature's numbers + property-based tests (BACKEND.md §3)
- **API:** `TestClient` test that the endpoint returns the right shape and the golden numbers (BACKEND.md §2)
- **AI:** fake-LLM tool-loop test; retrieval/answer evaluations where relevant (BACKEND.md §4)
- **UI:** component tests with MSW fixtures + a Playwright end-to-end test for the acceptance line (FRONTEND.md §8)
- **Docs:** MATH.md / AI.md / ARCHITECTURE.md / READMEs updated (BACKEND.md §6)

### F1: Plan setup (P0)
*As an employee, I choose my plan and enter what I've already used this year.*
- [ ] **Data (M):** `plans/demo_ppo.json` (+ 1–2 more plans), matching section 2
- [ ] **API (BE):** `GET /plans`; usage sent along with each request (stored in frontend state)
- [ ] **UI (FE):** plan picker; "already used this year" inputs (max used, deductible met), default 0; plan summary card in plain English
- **Acceptance:** choosing Demo PPO and entering $1,100 used shows "$400 left this year" everywhere in the app.

### F2: Estimate: "What will I owe?" (P0)
*As an employee, I describe a procedure in plain English and see what I'll pay, and why.*
- [ ] **Engine (M):** `estimate()` with calculation trace; G1–G6 pass
- [ ] **Data (M):** `cdt_codes.json` (~30 codes, 3–5 synonyms each) + `fees_27401.json`
- [ ] **API (BE):** `POST /estimate`, `GET /procedures?q=`
- [ ] **AI (FLEX):** `find_procedure` (hybrid search over codes); a plain-English explanation built from the trace; asks a follow-up question if the input is unclear
- [ ] **UI (FE):** input with autocomplete, BreakdownCard ("You pay / Plan pays"), CostWaterfall, "Show the math" trace, in-network/out-of-network toggle, glossary tooltips
- **Acceptance:** typing "cap on my back tooth" → D2740 → with G3 usage shows **You pay $800**; the out-of-network toggle shows the G5 numbers; every dollar figure on screen matches the engine.

### F3: Plan My Year (P0)
*As an employee with a treatment plan, I see when to schedule each procedure to pay the least.*
- [ ] **Engine (M):** `run_year()`, `best_schedule()` (exhaustive search over assignments); S2 passes; urgent items never move
- [ ] **API (BE):** `POST /schedule` returning schedule, total out-of-pocket, baseline ("everything now"), savings, trace
- [ ] **AI (FLEX):** "Why this order?" explanation from the schedule trace
- [ ] **UI (FE):** treatment list builder (procedure, urgency, "after" dependency), YearTimeline with plan-year divider, annual-max bars per year, savings banner, "everything now" vs "optimized" toggle
- **Acceptance:** entering S2 shows **$2,300 → $1,405, save $895**, with the root canal in the current year.

### F4: My Benefits (P1)
*As an employee, I see what I have left and get reminded before benefits expire.*
- [ ] **Engine (M):** `benefits_status()`: remaining max, deductible progress, frequency counts, unused preventive value
- [ ] **API (BE):** `GET /benefits-status`, `GET /reminders.ics`
- [ ] **UI (FE):** max gauge, deductible bar, cleanings used (for example, 1 of 2), an October-or-later banner, "Add to calendar" button
- **Acceptance:** with $1,100 used and 1 cleaning used, the page shows "$400 and 1 cleaning left" and downloads a valid `.ics` file that opens in Google/Outlook calendar.

### F5: Chat assistant (P1)
*As an employee, I can ask questions anywhere ("What if I wait until January?").*
- [ ] **AI (FLEX):** tool-calling loop (find_procedure, estimate_cost, plan_year_schedule, get_benefits_status, search_plan_docs), max 6 steps, number guard, safety wording
- [ ] **API (BE):** `POST /chat` streamed over Server-Sent Events (SSE)
- [ ] **UI (FE):** chat drawer on every page, streaming text, tool-status chips ("Calculating…")
- **Acceptance:** "What if I get the crown in January instead?" returns **$625 vs $800** (G3 vs G4); every dollar amount in the answer comes from a tool result (the guard passes).

### F6: Plan PDF upload (P2)
- [ ] **API (BE):** `POST /plans/extract`: `pdfplumber` → LLM structured output → draft Plan JSON
- [ ] **AI (FLEX):** extraction prompt and schema
- [ ] **UI (FE):** upload → editable confirmation form → save
- **Acceptance:** a sample plan PDF is extracted, shown for confirmation, and then works in F2.

### F7: Choose a Plan (P2)
- [x] **Engine (M):** `simulate()` Monte Carlo (same simulated years for every plan, n = 5,000), `backend/app/engine/simulate.py`
- [x] **API (BE):** `POST /simulate`
- [x] **AI (FLEX):** assistant tool `compare_plans` returns the same numbers as the page
- [x] **UI (FE):** care level per person, known planned work, histogram per plan, "cheapest in X% of years" cards ("Which plan fits us?" on the Plans page)
- **Acceptance:** results stay the same with a fixed random seed, and adding a known crown changes which plan is recommended. Checked 2026-10-03 for the Rivera household (average care, seed 42, in network): without known care Basic is cheapest in 82% of years; with Alex's crown as known care, Preferred is (54%).
- **Status:** built on branch `feature/choose-a-plan`, not merged to `main` yet. The odds are synthetic placeholders. Details: [features/F7-choose-a-plan-monte-carlo.md](features/F7-choose-a-plan-monte-carlo.md).

**Rule:** start F6 **or** F7, never both. Decide at the 2:00 AM stand-up.

---

## 4. Schedule: built feature by feature

| Time | Everyone is working on | Checkpoint (whole team clicks through `main`) |
|---|---|---|
| 1:30–2:30 PM | Setup: repo, conventions, API contract, stub endpoints, golden tests on paper | Contract agreed, everyone unblocked |
| 2:30–6:30 PM | **F1 + F2** (no LLM yet: plain search for procedures) | **6:30:** Estimate works end to end, G1–G6 green |
| 6:30–10:00 PM | **F3** + F2's AI layer | **10:00:** S2 shows save $895; "cap on my tooth" works |
| 10:00 PM–2:00 AM | **F4 + F5** | **2:00:** benefits page + chat drawer working; choose F6 or F7 |
| 2:00–5:00 AM | **F6 or F7**, plus polish | **5:00:** stretch feature in or cut |
| 5:00–7:00 AM | Bug fixes, deployment, backup video | **7:00: code freeze** |
| 7:00–10:00 AM | Rehearse demo ×3, README, slides | Presentations at 10:00 |

---

## 5. Rules for every agent

Copy these into every agent's instruction file (`CLAUDE.md`, Kiro steering file, Bob's project rules).

1. **Stay in your folders** (section 1). If you need a change elsewhere, stop and tell your human.
2. **The LLM never computes dollar amounts.** All money math lives in `backend/app/engine/`.
3. **Never change the expected numbers** in `backend/tests/test_engine.py` (the golden tests) or section 2 of this file to make code pass. Only the engine agent edits that test file, and only with M's approval. If a golden test fails, fix the code, or tell your human that the number might be wrong.
4. **The API contract is `backend/app/models.py`.** Only BE's agent changes it. Everyone else uses the generated types.
5. **Run tests before saying a task is done.** Backend: `pytest`. Frontend: `npm run typecheck && npm run build`.
6. **No secrets in code or chat.** Read keys from `.env`.
7. **Small commits** with clear messages, on a feature branch, merged through a PR.
