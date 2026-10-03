> **Status note (2026-10-03):** the sections from the top down to and including "Structure" describe the earlier Caleb and Wrigley prototype pages. Those pages are no longer routed and are being replaced. The current app is the portal shell described under "Portal shell, routes and session (T02)" at the end. The six pages are placeholders, and the frontend does not call the backend yet. Tests: `npm run test` (10 pass).

# Plan Coverage Explainer — Frontend Prototype

A clickable prototype of the dental **Plan Coverage Explainer**, built around the
star feature: a **personalized AI chatbot** that knows each user's plan, history,
benefit usage and preferences.

> **Prototype note:** there is no running backend yet. A mock engine in
> `src/lib/mockApi.ts` plays the role of `backend/app/engine/` — it is the single
> place dollar amounts are computed, so pages and the chatbot only ever *display*
> numbers (per `docs/CONVENTIONS.md` rule #1). The numbers match the golden
> scenarios G1–G6 and S2 in `docs/FEATURES.md §2`.

## Three pages

| Page | What it shows |
|---|---|
| **Dashboard** (main) | Annual-max / deductible / cleanings snapshot, unused-benefit reminder, **next 3 upcoming events**, link to a coverage map (in- vs out-of-network dentists), plan PDFs, and recent dental history. |
| **Chatbot** | The personalized assistant plus a live **"What the assistant knows"** panel showing the retrieved per-profile AI context. A floating assistant button also opens it from any page. |
| **Profiles** | Family profiles with **benefit period, dependent age limit, full-time student age limit**, must-have coverage, per-service breakdown (coverage %, frequency, age limits), and add-profile. |

## The chatbot (feature F5 + "Personalized AI Context")

- **Account keyed by `user_id`.** The top-level record is an `Account`
  (`src/lib/types.ts` → `Account`) holding the subscriber, **plan tier**,
  **coverage type**, and all **covered people** (dependents). The chatbot is
  handed the `user_id` and retrieves the account through
  `getAccountByUserId(userId)` in `src/lib/accountApi.ts` — which returns records
  for **exactly that id and nothing else** (the data-isolation boundary a real
  backend enforces with `WHERE user_id = :authenticated_user`). An unknown or
  empty id returns no data.
- **Know-your-profile / eligibility.** `eligibilitySummary(account)` gives the
  snapshot the bot reads: plan tier, coverage type, who's covered, **dental
  visits used/remaining per person per year**, **major work done this year**, and
  **per-dependent eligibility** (age limit, full-time-student rule). The Chatbot
  page shows this as a table; ask *"who's covered on my plan?"* to see it in chat.
- **Per-user context.** Each covered person is its own record
  (`Profile.aiContext`) holding plan highlights, previous procedures, previous
  questions and preferences. The assistant reads only the **active** person's
  record.
- **Tool calls + streaming.** Answers show "Calculating…" tool chips
  (`find_procedure`, `estimate_cost`, `get_benefits_status`, …) then stream in
  token by token, mirroring the planned SSE flow.
- **It learns.** Every exchange appends to that profile's `aiContext` (saved to
  `localStorage`), so switching profiles changes what the assistant knows.
- **Grounded numbers.** Every dollar figure in an answer comes from the mock
  engine, never from the chat logic — the same rule the real LLM follows.

Try: *"What will a crown cost me?"*, *"What if I wait until January?"*,
*"What do I have left this year?"*, *"Plan my year"*. Switch profiles in the
header to see the answers change.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # tsc --noEmit
npm run build      # production build
```

## Structure

```
src/
├── App.tsx                  # nav shell + floating chat drawer
├── state/UserContext.tsx    # profiles + active profile, saved to localStorage
├── lib/
│   ├── types.ts             # domain types (Account, Profile, Plan, AiContext, …)
│   ├── seed.ts              # demo plan, procedures, account + covered people
│   ├── mockApi.ts           # THE money engine (golden numbers G1–G6, S2)
│   ├── accountApi.ts        # getAccountByUserId (isolation) + eligibility engine
│   ├── chat.ts              # the personalized assistant "agent" (user_id driven)
│   └── format.ts            # money/date formatting only (no math)
├── components/
│   ├── ChatPanel.tsx        # streaming chat + tool chips + learning loop
│   ├── ProfileSwitcher.tsx
│   └── Disclaimer.tsx
└── pages/ (Dashboard, Chatbot, Profiles)
```

## Portal shell, routes and session (T02)

The app is a portal-style shell: a slim burgundy utility bar (household name, member switcher, sign-in), a sticky white nav, the page, a footer with the estimate disclaimer, and a floating assistant button (hidden on `/assistant`).

| Route | Page (`src/pages/...`) |
|---|---|
| `/` | `Home/HomePage.tsx` |
| `/plans` | `Plans/PlansPage.tsx` |
| `/family` | `Family/FamilyPage.tsx` |
| `/costs` | `Costs/CostsPage.tsx` |
| `/plan-year` | `PlanYear/PlanYearPage.tsx` |
| `/assistant` | `Assistant/AssistantPage.tsx` |
| `/login` | reserved for the sign-in UI (placeholder) |
| `/style` | style guide (owned by the design task) |

Routes live in `AppRoutes` in `src/App.tsx`; shell parts are in `src/components/shell/`.

**Session context** (`src/state/SessionContext.tsx`): `useSession()` returns `account`, `household`, `activeMember`, `setActiveMemberId(id)` and `signOut()`. The member switcher in the utility bar is a card menu, not a native select. Until the household API (T05) lands it is backed by a mock Rivera household; pages must read the active member from here and never hard-code a person.

Old prototype pages (`Chatbot`, `Coverage`, `Dashboard`, `Estimate`, `GetStarted`, `Home.tsx`, `PlanYear.tsx`, `Profiles`) are no longer routed. Their features are to be ported by T07-T12 and the files removed.

## Plan My Year (T09)

One screen at `/plan-year`. Left: tappable treatment cards (with search) and "Your treatments" with urgency chips (urgent, soon, flexible) and "comes after" chips. Right: the result, which updates by itself when a treatment, urgency or member changes (no "optimize" button). Order: savings banner (everything now, best order, you save), month-by-month timeline with the plan-year reset marked and one "yearly maximum used" bar per year, "Why this order", savings tips, questions to ask your dentist, and "Add reminders to my calendar". "Try the demo case" fills the S2 treatments.

Code: page `src/pages/PlanYear/PlanYearPage.tsx`, parts in `src/features/planYear/`, API calls in `src/lib/api/planYear.ts`, types in `src/lib/types/planYear.ts`, tests in `PlanYearPage.test.tsx`.

- Calls: `GET /procedures`, `POST /schedule`, `POST /savings-tips`, `POST /questions`, `POST /benefits-status`, `GET /reminders.ics`, and `GET /members/{id}/overview` for the active member's usage. The plan id is the household tier. The demo clock is month 11.
- Every dollar figure is displayed from an API response. The only arithmetic is the width of the maximum-used bar (a layout ratio).
- Until `GET /members/{id}/overview` exists (T05), the page falls back to built-in demo usage (Alex: $1,100 used, deductible met; others zero) and says so under the heading. `usageFromOverview` accepts `{usage: {max_used, deductible_met, history}}` or those fields at the top level.
- Check: Alex, demo case shows $2,300 to $1,405, saves $895; root canal in November, crown in January.

## Plans (T12)

`/plans` (`src/pages/Plans/PlansPage.tsx`, parts in `src/features/plans/`). Reads `GET /plans` (Basic, Preferred, Premium) and shows three tier cards (monthly price, yearly maximum, deductible), a "Your plan" tag on the household's tier (`useSession().household.planTier`), coverage bars for preventive, basic, major and children's orthodontia, a plain-English summary, how often cleanings and exams are covered, and a side-by-side table with the selected tier's column highlighted. Tapping a card selects it. Bar widths are the plan's coverage share from the API; the page does no dollar math. Tests: `src/pages/Plans/PlansPage.test.tsx` (mocked `/plans`).

## Family (T08)

`/family` shows the household as a clickable family tree. Each person is a node (initial, name, relationship, age) with a "Has login" chip, a "Managed profile" chip for children, or a dashed "Pending" style (Noah). Tap a person to see **that person's** numbers: yearly maximum left and used, deductible met, visits, cleanings, and a card for each service (preventive, basic, major, orthodontia) marked Available, Not available or Pending verification, with the age rule and the pending note. "View as this person" switches the active member (the primary, or the person themselves). The primary sees an "Invite" action on adults without a login (age 18 and over); the invite is demo only and shows as pending.

The page signs in on its own with the demo accounts (`GET /auth/demo-accounts`, `POST /auth/demo-login`, token kept in memory only) because the shell session does not hold an API token yet. A "Demo sign-in" card lets you switch accounts to check visibility: a non-primary adult sees only their own node.

Code: `src/pages/Family/FamilyPage.tsx`, parts in `src/features/family/`, API in `src/lib/api/family.ts`, types in `src/lib/types/family.ts`, tests in `FamilyPage.test.tsx`. Calls: `GET /households/{id}` is returned by login, `GET /members/{id}/overview`, `POST /households/{id}/invites`.

## Home (T07)

The first page after sign-in (`/`). Top to bottom: a hero strip ("Welcome back, <first name>", plan tier, who is being viewed); three cards with one number each and a bar (**Maximum left**, **Deductible**, **Cleanings used**); the end-of-year reminder with an "Add reminders to my calendar" button (shown when the API returns a reminder); **Coming up** (next 3 schedule entries); **Log a visit** (tap a visit chip, see "You pay" from the engine, numbers update for that member only); quick links to Costs, Plan My Year and Assistant. Switching the member in the header reloads every number.

Code: page `src/pages/Home/HomePage.tsx`, data hooks `src/features/home/useHome.ts`, API calls `src/lib/api/home.ts`, types `src/lib/types/home.ts`, tests `HomePage.test.tsx`.

- Calls: `POST /auth/demo-login` (signs in as the household's primary member, token kept in memory), `GET /members/{id}/overview`, `GET /members/{id}/schedule` (both with `Authorization: Bearer`), `GET /procedures`, `POST /estimate`, `POST /benefits-status`, `GET /reminders.ics`.
- Bar widths are layout ratios; every dollar figure is shown as the API returned it.
- "Log a visit" is kept in page state only (no endpoint saves visits yet). It sends the engine's `max_used_after` and `deductible_applied` back through `/benefits-status` to refresh the cards.

## Costs (T11)

`/costs` (`src/pages/Costs/CostsPage.tsx`, parts in `src/features/costs/`, API in `src/lib/api/costs.ts`, shapes in `src/lib/types/costs.ts`). A segmented control switches three views. Every dollar figure comes from the API; the browser only formats.

- **Estimate a procedure:** cards plus plain-word search (from `GET /procedures`), big "You pay" and "Plan pays" from `POST /estimate` for the active member's usage, an in-network / out-of-network toggle (out of network shows balance billing), a trace chart, "Show the math", and savings tips and dentist questions below.
- **Read my dentist's quote:** paste text (or "Use a sample quote"), `POST /treatment-plan/parse`, then review cards with the quoted and typical price. The "Looks high" flag is the `quote_check` tip returned by `POST /savings-tips` (the page sends `quoted_fees`). "Optimize my year" calls `navigate("/plan-year", { state: { treatments } })` where `treatments` is a `TreatmentItem[]` (type `QuoteHandoff`). Plan My Year must read `location.state.treatments` to pick it up (not wired yet).
- **Yearly cost:** sliders for people covered, cleanings and crowns, and an in/out of network toggle. Calls `POST /annual-cost` once for each of `basic`, `preferred` and `premium` (debounced 250 ms) and shows premiums, care cost, total and the assumptions. "Lowest total" compares the totals the server returned.

Tests: `src/pages/Costs/CostsPage.test.tsx` (mocked `fetch`; crown $625 / $800 / out of network $925 with $300 balance billing, 5 matched quote items with the crown flagged, three tiers).

## Assistant (T10)

`/assistant` and the floating "Ask the assistant" button share one chat (`src/features/assistant/AssistantChat.tsx`). It always talks about the **active member** (`useSession().activeMember`); the household's primary member signs in through `POST /auth/demo-login` (token helper in `lib/api/home.ts`) and may chat about everyone.

- **Streaming:** `lib/api/assistant.ts` `streamChat` posts to `/chat` (with `member_id`, `attachment_ids`) and parses the SSE events `tool_start`, `tool_end`, `token`, `done`, `error`. Tool events show as chips ("Calculating your cost…"). Dollar amounts are shown exactly as streamed.
- **Threads:** one in-memory thread per member (`features/assistant/threads.ts`), shared by the page and the panel. Switching member shows that person's own thread, chips and context.
- **Recommended questions:** `GET /chat/suggestions?member_id=` as chips above the input.
- **What the assistant knows:** `KnowsPanel` reads `GET /members/{id}/assistant-context` (plan highlights, history, preferences, must-haves, recent questions) and reloads after each answer.
- **PDF:** the paperclip uploads to `POST /chat/attachments` (PDF only, 5 MB limit, demo-only notice); the file shows as a removable chip and its id is sent with the next question.
- **Unavailable:** `done` with `mode: "unavailable"`, an `error` event or a network failure shows a plain message and "Try again"; the rest of the app is unaffected.
- Tests: `src/pages/Assistant/AssistantPage.test.tsx` (mocked stream: chips and context per member, thread separation, unavailable and network states, attach and remove).
