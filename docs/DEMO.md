# DEMO script (Sunday 2026-10-04, 10:00 AM)

A 3 to 5 minute path. **Every step below works today** (checked live in the browser and against the API on 2026-10-03). All data is synthetic. Say so out loud in the demo.

## Story
Alex Rivera (39) has a root canal that cannot wait, a crown, and two fillings. It is November and only $400 of the $1,500 yearly maximum is left. The app shows how to pay $895 less.

## Steps

| # | What you do | What the audience sees |
|---|---|---|
| 1 | Open http://localhost:5173/welcome | The landing page: "Know what you'll pay before you're in the chair." Click **Log in** (top right) |
| 2 | On `/login`, tap **Jordan Rivera** (the primary account holder) | Home for Jordan: $1,290 left of $1,500, deductible $50 to go, 1 of 2 cleanings used, a "use your benefits before they reset" banner |
| 3 | Open **Family** | The household tree: Jordan, Alex, Maya (9, managed by Jordan, no login) and Noah (23, an adult child whose own account is waiting for approval). Tap a person to see their own numbers |
| 4 | Open the **Viewing** switcher in the top bar and pick **Alex Rivera** | The whole app changes to Alex: $400 left of $1,500, deductible met |
| 5 | Go to **Plan My Year** and tap **Try the demo case** | Root canal (urgent), crown (after the root canal), two fillings. The savings card: **Doing everything now $2,300, best order $1,405, you save $895**. Month by month: root canal stays in November, crown in January, fillings in February and March |
| 6 | Point at "Why this order", then scroll to **Ways to save** and **Questions to ask your dentist** | Plain-language reasons; urgent care never moves; tap-to-check dentist questions |
| 7 | Open the **Assistant** (page or the orange button on any page) as Alex and ask "How much would a crown cost me?" | A streamed answer: **$800 now, or $625 if you wait until January** |
| 8 | Optional: **Costs**, pick **Crown, porcelain/ceramic**, toggle **Out of network** | In network you pay **$625** (Jordan, fresh deductible); out of network **$925**, of which **$300 is balance billing** |
| 9 | Optional: **Plans**, tap **Premium**, **Switch to this plan**, confirm | Header changes to "Premium plan" and every page updates. Switch back with **Back to Preferred (demo plan)** and confirm |
| 10 | Say the line: "The engine does the math. The AI only explains it." | |

Every result shows: "This is an estimate. Your actual cost depends on your dentist's charges and claim review."

Tips on stage:
- Move between pages with the nav tabs, not the browser reload button. A full reload resets **Viewing** to the signed-in person (Jordan).
- Before you start, press **Reset demo data** on Home (or `POST /demo/reset`) so Alex's numbers and saved plans are back to the seed.
- Optional voice input: the mic button in the assistant (Chrome or Edge; needs microphone permission).

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
The assistant needs internet and the Anthropic key in `backend/.env`. Without them the chat says plainly that it is unavailable; it never makes up an answer. Every other page still works because the numbers come from the engine. Then:
1. Say: "When the model is off, the app tells you so and the calculators still work."
2. Show Plan My Year and Costs (they do not use the AI).
3. Or use the API docs page: open http://localhost:8000/docs, choose `POST /schedule`, and send:

```json
{"plan_id": "preferred", "current_month": 11,
 "usage": {"max_used": 1100, "deductible_met": 50},
 "items": [
  {"id": "t1", "code": "D3330", "urgency": "urgent"},
  {"id": "t2", "code": "D2740", "after": "t1"},
  {"id": "t3", "code": "D2392"},
  {"id": "t4", "code": "D2392"}]}
```

Expected: `baseline_you_pay` 2300, `total_you_pay` 1405, `savings` 895 (checked 2026-10-03).
4. Last backup: the screen recording (record it during rehearsal).

## Pre-demo checklist
- [ ] Backend running: `cd backend && .venv/Scripts/python -m uvicorn app.main:app --port 8000` (no `--reload`); http://localhost:8000/health shows `"chat_mode":"anthropic"`
- [ ] Frontend running: `cd frontend && npm run dev`; http://localhost:5173/welcome loads
- [ ] Demo data fresh: **Reset demo data** on Home, or `.venv/Scripts/python -m app.db --reset` from `backend/` with the backend stopped
- [ ] `cd backend && .venv/Scripts/python -m pytest -q` passes (262) and `cd frontend && npm run test` passes (75)
- [ ] Ask the assistant one question to confirm the key and internet work
- [ ] Rehearse the path three times
- [ ] Screen recording saved as a backup
