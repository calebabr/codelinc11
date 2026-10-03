# Frontend

React + Vite + TypeScript portal for the dental benefits product. It talks to the FastAPI backend at `http://localhost:8000` (set `VITE_API_URL` to change it; the backend allows the origin `http://localhost:5173`, so no Vite proxy is needed). The old prototype pages and their mock engine were removed in T19; they are preserved on the `proto/*` branches.

```bash
npm install
npm run dev        # http://localhost:5173 (start the backend on :8000 first)
npm run typecheck
npm run test
npm run build
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
| `/login` | `Login/LoginPage.tsx` (demo sign-in cards from `GET /auth/demo-accounts`; one file so design can restyle it) |
| `/style` | style guide (owned by the design task) |

Routes live in `AppRoutes` in `src/App.tsx`; shell parts are in `src/components/shell/`.

**Session (T19, `src/state/SessionContext.tsx`):** the real backend session.

- On load, `SessionProvider` calls `GET /auth/demo-accounts`, then `POST /auth/demo-login` for the primary member (Jordan, `m-jordan`), or for whoever was chosen earlier in this tab (remembered in `sessionStorage` under `dental.signedInMemberId`, nothing else is stored). The bearer token is kept in memory. The household is then loaded with `GET /households/{id}`. Real ids: `hh-rivera`, `m-jordan`, `m-alex`, `m-noah`, `m-maya` (Maya has no login).
- `useSession()` (pages) returns `account`, `user` (the signed-in member), `household` (backend shape plus `planTier`, the plan id), `activeMember`, `setActiveMemberId(id)`, `token`, `accounts`, `signIn(memberId)` and `signOut()`. It throws if used outside a ready session, so pages render inside the `Shell`.
- `useSessionGate()` (shell and login) adds `status` (`loading`, `ready`, `error`, `signed-out`), `error` and `retry`. The `Shell` shows a loading note, a clear error with "Try again" when the backend is down, or redirects to `/login` after sign-out.
- Every API call takes the shared `token`. There are no per-page sign-ins. A non-primary person (Alex, Noah) sees only their own household member, as the backend returns.
- The member switcher in the utility bar is a card menu, not a native select.
- Tests use `src/test/session.tsx` (`TestSessionProvider`, fixed Rivera household with the real ids, token `tok-<id>`, no network). `src/state/SessionContext.test.tsx` covers the real provider with a mocked `fetch`.

## Plan My Year (T09)

One screen at `/plan-year`. Left: tappable treatment cards (with search) and "Your treatments" with urgency chips (urgent, soon, flexible) and "comes after" chips. Right: the result, which updates by itself when a treatment, urgency or member changes (no "optimize" button). Order: savings banner (everything now, best order, you save), month-by-month timeline with the plan-year reset marked and one "yearly maximum used" bar per year, "Why this order", savings tips, questions to ask your dentist, and "Add reminders to my calendar". "Try the demo case" fills the S2 treatments.

Code: page `src/pages/PlanYear/PlanYearPage.tsx`, parts in `src/features/planYear/`, API calls in `src/lib/api/planYear.ts`, types in `src/lib/types/planYear.ts`, tests in `PlanYearPage.test.tsx`.

- Calls: `GET /procedures`, `POST /schedule`, `POST /savings-tips`, `POST /questions`, `POST /benefits-status`, `GET /reminders.ics`, and `GET /members/{id}/overview` for the active member's usage. The plan id is the household tier. The demo clock is month 11.
- Every dollar figure is displayed from an API response. The only arithmetic is the width of the maximum-used bar (a layout ratio).
- Usage comes from `GET /members/{id}/overview` with the session token (`usage.max_used`, `usage.deductible_met`, `usage.cleanings_used`; cleanings are sent to the engine as `D1110` history entries). There is no demo fallback: if the overview cannot load, the page shows the error.
- Check: Alex, demo case shows $2,300 to $1,405, saves $895; root canal in November, crown in January.

## Plans (T12)

`/plans` (`src/pages/Plans/PlansPage.tsx`, parts in `src/features/plans/`). Reads `GET /plans` (Basic, Preferred, Premium) and shows three tier cards (monthly price, yearly maximum, deductible), a "Your plan" tag on the household's tier (`useSession().household.planTier`), coverage bars for preventive, basic, major and children's orthodontia, a plain-English summary, how often cleanings and exams are covered, and a side-by-side table with the selected tier's column highlighted. Tapping a card selects it. Bar widths are the plan's coverage share from the API; the page does no dollar math. Tests: `src/pages/Plans/PlansPage.test.tsx` (mocked `/plans`).

## Family (T08)

`/family` shows the household as a clickable family tree. Each person is a node (initial, name, relationship, age) with a "Has login" chip, a "Managed profile" chip for children, or a dashed "Pending" style (Noah). Tap a person to see **that person's** numbers: yearly maximum left and used, deductible met, visits, cleanings, and a card for each service (preventive, basic, major, orthodontia) marked Available, Not available or Pending verification, with the age rule and the pending note. "View as this person" switches the active member (the primary, or the person themselves). The primary sees an "Invite" action on adults without a login (age 18 and over); the invite is demo only and shows as pending.

The page uses the shared session (see above). A "Demo sign-in" card calls `signIn(memberId)` to switch accounts and check visibility: a non-primary adult sees only their own node.

Code: `src/pages/Family/FamilyPage.tsx`, parts in `src/features/family/`, API in `src/lib/api/family.ts`, types in `src/lib/types/family.ts`, tests in `FamilyPage.test.tsx`. Calls: `GET /households/{id}` is returned by login, `GET /members/{id}/overview`, `POST /households/{id}/invites`.

## Home (T07)

The first page after sign-in (`/`). Top to bottom: a hero strip ("Welcome back, <first name>", plan tier, who is being viewed); three cards with one number each and a bar (**Maximum left**, **Deductible**, **Cleanings used**); the end-of-year reminder with an "Add reminders to my calendar" button (shown when the API returns a reminder); **Coming up** (next 3 schedule entries); **Log a visit** (tap a visit chip, see "You pay" from the engine, numbers update for that member only); quick links to Costs, Plan My Year and Assistant. Switching the member in the header reloads every number.

Code: page `src/pages/Home/HomePage.tsx`, data hooks `src/features/home/useHome.ts`, API calls `src/lib/api/home.ts`, types `src/lib/types/home.ts`, tests `HomePage.test.tsx`.

- Calls: `GET /members/{id}/overview`, `GET /members/{id}/schedule` (both with the session token), `GET /procedures`, `POST /estimate`, `POST /benefits-status`, `GET /reminders.ics`.
- Bar widths are layout ratios; every dollar figure is shown as the API returned it.
- "Log a visit" is kept in page state only (no endpoint saves visits yet). It sends the engine's `max_used_after` and `deductible_applied` back through `/benefits-status` to refresh the cards.

## Costs (T11)

`/costs` (`src/pages/Costs/CostsPage.tsx`, parts in `src/features/costs/`, API in `src/lib/api/costs.ts`, shapes in `src/lib/types/costs.ts`). A segmented control switches three views. Every dollar figure comes from the API; the browser only formats.

- **Estimate a procedure:** cards plus plain-word search (from `GET /procedures`), big "You pay" and "Plan pays" from `POST /estimate` for the active member's usage, an in-network / out-of-network toggle (out of network shows balance billing), a trace chart, "Show the math", and savings tips and dentist questions below.
- **Read my dentist's quote:** paste text (or "Use a sample quote"), `POST /treatment-plan/parse`, then review cards with the quoted and typical price. The "Looks high" flag is the `quote_check` tip returned by `POST /savings-tips` (the page sends `quoted_fees`). "Optimize my year" calls `navigate("/plan-year", { state: { treatments } })` where `treatments` is a `TreatmentItem[]` (type `QuoteHandoff`). Plan My Year must read `location.state.treatments` to pick it up (not wired yet).
- **Yearly cost:** sliders for people covered, cleanings and crowns, and an in/out of network toggle. Calls `POST /annual-cost` once for each of `basic`, `preferred` and `premium` (debounced 250 ms) and shows premiums, care cost, total and the assumptions. "Lowest total" compares the totals the server returned.

Tests: `src/pages/Costs/CostsPage.test.tsx` (mocked `fetch`; crown $625 / $800 / out of network $925 with $300 balance billing, 5 matched quote items with the crown flagged, three tiers).

## Assistant (T10)

`/assistant` and the floating "Ask the assistant" button share one chat (`src/features/assistant/AssistantChat.tsx`). It always talks about the **active member** (`useSession().activeMember`); calls use the shared session token (the primary may chat about everyone; others only themselves).

- **Streaming:** `lib/api/assistant.ts` `streamChat` posts to `/chat` (with `member_id`, `attachment_ids`) and parses the SSE events `tool_start`, `tool_end`, `token`, `done`, `error`. Tool events show as chips ("Calculating your cost…"). Dollar amounts are shown exactly as streamed.
- **Threads:** one in-memory thread per member (`features/assistant/threads.ts`), shared by the page and the panel. Switching member shows that person's own thread, chips and context.
- **Recommended questions:** `GET /chat/suggestions?member_id=` as chips above the input.
- **What the assistant knows:** `KnowsPanel` reads `GET /members/{id}/assistant-context` (plan highlights, history, preferences, must-haves, recent questions) and reloads after each answer.
- **PDF:** the paperclip uploads to `POST /chat/attachments` (PDF only, 5 MB limit, demo-only notice); the file shows as a removable chip and its id is sent with the next question.
- **Unavailable:** `done` with `mode: "unavailable"`, an `error` event or a network failure shows a plain message and "Try again"; the rest of the app is unaffected.
- Tests: `src/pages/Assistant/AssistantPage.test.tsx` (mocked stream: chips and context per member, thread separation, unavailable and network states, attach and remove).
