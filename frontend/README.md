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
| `/login`, `/signup` | `Login/LoginPage.tsx`, `Signup/SignupPage.tsx` (Clerk's sign-in and sign-up forms in `components/auth/AuthLayout.tsx`) |
| `/choose-profile` | `ChooseProfile/ChooseProfilePage.tsx` ("Who's using bitewise?": one card per profile from `GET /auth/demo-accounts`; one file so design can restyle it) |
| `/style` | style guide (owned by the design task) |

Routes live in `AppRoutes` in `src/App.tsx`; shell parts are in `src/components/shell/`.

**Session (T19, `src/state/SessionContext.tsx`):** the real backend session.

- Sign-in has two steps. First Clerk (`/login` or `/signup`): a visitor who is not signed in to Clerk is sent from any app route (including `/`) to `/login`, and back afterwards. Then the household profile: `SessionProvider` calls `GET /auth/demo-accounts`, and with no profile picked the visitor goes to `/choose-profile`, where one click on Jordan, Alex or Noah calls `POST /auth/demo-login` (sent with the Clerk session token) and goes to `/`. While signed out of Clerk the provider is paused and calls no API. The choice is remembered in `sessionStorage` under `dental.signedInMemberId` (nothing else is stored), so a reload in the same tab stays signed in. `/welcome` is the public landing page; its "Log in" goes to `/login` and "Get started" to `/signup`. The bearer token is kept in memory. The household is then loaded with `GET /households/{id}`. Real ids: `hh-rivera`, `m-jordan`, `m-alex`, `m-noah`, `m-maya` (Maya has no login).
- `useSession()` (pages) returns `account`, `user` (the signed-in member), `household` (backend shape plus `planTier`, the plan id), `activeMember`, `setActiveMemberId(id)`, `token`, `accounts`, `signIn(memberId)` and `signOut()`. It throws if used outside a ready session, so pages render inside the `Shell`.
- `useSessionGate()` (shell and login) adds `status` (`loading`, `ready`, `error`, `signed-out`), `error` and `retry`. The `Shell` shows a loading note, a clear error with "Try again" when the backend is down, or redirects to `/choose-profile` when no profile is picked ("Switch profile" in the utility bar). "Sign out" signs out of Clerk and returns to `/welcome`.
- Every API call takes the shared `token`. There are no per-page sign-ins. A non-primary person (Alex, Noah) sees only their own household member, as the backend returns.
- The member switcher in the utility bar is a card menu, not a native select.
- Tests use `src/test/session.tsx` (`TestSessionProvider`, fixed Rivera household with the real ids, token `tok-<id>`, no network). `src/state/SessionContext.test.tsx` covers the real provider with a mocked `fetch`.

## Plan My Year (T09)

One screen at `/plan-year`. Left: tappable treatment cards (with search) and "Your treatments" with urgency chips (urgent, soon, flexible) and "comes after" chips. Right: the result, which updates by itself when a treatment, urgency or member changes (no "optimize" button). Order: savings banner (everything now, best order, you save), month-by-month timeline with the plan-year reset marked and one "yearly maximum used" bar per year, "Why this order", savings tips, questions to ask your dentist, and "Add reminders to my calendar". "Try the demo case" fills the S2 treatments.

Code: page `src/pages/PlanYear/PlanYearPage.tsx`, parts in `src/features/planYear/`, API calls in `src/lib/api/planYear.ts`, types in `src/lib/types/planYear.ts`, tests in `PlanYearPage.test.tsx`.

- Calls: `GET /procedures`, `POST /schedule`, `POST /savings-tips`, `POST /questions`, `POST /benefits-status`, `GET /reminders.ics`, and `GET /members/{id}/overview` for the active member's usage. The plan id is the household tier. The demo clock is month 11.
- Every dollar figure is displayed from an API response. The only arithmetic is the width of the maximum-used bar (a layout ratio).
- Usage comes from `GET /members/{id}/overview` with the session token (`usage.max_used`, `usage.deductible_met`, `usage.cleanings_used`; cleanings are sent to the engine as `D1110` history entries). There is no demo fallback: if the overview cannot load, the page shows the error.
- Layout: the left column holds the treatment picker (scrolling card grid with search) and "Your treatments" (urgency, "comes after", remove). It is sticky with its own scroll on large screens; on phones the added treatments come first. Results (savings banner, timeline, why this order, tips, questions, calendar) and the "Save this plan" and "My saved plans" cards are in the right column.
- Drafts: one treatment list per person (household and member id) lives in a module-level store (`features/planYear/draftStore.ts`, `useSyncExternalStore`), so switching members or pages and coming back restores it. It is mirrored to localStorage under `dental.planYear.drafts.v1` (versioned, try/catch, bad JSON ignored). A hand-off from Costs loads into the active member's draft once per navigation.
- Saved plans: `lib/api/savedPlans.ts` calls `GET/POST /members/{id}/saved-plans` and `PUT/DELETE /members/{id}/saved-plans/{plan_id}` with the session token. Cards show Open, Rename and Delete (with a confirm step), an "Open now" marker, and an "Unsaved changes" chip with "Update saved plan" when the list differs from the saved one. Opening recomputes with the live `/schedule`, so saved plans hold only treatments, never dollar figures. If the routes return 404 the page says "Saved plans are not available right now" and everything else keeps working.
- Check: Alex, demo case shows $2,300 to $1,405, saves $895; root canal in November, crown in January.

## Plans (T12)

`/plans` (`src/pages/Plans/PlansPage.tsx`, parts in `src/features/plans/`). Reads `GET /plans` (Basic, Preferred, Premium) and shows three tier cards (monthly price, yearly maximum, deductible), a "Your plan" tag on the household's tier (`useSession().household.planTier`), coverage bars for preventive, basic, major and children's orthodontia, a plain-English summary, how often cleanings and exams are covered, and a side-by-side table with the selected tier's column highlighted. Tapping a card selects it. Bar widths are the plan's coverage share from the API; the page does no dollar math. Tests: `src/pages/Plans/PlansPage.test.tsx` (mocked `/plans`).

**Switching the family plan (T24).** Tapping a tier card only previews it. When the previewed tier is not the household's tier, the primary sees a "Switch to this plan" button; tapping it opens an inline confirm panel (`features/plans/PlanSwitch.tsx`) listing what changes (monthly price, yearly maximum, deductible, what the plan pays) and saying each person's usage so far stays. Confirm calls `PUT /households/{id}/plan` with `{tier_id}` through `useSession().changePlan(tierId)`, which stores the returned household so every page, the utility bar ("Rivera household · Premium plan"), Home, Costs and Plan My Year show the new tier at once, with no reload. `refreshHousehold()` reloads the household from `GET /households/{id}`. After a switch the page shows a success note, the "Your plan" tag moves, and a "Back to Preferred (demo plan)" button appears. Non-primary members see "Only <primary first name> can change the family plan." instead of the button. A 404 (route not on the running server yet) shows a clear "not available on the server yet" message and changes nothing. Home reloads its overview when the tier changes.

## Family (T08)

`/family` shows the household as a clickable family tree. Each person is a node (initial, name, relationship, age) with a "Has their own account" chip, a "Managed by <primary first name>" chip for children (for example "Managed by Jordan"), or a dashed "Waiting for approval" chip (Noah); a line under the tree explains that adults 18 and over can have their own account and children's profiles are managed by a parent. Tap a person to see **that person's** numbers: yearly maximum left and used, deductible met, visits, cleanings, and a card for each service (preventive, basic, major, orthodontia) marked Available, Not available or Pending verification, with the age rule and the pending note. "View as this person" switches the active member (the primary, or the person themselves). The primary sees an "Invite" action on adults without a login (age 18 and over); its button reads "Add invite (demo)" and it records the invite as pending ("Invite recorded as pending. No email is sent in this demo.").

The page uses the shared session (see above). A "Demo sign-in" card calls `signIn(memberId)` to switch accounts and check visibility: a non-primary adult sees only their own node.

Code: `src/pages/Family/FamilyPage.tsx`, parts in `src/features/family/`, API in `src/lib/api/family.ts`, types in `src/lib/types/family.ts`, tests in `FamilyPage.test.tsx`. Calls: `GET /households/{id}` is returned by login, `GET /members/{id}/overview`, `POST /households/{id}/invites`.

## Home (T07)

The first page after sign-in (`/`). Top to bottom: a hero strip ("Welcome back, <first name>", plan tier, who is being viewed); three cards with one number each and a bar (**Maximum left**, **Deductible**, **Cleanings used**); the end-of-year reminder with an "Add reminders to my calendar" button (shown when the API returns a reminder); **Coming up** (next 3 schedule entries); **Log a visit** (tap a visit chip: `POST /members/{id}/visits` saves it, "You pay" comes from the response, and the overview reloads so other pages see it; a missing route shows a plain "not available yet" message); a primary-only "Reset demo data" button with an inline confirm calls `POST /demo/reset`; quick links to Costs, Plan My Year and Assistant. Switching the member in the header reloads every number.

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
- **What Your Assistant Knows:** `KnowsPanel` reads `GET /members/{id}/assistant-context` (plan highlights, history, preferences, must-haves, recent questions) and reloads after each answer.
- **PDF:** the paperclip uploads to `POST /chat/attachments` (PDF only, 5 MB limit, demo-only notice); the file shows as a removable chip and its id is sent with the next question.
- **Unavailable:** `done` with `mode: "unavailable"`, an `error` event or a network failure shows a plain message and "Try again"; the rest of the app is unaffected.
- Tests: `src/pages/Assistant/AssistantPage.test.tsx` (mocked stream: chips and context per member, thread separation, unavailable and network states, attach and remove).


The assistant side panel (`components/shell/AssistantButton.tsx`) is a modal dialog: `role="dialog"`, `aria-modal`, focus moves in on open and back to the button on close, Escape closes, Tab stays inside.
