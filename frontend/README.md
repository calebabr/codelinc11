# Frontend

React + Vite + TypeScript portal for Molar Money (the dental benefits product). It talks to the FastAPI backend at `http://localhost:8000` (set `VITE_API_URL` to change it; the backend allows the origin `http://localhost:5173`; for phones, `npm run dev:lan` plus `VITE_API_URL=/api` uses the Vite `/api` proxy, see [../docs/DEMO-PHONES.md](../docs/DEMO-PHONES.md)). The old prototype pages and their mock engine were removed in T19; they are preserved on the `proto/*` branches.

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
| `/welcome` | `Landing.tsx` (public landing page with **Try the demo**) |
| `/join` | `Join/JoinPage.tsx` (**Scan to try**: a QR code made in the browser; `?url=` picks the address, http or https only) |
| `/login` | `Login/LoginPage.tsx` (**Try the demo** and one-click demo account cards from `GET /auth/demo-accounts`, built on `components/auth/AuthLayout.tsx`; one file so design can restyle it) |
| `/style` | style guide (owned by the design task) |

Routes live in `AppRoutes` in `src/App.tsx`; shell parts are in `src/components/shell/`.

**Session (T19, `src/state/SessionContext.tsx`):** the real backend session.

- On load, `SessionProvider` calls `GET /auth/demo-accounts`. Nobody is signed in automatically: a signed-out visitor to any app route (including `/`) is redirected to `/login`. **Try the demo** (landing hero and nav, top of `/login`; `components/auth/TryDemoButton.tsx`) calls `POST /auth/demo-login` with `sandbox: true`, which makes the visitor's own copy of the demo family and signs in as the account holder (Abraham). The family id is remembered in `localStorage` (`dental.demoFamily.v1`), so the button then reads "Continue your demo family" and `/login` offers "Start a fresh family". Under it, one click on Abraham, Mary or Robert signs in to that same family. If the remembered family expired (HTTP 410) a new one is made. After a new family is made, Home shows a one-time **Name your family** card (`features/family/NameFamilyForm.tsx`, primary only; "Rename family" on the Family page) that calls `PUT /households/{id}/names`. The choice is remembered in `sessionStorage` under `dental.signedInMemberId` (nothing else is stored), so a reload in the same tab stays signed in. `/welcome` is the public landing page; its "Log in" and "Get started" go to `/login`. The bearer token is kept in memory. The household is then loaded with `GET /households/{id}`. Template ids: `hh-rivera`, `m-jordan`, `m-alex`, `m-noah`, `m-maya` (Tad has no login); a demo family's ids end in a six-character suffix, for example `m-alex.3f9a1c`.
- `useSession()` (pages) returns `account`, `user` (the signed-in member), `household` (backend shape plus `planTier`, the plan id), `activeMember`, `setActiveMemberId(id)`, `token`, `accounts`, `signIn(memberId)` and `signOut()`. It throws if used outside a ready session, so pages render inside the `Shell`.
- `useSessionGate()` (shell and login) adds `status` (`loading`, `ready`, `error`, `signed-out`), `error` and `retry`. The `Shell` shows a loading note, a clear error with "Try again" when the backend is down, or redirects to `/login` after sign-out.
- Every API call takes the shared `token`. There are no per-page sign-ins. A non-primary person (Mary, Robert) sees only their own household member, as the backend returns.
- The member switcher in the utility bar is a card menu, not a native select.
- Tests use `src/test/session.tsx` (`TestSessionProvider`, fixed Lincoln household with the real ids, token `tok-<id>`, no network). `src/state/SessionContext.test.tsx` covers the real provider with a mocked `fetch`.

## Notifications bell and page (F4)

- **Bell** (`features/notifications/NotificationBell.tsx`, in `components/shell/UtilityBar.tsx`, before the member switcher, so it shows on every shell page including phones): a 44 px button with the lucide `Bell` icon and an orange-dark unread badge (hidden at 0, `9+` above 9). Accessible name "Notifications, N unread", `aria-expanded`. It opens a card under the bar (full width on phones, 24 rem on desktop, max 70dvh, scrolls). Escape, an outside click and any route change close it; Escape returns focus to the bell. The panel shows "Notifications" ("Sam's notifications" when viewing someone else), **Coming up** (first 3 items of `GET /members/{id}/schedule`, a "Nov 18" chip and the title; no "in N days" because the browser has no reliable demo date), **Alerts** (unread, newest first; warning has an orange-dark left border, success green, info neutral; tapping marks it read with `POST .../notifications/{id}/read` and follows its `link`), "Mark all as read" (`POST .../read-all`), "See all notifications" and "Notification settings". It reloads when opened, when the active person changes, after any action (shared event `announceNotificationsChanged()`), and every 60 s while the tab is visible. A 429 shows the server's wait sentence.
- **Page** `/notifications` (`pages/Notifications/NotificationsPage.tsx`, lazy route, not in the nav): the full feed (`GET .../notifications`) with filter chips (All, Unread, Appointments and reminders, Benefits, Claims; kind groups in `features/notifications/kinds.ts`), Open and Mark as read per item, and **Settings** (`NotificationSettings.tsx`, anchor `#settings`): App, Email and Text message switches (`aria-pressed`, each toggle sends the full `PUT .../notification-prefs`), "No email on file" / "No phone on file" with a link to Family, alert-kind chips (`types: null` means all), "Send me a test" for each channel (`POST .../notifications/test`), and the **Delivery preview** list from `GET .../outbox` under the banner "Demo only: emails and text messages are previews. Nothing is sent." A 422 shows the server's sentence inline and the switch stays off; a 403 (shared template family) shows the server's message and makes the settings read-only.
- **Home** has a "Notifications" card (`HomeNotificationsCard.tsx`): top 3 unread, the unread count and a link.
- All text and numbers come from the API; the browser only formats dates. Tests: `features/notifications/Notifications.test.tsx` (mocked `fetch`).

## Plan My Year (T09)

One screen at `/plan-year`. Left: tappable treatment cards (with search) and "Your treatments" with urgency chips (urgent, soon, flexible) and "comes after" chips. Right: the result, which updates by itself when a treatment, urgency or member changes (no "optimize" button). Order: savings banner (everything now, best order, you save), month-by-month timeline with the plan-year reset marked and one "yearly maximum used" bar per year, "Why this order", savings tips, questions to ask your dentist, and "Add reminders to my calendar". "Try the demo case" fills the S2 treatments.

Code: page `src/pages/PlanYear/PlanYearPage.tsx`, parts in `src/features/planYear/`, API calls in `src/lib/api/planYear.ts`, types in `src/lib/types/planYear.ts`, tests in `PlanYearPage.test.tsx`.

- Calls: `GET /procedures`, `POST /schedule`, `POST /savings-tips`, `POST /questions`, `POST /benefits-status`, `GET /reminders.ics`, and `GET /members/{id}/overview` for the active member's usage. The plan id is the household tier. The demo clock is month 11.
- Every dollar figure is displayed from an API response. The only arithmetic is the width of the maximum-used bar (a layout ratio).
- Usage comes from `GET /members/{id}/overview` with the session token (`usage.max_used`, `usage.deductible_met`, `usage.cleanings_used`; cleanings are sent to the engine as `D1110` history entries). There is no demo fallback: if the overview cannot load, the page shows the error.
- Layout: the left column holds the treatment picker (scrolling card grid with search) and "Your treatments" (urgency, "comes after", remove). It is sticky with its own scroll on large screens; on phones the added treatments come first. Results (savings banner, timeline, why this order, tips, questions, calendar) and the "Save this plan" and "My saved plans" cards are in the right column.
- Drafts: one treatment list per person (household and member id) lives in a module-level store (`features/planYear/draftStore.ts`, `useSyncExternalStore`), so switching members or pages and coming back restores it. It is mirrored to localStorage under `dental.planYear.drafts.v1` (versioned, try/catch, bad JSON ignored). A hand-off from Costs loads into the active member's draft once per navigation.
- Saved plans: `lib/api/savedPlans.ts` calls `GET/POST /members/{id}/saved-plans` and `PUT/DELETE /members/{id}/saved-plans/{plan_id}` with the session token. Cards show Open, Rename and Delete (with a confirm step), an "Open now" marker, and an "Unsaved changes" chip with "Update saved plan" when the list differs from the saved one. Opening recomputes with the live `/schedule`, so saved plans hold only treatments, never dollar figures. If the routes return 404 the page says "Saved plans are not available right now" and everything else keeps working.
- Check: Mary, demo case shows $2,300 to $1,405, saves $895; root canal in November, crown in January.

## Plans (T12)

`/plans` (`src/pages/Plans/PlansPage.tsx`, parts in `src/features/plans/`). Reads `GET /plans` (Basic, Preferred, Premium) and shows three tier cards (monthly price, yearly maximum, deductible), a "Your plan" tag on the household's tier (`useSession().household.planTier`), coverage bars for preventive, basic, major and children's orthodontia, a plain-English summary, how often cleanings and exams are covered, and a side-by-side table with the selected tier's column highlighted. Tapping a card selects it. Bar widths are the plan's coverage share from the API; the page does no dollar math. Tests: `src/pages/Plans/PlansPage.test.tsx` (mocked `/plans`).

**Switching the family plan (T24).** Tapping a tier card only previews it. When the previewed tier is not the household's tier, the primary sees a "Switch to this plan" button; tapping it opens an inline confirm panel (`features/plans/PlanSwitch.tsx`) listing what changes (monthly price, yearly maximum, deductible, what the plan pays) and saying each person's usage so far stays. Confirm calls `PUT /households/{id}/plan` with `{tier_id}` through `useSession().changePlan(tierId)`, which stores the returned household so every page, the utility bar ("Lincoln household · Premium plan"), Home, Costs and Plan My Year show the new tier at once, with no reload. `refreshHousehold()` reloads the household from `GET /households/{id}`. After a switch the page shows a success note, the "Your plan" tag moves, and a "Back to Preferred (demo plan)" button appears. Non-primary members see "Only <primary first name> can change the family plan." instead of the button. A 404 (route not on the running server yet) shows a clear "not available on the server yet" message and changes nothing. Home reloads its overview when the tier changes.

**Which plan fits us? (T28, F7).** A section at the bottom of `/plans` (`features/plans/WhichPlanFits.tsx`, results in `SimulateResults.tsx`, request hook in `useSimulate.ts`, call in `lib/api/simulate.ts`, shapes in `lib/types/simulate.ts`). One tappable card per household member (name, age) with Low, Average and High care buttons (default Average); tapping a card toggles coverage and at least one person stays on. A non-primary sees only themself. "Care you already know about" reuses the procedure search and cards (`GET /procedures`), each added item has person chips, and "Try Mary's crown" adds D2740 for Mary. An In network / Out of network toggle is sent as `in_network`. The page calls `POST /simulate` with the session token (n 5000, seed 42), first call at once and later changes debounced about 400 ms. Results: one card per plan in plan-card order with "Cheapest in X% of years" (largest number), Typical year (`median`), Bad year (`p90`), premiums total, a "Best for your family" tag on `winner_plan_id` and a plain note when the winner differs from the household's plan. A plain SVG chart draws bars from `bin_edges` and `histogram` (heights are layout ratios), with a table alternative, the API `reasons`, `assumptions` under "How we estimated this", the disclaimer and "Based on simulated years with synthetic odds". Skeleton while loading, "Try again" on errors, and "Simulation is not available on the server yet" on a 404. The browser does no dollar or percentage math. Tests: `features/plans/WhichPlanFits.test.tsx` (mocked `fetch`).

**Saving a comparison (T35).** Under the results, "Save to Plan My Year" (`features/plans/SaveComparison.tsx`) asks for a name (default "<Winner> is best, <date>"), then calls `POST /members/{id}/saved-simulations` with `{name, request}` and the session token. It sends only the choices (people, care levels, known care, network, plan ids, n, seed), never a result; the server runs the simulation and stores its own summary. After saving it shows a link "See it in Plan My Year". On Plan My Year, "Saved plan comparisons" (`features/planYear/SavedComparisons.tsx`, `useSavedSimulations.ts`, `lib/api/savedSimulations.ts`, types in `lib/types/savedSimulations.ts`) lists one card per saved comparison with the saved summary ("Best: Basic, cheapest in 82% of years", labelled as saved), who is covered with care levels, known care, network and date. Open navigates to `/plans` with router state `{ simulation: <request> }`; `PlansPage` passes it to `WhichPlanFits` as a one-time `preset` (keyed by the navigation), which fills the people, care levels, known care and network, scrolls to the section and runs the live `/simulate`. Rename and Delete (with a confirm step) work like saved treatment plans. On a 404 the page says "Saving comparisons is not available on the server yet." Tests: `features/plans/SaveComparison.test.tsx` (mocked `fetch`).

## Family (T08)

`/family` shows the household as a clickable family tree. Each person is a node (initial, name, relationship, age) with a "Has their own account" chip, a "Managed by <primary first name>" chip for children (for example "Managed by Abraham"), or a dashed "Waiting for approval" chip (Robert); a line under the tree explains that adults 18 and over can have their own account and children's profiles are managed by a parent. Tap a person to see **that person's** numbers: yearly maximum left and used, deductible met, visits, cleanings, and a card for each service (preventive, basic, major, orthodontia) marked Available, Not available or Pending verification, with the age rule and the pending note. "View as this person" switches the active member (the primary, or the person themselves). The primary sees an "Invite" action on adults without a login (age 18 and over); its button reads "Add invite (demo)" and it records the invite as pending ("Invite recorded as pending. No email is sent in this demo.").

The page uses the shared session (see above). A "Demo sign-in" card calls `signIn(memberId)` to switch accounts and check visibility: a non-primary adult sees only their own node.

Code: `src/pages/Family/FamilyPage.tsx`, parts in `src/features/family/`, API in `src/lib/api/family.ts`, types in `src/lib/types/family.ts`, tests in `FamilyPage.test.tsx`. Calls: `GET /households/{id}` is returned by login, `GET /members/{id}/overview`, `POST /households/{id}/invites`.

## Home (T07)

The first page after sign-in (`/`). Top to bottom: a hero strip ("Welcome back, <first name>", plan tier, who is being viewed); three cards with one number each and a bar (**Maximum left**, **Deductible**, **Cleanings used**); the end-of-year reminder with an "Add reminders to my calendar" button (shown when the API returns a reminder); **Coming up** (next 3 schedule entries); **Log a visit** (tap a visit chip: `POST /members/{id}/visits` saves it, "You pay" comes from the response, and the overview reloads so other pages see it; a missing route shows a plain "not available yet" message); a primary-only "Reset demo data" button with an inline confirm calls `POST /demo/reset`; quick links to Costs, Plan My Year and Assistant. Switching the member in the header reloads every number.

Code: page `src/pages/Home/HomePage.tsx`, data hooks `src/features/home/useHome.ts`, API calls `src/lib/api/home.ts`, types `src/lib/types/home.ts`, tests `HomePage.test.tsx`.

- Calls: `GET /members/{id}/overview`, `GET /members/{id}/schedule` (both with the session token), `GET /procedures`, `POST /estimate`, `POST /benefits-status`, `GET /reminders.ics`.
- Bar widths are layout ratios; every dollar figure is shown as the API returned it.
- "Log a visit" saves the visit with `POST /members/{id}/visits` (the server runs the engine and updates that person's usage), then reloads the overview. Rate limits: a 429 from any call shows the server's plain sentence with the wait time (`errorMessage` in `lib/api/planYear.ts`).

## Costs (T11)

`/costs` (`src/pages/Costs/CostsPage.tsx`, parts in `src/features/costs/`, API in `src/lib/api/costs.ts`, shapes in `src/lib/types/costs.ts`). A segmented control switches three views. Every dollar figure comes from the API; the browser only formats.

- **Estimate a procedure:** cards plus plain-word search (from `GET /procedures`), big "You pay" and "Plan pays" from `POST /estimate` for the active member's usage, an in-network / out-of-network toggle (out of network shows balance billing), a trace chart, "Show the math", and savings tips and dentist questions below.
- **Read my dentist's quote:** paste text (or "Use a sample quote"), `POST /treatment-plan/parse`, then review cards with the quoted and typical price. The "Looks high" flag is the `quote_check` tip returned by `POST /savings-tips` (the page sends `quoted_fees`). "Optimize my year" calls `navigate("/plan-year", { state: { treatments } })` where `treatments` is a `TreatmentItem[]` (type `QuoteHandoff`). Plan My Year reads `location.state.treatments` to pick it up.
- **Yearly cost:** sliders for people covered, cleanings and crowns, and an in/out of network toggle. Calls `POST /annual-cost` once for each of `basic`, `preferred` and `premium` (debounced 250 ms) and shows premiums, care cost, total and the assumptions. "Lowest total" compares the totals the server returned.

Tests: `src/pages/Costs/CostsPage.test.tsx` (mocked `fetch`; crown $625 / $800 / out of network $925 with $300 balance billing, 5 matched quote items with the crown flagged, three tiers).

## Assistant (T10)

`/assistant` and the floating "Ask the assistant" button share one chat (`src/features/assistant/AssistantChat.tsx`). It always talks about the **active member** (`useSession().activeMember`); calls use the shared session token (the primary may chat about everyone; others only themselves).

- **Streaming:** `lib/api/assistant.ts` `streamChat` posts to `/chat` (with `member_id`, `attachment_ids`) and parses the SSE events `tool_start`, `tool_end`, `token`, `done`, `error`. Tool events show as chips ("Calculating your cost…"). Dollar amounts are shown exactly as streamed.
- **Threads:** one in-memory thread per member (`features/assistant/threads.ts`), shared by the page and the panel. Switching member shows that person's own thread, chips and context.
- **Follow-ups:** the final `done` event may carry `followups: string[]` (up to 4). `cleanFollowups` in `lib/api/assistant.ts` drops anything that is not a non-empty string. They are kept per member in `threads.ts` and shown as an "Ask next" row of chips that replaces the recommended questions until the person sends anything or clears the chat. Tapping one sends that exact text.
- **Recommended questions:** `GET /chat/suggestions?member_id=` as chips above the input.
- **What Your Assistant Knows:** `KnowsPanel` reads `GET /members/{id}/assistant-context` (plan highlights, history, preferences, must-haves, recent questions) and reloads after each answer.
- **PDF:** the paperclip uploads to `POST /chat/attachments` (PDF only, 5 MB limit, demo-only notice); the file shows as a removable chip and its id is sent with the next question.
- **Unavailable:** `done` with `mode: "unavailable"`, an `error` event or a network failure shows a plain message and "Try again"; the rest of the app is unaffected.
- Tests: `src/pages/Assistant/AssistantPage.test.tsx` (mocked stream: chips and context per member, thread separation, unavailable and network states, attach and remove).


The assistant side panel (`components/shell/AssistantButton.tsx`) is a modal dialog: `role="dialog"`, `aria-modal`, focus moves in on open and back to the button on close, Escape closes, Tab stays inside.

## Phone support (T39)

The app is checked at 360, 375, 390 and 412 px wide and in landscape. Rules the code follows:

- **No sideways page scroll.** The nav scrolls inside its own box; `body` clips overflow. Grid pages use `grid-cols-1` so wide children cannot stretch the page.
- **Touch targets of at least 44 px** for buttons, nav items, member menu rows and chips (`button.chip` has a 44 px minimum in `index.css`), and range sliders.
- **Inputs are 16 px** on screens under 768 px (`index.css`), so iPhone Safari does not zoom the page.
- **Notch and home bar:** `index.html` uses `viewport-fit=cover`; the utility bar, floating assistant button, assistant panel, shell footer and landing nav add `env(safe-area-inset-*)` padding; full-height areas use `dvh`.
- **Assistant panel:** full screen below the `sm` breakpoint. It follows `window.visualViewport`, so the input stays above the on-screen keyboard, and the page behind does not scroll. The close button is 44 px. Focus, Escape and Tab trapping are unchanged.
- **Member menu:** scrolls (max 70% of the screen height), closes on selection, and has a "Sign out" row on phones.
- **Landing page:** the hero zoom, product fan and "How it works" scroll effects run only on wide screens (1024 px and up, 768 px for the fan) and not with reduced motion; phones get a static fan and a stacked list. Screenshots use an 800 px WebP (about 20 KB) through `srcset` instead of the 1600 px PNG (about 300 KB).
- **Install:** `manifest.webmanifest` (name "Molar Money", standalone), `apple-touch-icon.png`, `icon-192.png`, `icon-512.png` and a `theme-color` of `#650030` make "Add to Home Screen" work. There is no service worker.
- **Code splitting:** the shell, Login and Home are in the first bundle; Landing, Join, Style, Plans, Costs, Plan My Year and Assistant load on demand (`React.lazy` in `App.tsx`, with a small "Loading..." state).
- **Voice input** (the mic) needs HTTPS on phones. Over plain `http://` on a Wi-Fi address the browser blocks the microphone and the chat shows its friendly message; it is hidden where the browser has no speech support.
- Tests: `src/components/shell/mobile.test.tsx` checks the viewport meta, manifest, 16 px input rule, 44 px chip rule and the full-screen assistant panel classes.

### Edit family, add and remove people (F3)

Only demo (sandbox) families can be changed: with no `session.sandbox` every edit control is hidden. The primary can edit anyone; a non-primary adult can edit only themself; a managed child cannot edit.

- **Contact row** on the member detail card (`features/family/MemberDetail.tsx`): email and SMS number, the phone masked as `(334) 555-0143` (`features/family/contact.ts`). Empty states are the buttons "Add an email" and "Add a phone" (shown only when editable).
- **Edit profile** (`ProfileForm.tsx`, inline, not a modal): Name, Date of birth (`type=date`), Email, Text message (SMS) number, ZIP, Notes (max 200, with a counter), the helper line "Use made-up contact details. Nothing is sent in this demo.", Save and Cancel. It calls `PATCH /members/{id}/profile` with only the changed fields; a cleared email, phone, ZIP or note is sent as `null`, and the phone is sent as digits only. The server's 422 `detail` shows inline and the form stays open. When the saved member's role changes (a birthday crossing 18) a plain note appears ("Casey is now 18 and counts as an adult. Adults can have their own account.").
- **Add a family member** (`AddMemberForm.tsx`, primary only): name, relationship chips (Spouse, Partner, Child, Other), date of birth, optional email, SMS, ZIP. `POST /households/{id}/members`; the 422 text (for example the 8-people limit) shows inline; success shows "<Name> was added to your family." and selects the new person. In the tree, spouse and partner join the couple, a child hangs below, and "other" appears in an "Other family" row (`FamilyTree.tsx`).
- **Remove from family** (primary, on non-primary people): an inline confirm ("Remove Casey and all of their saved data from your demo family?"), then `DELETE /households/{id}/members/{member_id}`. The account holder shows "The account holder can't be removed from the family." instead of a button.
- Session: `useSession()` gained `updateMember`, `addMember` and `removeMember`. Each applies the change at once, then reloads the household, so the tree, member switcher and assistant chips follow. Types: `FamilyMember` now has optional `dob`, `email`, `phone`, `zip`, `notes`, `primary_dentist_id`.
- "Name your family" and "Rename family" are unchanged.
- Tests: `pages/Family/FamilyEdit.test.tsx` (mocked `fetch`).
