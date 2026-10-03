# DEMO script (Sunday 2026-10-04, 10:00 AM)

A 3 to 5 minute path. **Status as of 2026-10-03 (Stage 0):** the numbers and the engine are real and tested, but most of the screens are not built yet. Each step below is marked:

- **READY** = works today
- **NOT BUILT** = planned, owner and task in [TASKS.md](TASKS.md). Update this file when it lands.

All data is synthetic. Say so out loud in the demo.

## Story
Alex Rivera (39) has a root canal that cannot wait, a crown, and two fillings. It is November and only $400 of the $1,500 yearly maximum is left. The app shows how to pay $895 less.

## Steps

| # | What you do | What the audience sees | Status |
|---|---|---|---|
| 1 | Open http://localhost:5173/login and sign in as **Jordan Rivera** (the primary account holder) | Demo sign-in screen, then Home | **NOT BUILT** (login UI is T17, Ulisses; household API T05). Today `/login` is a placeholder and the app opens as a mock Jordan |
| 2 | Open the member switcher in the top bar and switch to **Alex** | Whole app changes to Alex's data: $400 left of $1,500, deductible met | Switcher **READY** (mock data). Real per-person data **NOT BUILT** (T05, T07) |
| 3 | Go to **Plan My Year**, load Alex's treatment: root canal (urgent), crown (after the root canal), two fillings | Timeline: root canal this year, everything else in January | **NOT BUILT** (T09). The engine behind it is **READY** (see the fallback) |
| 4 | Point at the savings banner | **$2,300 now, $1,405 optimized, you save $895**. Root canal stays this year | Numbers **READY** in the API; page **NOT BUILT** (T09) |
| 5 | Open the **Assistant** as Alex and ask "What if I get the crown in January instead?" | Streamed answer with a tool chip. Expect **$800 now vs $625 in January** | Chat **READY** with a local Ollama model, but not per person and not on Anthropic. Personal assistant **NOT BUILT** (T06, T10) |
| 6 | Switch to Jordan and ask "What do I have left this year?" | A different answer, from Jordan's own data (Jordan has $210 of $1,500 used in the seed) | **NOT BUILT** (T06). Seed data exists (`database/seeds/demo_household.json`) |
| 7 | Optional: **Costs** page, crown out of network | You pay **$925**, of which **$300 is balance billing** (billed $1,500, plan pays $575) | **NOT BUILT** (T11). API **READY** |
| 8 | Say the line: "The engine does the math. The AI only explains it." | | |

Every result shows: "This is an estimate. Your actual cost depends on your dentist's charges and claim review."

## Numbers to use (exact; from FEATURES.md section 2)
| Moment | Number |
|---|---|
| Cleaning, fresh year | You pay $0 |
| Crown late in the year ($1,100 used, deductible not met) | You pay **$800** |
| Same crown next plan year | You pay **$625** (waiting saves $175) |
| Crown out of network | You pay **$925** (**$300** balance billing) |
| Third cleaning in a year | Not covered, you pay $120 |
| Plan My Year, scenario S2 | **$2,300 to $1,405, save $895** |

The seed gives Alex $1,100 used and the deductible met, so Plan My Year gives the S2 numbers. The demo clock in the database is `2026-11-01`.

## Fallback if the AI is down
The assistant needs a model. If Ollama is not running, or the Anthropic key fails once T06 lands, the chat says plainly that it is unavailable. It never makes up an answer. Then:
1. Say: "When the model is off, the app tells you so and the calculators still work."
2. Show the numbers from the engine instead. The API docs page runs the same calls: open http://localhost:8000/docs, choose `POST /schedule`, and send:

```json
{"plan_id": "preferred", "current_month": 11,
 "usage": {"max_used": 1100, "deductible_met": 50},
 "items": [
  {"id": "t1", "code": "D3330", "urgency": "urgent"},
  {"id": "t2", "code": "D2740", "after": "t1"},
  {"id": "t3", "code": "D2392"},
  {"id": "t4", "code": "D2392"}]}
```

Expected: `baseline_you_pay` 2300, `total_you_pay` 1405, `savings` 895 (checked on 2026-10-03). For the crown: `POST /estimate` with `{"plan_id": "preferred", "code": "D2740", "usage": {"max_used": 1100, "deductible_met": 0}}` gives in network `you_pay` 800 and out of network `you_pay` 1100 for that usage (the $925 figure is for a fresh year, G5).
3. Have a screen recording ready as the last backup (to be recorded; not done).

## Pre-demo checklist
- [ ] Backend running: `cd backend && .venv/Scripts/python -m uvicorn app.main:app --port 8000`; http://localhost:8000/health says `ok`
- [ ] Frontend running: `cd frontend && npm run dev`; http://localhost:5173 loads
- [ ] Database seeded: `.venv/Scripts/python -m app.db --reset` (from `backend/`)
- [ ] `backend/.env` has the Anthropic key (once T06 lands) or Ollama is running with `llama3.2:3b` (`/health` shows `chat_mode`)
- [ ] `cd backend && .venv/Scripts/python -m pytest -q` passes (148 at last count) and `cd frontend && npm run test` passes (10 at last count)
- [ ] Open each of the six pages once at desktop width and at 375 px
- [ ] Rehearse the path three times; keep the fallback request open in a tab
- [ ] Screen recording saved as a backup (not done)
