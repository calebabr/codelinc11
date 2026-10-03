# Decision Log

Every choice that shapes the product is recorded here, so agents build from decisions and not from guesses. The orchestrator keeps this file current. An agent never makes one of these decisions on its own.

**Status:** `open` (waiting on the team) · `decided` · `changed` (reversed later; keep the history)

## Big decisions

| # | Question | Options | Status | Decision | Date |
|---|---|---|---|---|---|
| D1 | One person or a whole family? | One person · Family profiles | **decided** | Family. Each person has their own personalized context (own usage, history, preferences and chat memory). | 2026-10-03 |
| D2 | Login | None (demo plan only) · Mock login (pick a demo member) · Real login | **decided** | Yes, there is a login. Ulisses is building the landing and login page. Account model: like Wrigley's (a household with profiles), but **adults (for example a spouse or older children) can have their own login.** Details open (see follow-ups). | 2026-10-03 |
| D3 | Chat engine | Local Ollama model · Cloud model (needs a paid key) · Simple keyword answers · Local plus a cloud option | **decided** | An API-based chatbot. **Anthropic API first** (default for the demo), with Ollama kept as the local option behind the same provider interface. **Not keyword answers.** | 2026-10-03 |
| D4 | Page structure and navigation | Ulisses's navigation on `main` · Caleb's tabs · A new structure | **decided** | **Six pages in Sai's style:** Home, Plans, Family, Costs, Plan My Year, Assistant (a chat button is also on every page). | 2026-10-03 |
| D5 | Visual theme | Ulisses's editorial theme · Caleb's current look · Sai's portal look | **decided** | **Sai's portal look** (burgundy `#650030`, orange `#FF4F17`, utility bar, hero banner). Replaces the editorial theme currently on `main`. | 2026-10-03 |
| D6 | How many plans the product offers | One demo plan · Two plans · Three tiers with comparison | **decided** | **Three tiers with comparison** (Basic, Preferred, Premium); the household is on one tier. Numbers are Sai's, with Preferred's deductible set to **$50** so the golden numbers stay valid (see D6). | 2026-10-03 |
| D7 | Data | Keep placeholder numbers for now · Team fills in real plan values and fees | open | | |
| D8 | Where stored data lives | Browser only · Local file database · Hosted database | open | | |

How these affect the work:
- **D1** decides whether usage is stored per person (a change to the engine, API and database).
- **D2** and **D1** together decide whether the backend needs to know who the user is.
- **D3** decides what the AI agent builds and whether any health data leaves the machine.

## Decided details

### D1: Family, with a personal context for each person
Status: decided
Decision: the product serves a household. Each covered person has their own personalized context: their own plan usage and benefits, history, preferences, and the assistant's memory of their chats. One person's context is never shown in another person's answers.
Why: personal answers are what the user liked in Wrigley's chatbot (and partly in Sai's portal).
Affects: backend engine and API (maximum, deductible and visits are per person), database (usage per person per plan year), AI agent (per-person memory), frontend (profile switcher).
Date: 2026-10-03

### D2: There is a login
Status: decided (details open)
Decision: users sign in. Ulisses is building the landing and login page.
Affects: backend (the API must know who is signed in), database (accounts), frontend (routes, profile switcher), AI agent (context is per signed-in person).
Date: 2026-10-03

### D3: API chatbot, not keyword answers
Status: decided
Decision: the assistant is a real model behind an API. **Anthropic is the default for the demo;** Ollama stays supported as the local option. The provider sits behind one interface so either can be used. Keyword-matching answers are not part of the product. Because Anthropic sends chat text to a third party, the demo uses synthetic data only (confirm under F5).
Why: keyword answers can't handle real questions and aren't what the user wants.
Affects: AI agent. If no model is reachable the assistant says so plainly; the calculator features keep working. Nothing pretends to be an AI.
Date: 2026-10-03

### D9: Per-person context lives in a server database
Status: decided
Decision: each person's context is stored on the server, not in the browser. It has four parts: plan usage and benefits, dental history, preferences and must-haves, and chat memory.
Why: the context should follow the person across devices and sessions, and the assistant needs it to personalize answers.
Affects: Database agent (starts early: per-person tables), Backend (reads and writes context for the signed-in person), AI agent (loads only the active person's context), privacy rules (synthetic data only until decided otherwise).
Date: 2026-10-03

### D4: Six pages
Status: decided
Decision: Home (summary, benefits left, reminders, upcoming care) · Plans (tier comparison, your coverage by service, plan documents) · Family (family diagram, profiles, eligibility, per-person usage, invites) · Costs (estimate a procedure, read a dentist quote, annual calculator, savings tips, questions to ask your dentist) · Plan My Year (treatment list, scheduler, timeline) · Assistant (full page, plus a chat button on every page).
Affects: Frontend (routes and pages), Design (layout), Integration (which prototype features land on which page).
Date: 2026-10-03

### D5: Sai's portal look
Status: decided
Decision: the look follows Sai's portal styling. This replaces Ulisses's editorial theme and style guide on `main`, so the theme and the style guide page get reworked. Note: Ulisses's rule "orange only for money you save" does not carry over; Sai's uses orange for buttons and accents.
Affects: Design agent (tokens, style guide), Frontend (shell and components), Ulisses (the shell he built).
Date: 2026-10-03

### D6: Three plan tiers
Status: decided
Decision: Basic, Preferred and Premium, compared on the Plans page. Numbers come from Sai's tiers, **except Preferred's deductible is $50 (Sai had $75)** so the existing golden numbers stay valid.

| | Basic | Preferred (the golden demo plan) | Premium |
|---|---|---|---|
| Monthly premium | $28 | $44 | $61 |
| Annual maximum | $1,000 | $1,500 | $2,500 |
| Deductible | $100 | **$50** | $50 |
| Preventive | 100% | 100% | 100% |
| Basic care | 50% | 80% | 90% |
| Major care | 0% | 50% | 70% |
| Orthodontia (children) | 0% | 50% | 60% |

Premium's deductible of $50 is from Sai's data. The numbers are still placeholders, not real plan values (D7).
Affects: Database (plans), Backend (plan model and per-tier calculations), Frontend (Plans page), golden numbers (they use one demo plan).
Date: 2026-10-03

### D10: Dental only
Status: decided
Decision: vision coverage is left out. Orthodontia for children stays, since it is dental.
Why: the challenge is dental, and vision would be extra scope.
Date: 2026-10-03

### D11: PDF upload for the assistant
Status: decided
Decision: users can upload a PDF (a dentist quote, an EOB or a claim) and the assistant reads it, sending the PDF to Anthropic. **The demo uses sample, fictional documents only.**
Affects: AI agent (PDF reading through the provider interface), Backend (upload endpoint and size limits), Frontend (attach control), privacy rule F5.
Date: 2026-10-03

### D12: Deadline and feedback on the earlier pages
Status: decided
Decision: the deadline is the **hackathon demo, Sunday 10:00 AM**. Caleb's features are liked, but **their look is not**: the earlier pages had the wrong look and layout, were too cluttered with too many steps, had charts and numbers that were hard to understand, and did not feel like a real insurance portal. The redesign targets exactly those four points.
Not selected: Wrigley's dental/claims history, plan documents list and dentist finder link; his dashboard cards (covered by Caleb's benefits tracking).
Affects: Design (a portal-style redesign of every Caleb screen), Frontend, and scope (a hard deadline means a staged build).
Date: 2026-10-03

### D13: Demo priorities and setup
Status: decided
Decision: the demo must nail three moments, in this order: (1) **sign in and see each family member's own view**, (2) **Plan My Year**, (3) the **personalized assistant per person**. The Costs page (estimate, quote, tips, questions), Plans comparison and the annual calculator matter but come after those three. The Anthropic key is added by Caleb to a local `.env` file and is never pasted in chat or committed. **Ulisses builds the login UI on the integration branch once the new shell and theme are pushed**, so his work lands in the new structure.
Date: 2026-10-03

### Privacy note on D2 / F2
The main account holder sees everything about adults in the household, including their history and chat memory. That is fine for a synthetic demo. In a real product, adults' health information is normally private from the policyholder, so this would need a consent step. Recorded so it isn't forgotten.

## Follow-ups to settle
| # | Question | Why it matters | Status |
|---|---|---|---|
| F1 | Is login a mock (pick a demo account) or real accounts? | Decides whether passwords and sessions are built | **decided:** a demo sign-in on the real data model (households, members, roles, invites in the database; sign-in is "choose your account", no passwords) |
| F2 | Account model | Shapes the database and the API | **mostly decided:** a household with profiles; adults (spouse, older children) can have their own login; **the main account holder can see everything about everyone in the household** (usage, history, preferences, chat memory); an adult gets a login by **invite from the main account holder**. **Login age: 18 and over.** Younger children stay as profiles managed by the main account holder. The plan's dependent age limit (19, or 26 for full-time students) decides who is still covered, not who can log in. |
| F3 | Where does each person's context live? | Persistence across devices; whether the Database agent starts now | **decided:** a server database. Context for each person: plan usage and benefits, dental history, preferences and must-haves, and chat memory (all four) |
| F4 | Default provider: Anthropic or Ollama? | Cost, key handling, and whether health data leaves the machine | **decided:** Anthropic first, Ollama as the local option |
| F5 | What data may be sent to a cloud model? | Privacy rule for the AI agent | **decided:** synthetic and sample documents only in the demo; no real health data goes to Anthropic |
| F6 | Which features carry over from each prototype? | Scope of the first tasks | open |

## Feature decisions
Which feature goes in, from which prototype, is tracked in [../prototypes/FEATURE-DECISIONS-SHEET.md](../prototypes/FEATURE-DECISIONS-SHEET.md) (the fill-in sheet) and summarized here once decided.

| Feature | Source | Decision | Where it goes | Notes |
|---|---|---|---|---|
| Family diagram and "what's available for each person" | Sai | **Keep** (rebuild) | Family | Per-person eligibility chips, clickable family tree, pending status |
| Plan comparison (Basic, Preferred, Premium) | Sai | **Keep** (rebuild) | Plans | Coverage bars plus side-by-side table |
| "Estimate your annual cost" calculator | Sai | **Keep** (rebuild on the engine) | Costs | Replace the invented factors (55% family premium step, flat $220 a visit, one shared maximum) with the real engine and per-person maximums |
| Personalized chatbot, separate context per person | Wrigley | **Keep** (rebuild with a real model) | Assistant, plus a button on every page | Anthropic first. Context per person from the database. A "what the assistant knows" panel is part of this idea |
| Recommended questions in the chat | Wrigley | **Keep** | Assistant | The suggestion chips that start a chat, such as "Who's covered on my plan?" and "What do I have left this year?" |
| Cost of one procedure (browse or search, You pay / Plan pays, breakdown chart, show the math, in vs out of network) | Caleb | **Keep** (redesign) | Costs | Features liked; the earlier look was not |
| Plan-year scheduler and timeline | Caleb | **Keep** (redesign) | Plan My Year | Features liked; the earlier look was not |
| Dentist quote reader | Caleb | **Keep** (redesign) | Costs | Features liked; the earlier look was not |
| Benefits tracking (gauges, visit chips, log a visit, end-of-year reminder, calendar file) | Caleb | **Keep** (redesign) | Home | Features liked; the earlier look was not |
| Upcoming schedule | Wrigley | **Keep** | Home | Next appointments and reminders |
| Savings tips | Caleb | **Keep** | Costs, Plan My Year | Six tip kinds; every number comes from the engine |
| Questions to ask your dentist | Caleb | **Keep** | Costs, Plan My Year | Tickable checklist with copy and print |
| PDF upload | Sai | **Keep** (rebuild) | Assistant, Costs | Anthropic reads the PDF; sample documents only (D11) |

## Entry format for a new decision
```
### D<N>: <question>
Status: decided
Decision: <what was chosen>
Why: <one or two sentences>
Affects: <agents and folders>
Date: <date>
```
