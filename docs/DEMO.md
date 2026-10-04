# DEMO script (Sunday 2026-10-04, 10:00 AM)

A 3 to 5 minute path. The numbers below were checked live in the browser and against the API on 2026-10-03, except where a step says otherwise. All data is synthetic. Say so out loud in the demo.

**What to run:** the demo works on `main` (the production version) and on `feature/choose-a-plan` (the Monte Carlo "Which plan fits us?" step, saved comparisons and the phone features). Step 10 ("Which plan fits us?") was checked against the API and by component tests, and the orchestrator checked the one-tap demo, Name your family, rate limits and phones live; a human has not yet clicked step 10 through in a browser. Run the demo from the branch that has everything you plan to show.

## Story
Alex Rivera (39) has a root canal that cannot wait, a crown, and two fillings. It is November and only $400 of the $1,500 yearly maximum is left. The app shows how to pay $895 less.

## Opening: the audience joins (optional, about 30 seconds)
Every visitor now gets their **own** demo family, so the audience can try the app on their phones while you present, and nobody can change your demo.

1. Put the **Scan to try** page on the big screen: open `http://<your address>/join` (for a tunnel, `https://<tunnel address>/join?url=https://<tunnel address>/welcome`). It shows a QR code.
2. Phones scan it, land on the landing page and tap **Try the demo**. They get a private copy of the demo family (24 hours, no sign-up, email or password).
3. Say: "Everyone has their own family. Their changes don't touch mine."

How to get phones onto the app (same Wi-Fi, tunnel, public hosting): [DEMO-PHONES.md](DEMO-PHONES.md).

## Steps

| # | What you do | What the audience sees |
|---|---|---|
| 1 | Open the landing page `/welcome` | "Know what you'll pay before you're in the chair." The product name Molar Money. Tap **Try the demo** (or **Log in** and then **Try the demo**) |
| 2 | You are signed in as **Jordan Rivera** (the primary account holder) in a brand-new demo family | Home for Jordan: $1,290 left of $1,500, deductible $50 to go, 1 of 2 cleanings used, a "use your benefits before they reset" banner. A **Name your family** card appears once (optional) |
| 3 | In **Name your family**, type made-up names for the four people and the family, then save (or **Skip**) | Every page shows the new names at once. Four first-name boxes (You, Your spouse, Your young child, Your older child) and a family name. Person names are 1 to 24 characters (the family name box allows 30): letters, spaces, apostrophes, hyphens, periods. This works only for the primary account in a demo family |
| 4 | Open **Family** | The household tree: Jordan, Alex, Maya (9, managed by Jordan, no login) and Noah (23, an adult child whose own account is waiting for approval). Tap a person to see their own numbers |
| 5 | Open the **Viewing** switcher in the top bar and pick **Alex** | The whole app changes to Alex: $400 left of $1,500, deductible met |
| 6 | Go to **Plan My Year** and tap **Try the demo case** | Root canal (urgent), crown (after the root canal), two fillings. The savings card: **Doing everything now $2,300, best order $1,405, you save $895**. Month by month: root canal stays in November, crown in January, fillings in February and March |
| 7 | Point at "Why this order", then scroll to **Ways to save** and **Questions to ask your dentist** | Plain-language reasons; urgent care never moves; the dentist questions are a plain list |
| 8 | Open the **Assistant** (page or the orange button on any page) as Alex and ask "How much would a crown cost me?" | A streamed answer: **$800 now, or $625 if you wait until January** |
| 9 | Optional: **Costs**, pick **Crown, porcelain/ceramic**, toggle **Out of network** | In network you pay **$625** (Jordan, fresh deductible); out of network **$925**, of which **$300 is balance billing** |
| 10 | Optional: **Plans**, tap **Premium**, **Switch to this plan**, confirm | Header changes to "Premium plan" and every page updates. Switch back with **Back to Preferred (demo plan)** and confirm |
| 11 | Say the line: "The engine does the math. The AI only explains it." | |

## Optional moment: the notification bell
About 30 seconds. Look at the **bell** in the top right of the app bar. It shows an unread badge. On 2026-11-01 (the demo clock) the counts are: **Jordan 3** (plan year ending soon, unused cleanings, "Cleaning and exam" on Nov 18), **Alex 5**, **Noah 1** (reminder "Send student enrollment proof, due Nov 30"). Jordan also sees Maya's Dec 4 checkup under **Coming up**.

1. Tap the bell. **Coming up** lists the next appointments and reminders; **Alerts** lists unread notifications.
2. Tap an alert: it is marked read and takes you to the right page. **Mark all as read** clears the badge.
3. Open **See all notifications** (`/notifications`): filters (All, Unread, Appointments and reminders, Benefits, Claims), and per-person settings (App, Email, Text message, which kinds, **Send me a test**). The **Delivery preview** list carries the banner "Demo only: emails and text messages are previews. Nothing is sent."
4. Say it plainly: "Email and text are previews in this demo. Nothing is really sent."

Home also has a **Notifications** card. Switching **Viewing** changes the bell to that person's alerts.

## The Monte Carlo moment: "Which plan fits us?"
Optional, about 60 seconds. Do it after the crown, as the "what should we pick?" question.

1. **Plans**, scroll to **Which plan fits us?**. Keep everyone on **Average** care and run it. One card per plan. Rivera household, 5,000 simulated years, seed 42, in network: Basic is cheapest in **82%** of years (typical year $1,939), Preferred 17%, Premium 1%.
2. Tap **Try Alex's crown** to add it as known care. The result changes: **Preferred 54%**, Basic 39%, Premium 7%.
3. Say out loud: "These odds are synthetic placeholders, not a prediction. The prices come from the same engine as every estimate."
4. In the assistant, tap the chip **Summarize the plan simulations** (or **How are the simulations calculated?**). The answer uses the same numbers; follow-up chips under it ("Ask next") let you keep going.

### Saving a comparison
1. Under the results, tap **Save to Plan My Year**, keep or change the name, save.
2. Open **Plan My Year**: **Saved plan comparisons** lists it with the headline ("Best: Basic, cheapest in 82% of years") and who it covered.
3. Tap **Open** on it to jump back to **Plans** with the same choices filled in and a fresh run. The server worked out the saved headline itself, so a saved result cannot be edited by hand.

Every result shows: "This is an estimate. Your actual cost depends on your dentist's charges and claim review."

## Tips on stage
- Move between pages with the nav tabs, not the browser reload button. A full reload resets **Viewing** to the signed-in person (Jordan). The browser remembers your demo family, so a reload brings you back into it ("Continue your demo family").
- Before you start, press **Reset demo data** on Home (or `POST /demo/reset`) so Alex's numbers and saved plans are back to the seed. It restores only your own demo family. To get a completely new family, use **Start a fresh family** on `/login`.
- **The shared-family problem is solved.** Before, everyone used one shared demo household, so one tester could change what everyone saw. Now each visitor has a private copy.
- Optional voice input: the mic button in the assistant (Chrome or Edge; needs microphone permission). Over plain `http://` on a Wi-Fi address phones block the mic, so voice works only on HTTPS (a tunnel).

## If the assistant is slow
The model runs over the internet, so a slow venue connection slows it. In order:
1. Wait about 10 seconds; answers stream in, so text should start appearing.
2. Say: "While it thinks, the numbers on the other pages come straight from the engine." Show Plan My Year or Costs. They do not need the model.
3. Check `http://localhost:8000/health`: `chat_mode` should be `anthropic`.
4. If you see "Too many requests" or a message to wait, a rate limit was hit (chat: 12 a minute and 200 a day per family; 3,000 a day for everyone). Wait the number of seconds it says, or raise the limits in `backend/.env` and restart the backend (see [SETUP.md](SETUP.md)).
5. Tap a suggested-question chip instead of typing, or ask something short like "What do I have left this year?".
6. Switch to the fallback below.

## Numbers to use (exact; from FEATURES.md section 2)
| Moment | Number |
|---|---|
| Cleaning, fresh year | You pay $0 |
| Crown late in the year ($1,100 used, deductible not met) | You pay **$800** |
| Same crown next plan year | You pay **$625** (waiting saves $175) |
| Crown out of network | You pay **$925** (**$300** balance billing) |
| Third cleaning in a year | Not covered, you pay $120 |
| Plan My Year, scenario S2 | **$2,300 to $1,405, save $895** |
| Which plan fits us? (optional; Rivera, average care, seed 42, in network) | No known care: Basic 82%, Preferred 17%, Premium 1%. With Alex's crown: Basic 39%, Preferred 54%, Premium 7% |

The seed gives Alex $1,100 used and the deductible met, so Plan My Year gives the S2 numbers. The demo clock in the database is `2026-11-01`.

## Fallback if the AI is down
The assistant needs internet and the Anthropic key in `backend/.env`. Without them the chat says plainly that it is unavailable; it never makes up an answer. Every other page still works because the numbers come from the engine. Then:
1. Say: "When the model is off, the app tells you so and the calculators still work."
2. Show Plan My Year, Costs and Plans (they do not use the AI).
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

## What is a stand-in
Say these plainly if asked: all plan, fee and member data is synthetic. Sign-in is a demo with no passwords, and anyone with the link can start a demo family (an access code idea is not built). The plan-comparison odds are synthetic placeholders. Email and text notifications are previews only; nothing is sent (a real sender such as Amazon SES or Twilio is not built). Rate limits are counted in memory on one server. Everything runs on one server with one SQLite file.

## Pre-demo checklist
- [ ] Backend running: `cd backend && .venv/Scripts/python -m uvicorn app.main:app --port 8000` (no `--reload`); http://localhost:8000/health shows `"chat_mode":"anthropic"`
- [ ] Frontend running: `cd frontend && npm run dev` (use `npm run dev:lan` and `VITE_API_URL=/api` if phones will join; see [DEMO-PHONES.md](DEMO-PHONES.md)); http://localhost:5173/welcome loads
- [ ] **Scan to try** page (`/join`) open on the big screen, and the QR scanned by one iPhone and one Android phone
- [ ] Sign-in limits high enough for the room (`RATE_LOGIN_PER_MINUTE`, `RATE_LOGIN_PER_HOUR`; many phones share one connection)
- [ ] Demo data fresh: **Reset demo data** on Home, or `.venv/Scripts/python -m app.db --reset` from `backend/` with the backend stopped
- [ ] `cd backend && .venv/Scripts/python -m pytest -q` passes (523) and `cd frontend && npm run test` passes (205)
- [ ] Ask the assistant one question to confirm the key and internet work
- [ ] Rehearse the path three times
- [ ] Screen recording saved as a backup
