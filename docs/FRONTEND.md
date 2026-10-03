# FRONTEND.md: FE (React), DES (Figma designer) and the UI Agent

Read [FEATURES.md](FEATURES.md) first. That file says **what** to build; this one says **how** the frontend gets built and who does what.

The frontend team is two people with different jobs: **DES designs, FE builds (through the UI agent).** They hand work back and forth through Figma frames and written polish tickets.

---

## 1. Roles

### DES: Frontend designer (human, Figma)
- **Owns:** the look and feel. The Figma file is the visual source of truth.
- **Delivers, in order:**
  1. **Style tile (by 3:30 PM):** colors, type scale, spacing, card/button/input styles, chart colors, category colors. FE's agent turns this into Tailwind theme values on day one, so everything built afterward already matches.
  2. **Mockups of the 3 demo screens (by 6:00 PM):** Estimate, Plan My Year, My Benefits, at desktop and 375 px, with the "You pay" breakdown, the timeline and the savings banner designed carefully. Rough is fine for everything else.
  3. **Later frames as needed:** chat drawer, empty/loading/error states, the glossary tooltip.
- **Reviews the build:** at each checkpoint, compares the running app (or Playwright screenshots) with the frames and files **polish tickets** (below). Does not edit frontend code directly, so FE's agent and DES never touch the same files.
- **Also owns the pitch:** demo script, slides, backup video, README framing (with Bob's help, see §9). A designer is well placed to make the demo tell a clear story.
- **Exports** frames to `docs/design/` as PNGs (and keeps the Figma link in `docs/design/README.md`), so any agent can read them even without the Figma connection.

**Polish ticket format** (keeps feedback precise enough for an agent to act on; post in `#frontend` or add to `TASKS.md`):

```
Screen: Estimate · Viewport: 375px
Problem: "You pay" number wraps onto two lines
Expected: single line, 40px, maroon (see frame "Estimate / mobile")
Priority: P1
```

### FE: Frontend developer (human, React)
- **Owns:** everything in `frontend/`. Decides how screens behave, and signs off that the build matches DES's frames.
- **FE writes little code. The UI agent writes the code and tests; FE directs and checks.**
- **Directs:**
  - Gives the agent each screen's Figma frame (via the Figma connection or a PNG) plus the feature's acceptance line from FEATURES.md.
  - Works through DES's polish tickets by giving them to the agent.
  - Gives specific feedback ("the timeline chips overlap at 375px").
- **Checks before approving every PR:**
  - The screen in the browser at desktop and 375 px. Does it match the Figma frame?
  - Every dollar figure matches FEATURES.md §2 and comes from the API, never computed in the frontend.
  - Loading, error and empty states exist. The disclaimer is shown.
  - The agent's report says typecheck, build and tests passed.
- **Coordinates:** with BE about the API contract, with DES about what's feasible in the time left.

### UI agent (Claude Code, run by FE)
- **Job:** builds screens, components, charts and the chat drawer inside `frontend/`, against the generated API types.
- **Allowed:** create and edit files in `frontend/` and `docs/FRONTEND.md`; read (not edit) `docs/design/`; run `npm` scripts; read (not edit) `backend/app/models.py` and the other `docs/`.
- **Not allowed:** edit anything outside `frontend/`; add money calculations in TypeScript; change generated API types by hand; add large new dependencies without asking FE.
- **Definition of done for any task:** `npm run typecheck && npm run build` passes, the page works in the browser against the running backend (or the stub endpoints), and it works at phone width (375 px).

---

## 2. Stack and setup (first 30 minutes)

```bash
npm create vite@latest frontend -- --template react-ts
```

```bash
cd frontend && npm install @tanstack/react-query recharts react-hook-form zod @hookform/resolvers lucide-react @microsoft/fetch-event-source
```

Then:
- **Tailwind CSS** and **shadcn/ui**: follow shadcn's Vite install guide, then add the components: `button card tabs input slider dialog tooltip badge progress sheet accordion select sonner`.
- **API types:** generate TypeScript types from the FastAPI OpenAPI schema (backend must be running):

```bash
npx openapi-typescript http://localhost:8000/openapi.json -o src/lib/api-types.ts
```

  Add it as an `npm run gen:api` script and rerun it whenever BE announces a contract change in `#contract`.
- **Environment:** `VITE_API_URL=http://localhost:8000` in `frontend/.env`.
- **Scripts in `package.json`:** `dev`, `build`, `typecheck` (`tsc --noEmit`), `lint`, `gen:api`.

---

## 3. Folder structure

```
frontend/src/
├── main.tsx, App.tsx          # router + QueryClientProvider + layout with tabs
├── lib/
│   ├── api-types.ts           # GENERATED. Never edit by hand
│   ├── api.ts                 # typed fetch functions: getPlans, estimate, schedule, ...
│   ├── chat.ts                # SSE client for /chat
│   └── format.ts              # money/percent formatting ONLY (no math)
├── state/
│   └── PlanContext.tsx        # selected plan + usage; saved to localStorage
├── pages/
│   ├── Setup.tsx              # F1
│   ├── Estimate.tsx           # F2
│   ├── PlanYear.tsx           # F3
│   ├── Benefits.tsx           # F4
│   └── ChoosePlan.tsx         # F7 (stretch)
└── components/
    ├── BreakdownCard.tsx      # big "You pay / Plan pays"
    ├── CostWaterfall.tsx      # Recharts waterfall from trace
    ├── MathTrace.tsx          # "Show the math" accordion from trace
    ├── ProcedureSearch.tsx    # autocomplete via /procedures?q=
    ├── NetworkToggle.tsx      # in/out-of-network side by side
    ├── TreatmentBuilder.tsx   # list of items: procedure, urgency, "after"
    ├── YearTimeline.tsx       # months, plan-year divider, procedure chips
    ├── MaxBars.tsx            # annual max used vs left, per year
    ├── SavingsBanner.tsx      # "$2,300 → $1,405, save $895"
    ├── MaxGauge.tsx           # radial gauge for My Benefits
    ├── ChatDrawer.tsx         # shadcn Sheet + streaming messages + tool chips
    ├── Glossary.tsx           # tooltip definitions for insurance terms
    └── Disclaimer.tsx         # "This is an estimate..." footer
```

**State:** the selected plan and usage live in `PlanContext` (React context, saved to `localStorage`) and are sent with every request. No global state library.
**Sign-in (Clerk):** `src/state/AuthProvider.tsx` wraps the app in `ClerkProvider` (key: `VITE_CLERK_PUBLISHABLE_KEY` in `frontend/.env.local`; never the secret key). `/login` and `/signup` render Clerk's `<SignIn />` / `<SignUp />` inside our `AuthLayout`, styled in `components/auth/clerk-appearance.ts`. `/app` is behind `RequireAuth`. The nav shows Log in / Get started or Open bitewise + `<UserButton />`. Pages only: the API doesn't check sign-in yet (that needs the backend to verify Clerk tokens).
**Server data:** TanStack Query for every API call (`useQuery` for reads, `useMutation` for estimate/schedule).

---

## 4. Screens, in build order

| Order | Screen | Build against | Key detail |
|---|---|---|---|
| 1 | **Layout + Setup (F1)** | stub `/plans` | Tabs across the top: Estimate · Plan My Year · My Benefits · (Choose a Plan). "$X left this year" pill in the header. |
| 2 | **Estimate (F2)** | stub `/estimate` | Very large "You pay $800". Waterfall below. "Show the math" collapsed by default. Toggle shows in-network and out-of-network **side by side**, not one replacing the other. |
| 3 | **Plan My Year (F3)** | stub `/schedule` | Timeline with a clear dashed "New plan year: Jan 1" divider. Chips colored by category. Toggle "Everything now ↔ Optimized" animates the chips moving (CSS transition on position). |
| 4 | **My Benefits (F4)** | stub `/benefits-status` | Gauge, deductible bar, cleanings 1 of 2, reminder banner, "Add to calendar" → `GET /reminders.ics`. |
| 5 | **Chat drawer (F5)** | `/chat` (SSE) | Floating button bottom-right on every page. Show tool status chips as events arrive. Stream text token by token. |
| 6 | **Stretch (F6 or F7)** | — | Only after the 2:00 AM stand-up decision. |

### Chat streaming events (agreed with FLEX and BE)

`/chat` sends these SSE event types: `tool_start` `{name}`, `tool_end` `{name}`, `token` `{text}`, `done` `{}`, `error` `{message}`. Use `@microsoft/fetch-event-source`, because the browser's built-in `EventSource` can't send a POST body.

---

## 5. Design rules

- **Colors:** Lincoln maroon `#6b0f2a` (primary), orange `#f5591f` (accent and savings highlights), neutral grays. Category colors: preventive green, basic blue, major amber.
- **Numbers:** "You pay" is the biggest text on the page. Always format with `Intl.NumberFormat` as `$1,405` (no cents unless needed).
- **Tone:** calm and plain. "Your plan covers 80% of fillings" rather than "Coinsurance: 20%". Every insurance term has a glossary tooltip.
- **Every result screen** shows `<Disclaimer />`.
- **Phone width:** test at 375 px. Judges may open it on a phone.
- **Empty/loading/error states:** skeletons while loading; a friendly message and retry on error. Never a blank screen during the demo.

---

## 6. How FE works with the UI agent

**Put this in `frontend/CLAUDE.md`:**

```markdown
# Frontend rules
@../docs/CONVENTIONS.md
@../docs/FEATURES.md

- Stack: React + Vite + TypeScript, Tailwind, shadcn/ui, TanStack Query, Recharts.
- Only edit files in frontend/. Never edit src/lib/api-types.ts (generated: run `npm run gen:api`).
- NEVER compute dollar amounts in the frontend. Display values from the API only. format.ts may only format.
- Every dollar figure must come from an API response field.
- Before finishing: `npm run typecheck && npm run build`, then check the page at 375px width.
- Follow the design rules in docs/FRONTEND.md section 5.
```

**Workflow for each screen:**
1. Start a **new session** for each screen.
2. Use **plan mode**: "Read docs/FEATURES.md F2 and docs/FRONTEND.md. Plan the Estimate page. Here's my sketch: [describe or attach image]." Review the plan and correct it.
3. Let it build. Ask it to **run the dev server and check the page** in the browser.
4. Check it yourself in the browser. Fix with short, specific follow-ups ("make the You pay number 48px and maroon").
5. Commit, open a PR (see [GIT-WORKFLOW.md](GIT-WORKFLOW.md)), and post the PR in `#frontend`. FE merges own-folder PRs after checking; BE merges anything that touches shared files.

**Example starting prompts:**
- *Setup:* "Set up the Vite React TS app in frontend/ per docs/FRONTEND.md sections 2–3: Tailwind, shadcn/ui with the listed components, TanStack Query, the folder structure, PlanContext saved to localStorage, and a tab layout. Stop after typecheck and build pass."
- *Estimate:* "Build pages/Estimate.tsx for feature F2 using the stub /estimate endpoint. Components: ProcedureSearch, BreakdownCard, CostWaterfall (from the trace array), MathTrace, NetworkToggle. Follow the design rules in section 5. All numbers come from the API response."
- *Chat:* "Build ChatDrawer.tsx: a shadcn Sheet opened from a floating button, POST /chat with fetch-event-source, handling the tool_start/tool_end/token/done/error events in FRONTEND.md section 4, with streaming text and tool status chips."

**Running two things in parallel:** if FE wants the agent to build one screen while another session fixes something else, use a separate git worktree for each so they don't overwrite each other's files.

---

## 7. The UI agent's sub-agent team

The main Claude Code session acts as the **orchestrator**: it plans, hands focused tasks to sub-agents, and reviews their work before FE sees it. Keep the team small (2–4 sub-agents) so it stays easy to review.

| Sub-agent | Job | Works in | When |
|---|---|---|---|
| **Screen builder** | Builds one page and its components from the plan | `src/pages/<Page>.tsx`, that page's components | Each feature slot |
| **Test writer** | Writes component tests and the end-to-end test for the finished screen | `src/**/*.test.tsx`, `e2e/` | Right after each screen is built |
| **Docs writer** | Updates `frontend/README.md` and the component table in this file | `frontend/README.md`, `docs/FRONTEND.md` §3 | At each checkpoint |
| **Design polisher** | Works through DES's polish tickets; checks screenshots at desktop and 375 px against the Figma frames | styles and components only, no logic | Polish phase (2–5 AM) |

**Rules for parallel sub-agents:**
- Two sub-agents running at once must **never edit the same files**. Give each a clear file list in its task. If they must overlap, run them one after the other.
- For bigger parallel tasks, give each its own **git worktree** and merge the results.
- The orchestrator runs `typecheck`, `build` and tests after sub-agents finish, then FE reviews in the browser.
- Watch usage limits: sub-agents use up a seat's allowance quickly. Use them for clearly separate chunks of work, not tiny edits.

**Example orchestrator prompt:**
> "Feature F3 is next. Plan it, then use sub-agents: (1) a screen builder for `pages/PlanYear.tsx` + `TreatmentBuilder`, `YearTimeline`, `MaxBars`, `SavingsBanner`; (2) once that's done, a test writer for those components plus an end-to-end test of scenario S2. Run typecheck, build and all tests at the end and report what passed."

---

## 8. Tests

| Level | Tool | What to test | Owner |
|---|---|---|---|
| **Component** | Vitest + React Testing Library | Each component renders the API values it's given (for example, BreakdownCard shows "$800" for the G3 response); loading, empty and error states | Test-writer sub-agent |
| **API mocking** | MSW (Mock Service Worker) | Component and page tests use fixture responses copied from `backend/fixtures/`, so they match the stubs exactly | Test-writer sub-agent |
| **End-to-end** | Playwright | The three demo flows against the real backend: (1) G3 estimate shows "$800", (2) S2 shows "save $895", (3) chat answer includes "$625" | Test-writer sub-agent; FE checks |
| **Visual** | Playwright screenshots | Each page at 1280 px and 375 px, saved so DES and the polish sub-agent can compare them with the Figma frames | Design polisher; DES reviews |

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom msw @playwright/test
```

Add `test` (`vitest run`) and `e2e` (`playwright test`) scripts. CI runs `typecheck`, `build` and `test`. The end-to-end tests run locally before each checkpoint and before the code freeze, because they need the backend running.

**The rule for tests:** the end-to-end tests check the **golden numbers from FEATURES.md**. If an end-to-end test fails on a dollar amount, the bug is in the engine or the API, not in the test. Tell M or BE.

---

## 9. Design and polish with Figma (DES + FE)

**The plan:** DES designs in parallel while FE's agent builds on shadcn defaults, so a pretty design never blocks working features. The Figma style tile is converted into theme values early, so the later polish pass is small.

| When | Who | What |
|---|---|---|
| **1:30–3:30 PM** | DES | **Style tile** in Figma (colors, type, spacing, component styles). First thing out, because FE's agent needs it. Until then the agent uses Lincoln maroon `#6b0f2a` and orange `#f5591f` from §5. |
| **3:30 PM** | DES → FE | Handoff #1: DES exports the tile to `docs/design/` and posts the Figma link. FE's agent sets Tailwind theme colors, fonts and radii from it. |
| **3:30–6:00 PM** | DES | Mockups of the **3 demo screens** at desktop and 375 px. |
| **6:00 PM** | DES → FE | Handoff #2: frames for Estimate, Plan My Year, My Benefits. FE gives each frame to the UI agent when building that screen. |
| **6:00 PM–2:00 AM** | FE's agent builds; DES reviews | At each checkpoint DES compares the running app with the frames and files polish tickets (§1). FE's agent works through them, P0/P1 first. DES also designs the chat drawer and the empty/error states. |
| **2:00–5:00 AM** | FE's agent (polish sub-agent) | Polish pass: spacing, empty states, small animations, phone layout, working from DES's ticket list and the Playwright screenshots. DES is the reviewer of every change. |
| **5:00 AM onward** | DES | Pitch and slides; final visual review of the deployed app. |

**Connecting Figma to Claude Code:** Figma's Dev Mode MCP server lets Claude Code read frames directly (layout, colors, spacing). FE sets it up in the afternoon with DES's account so it's ready by the first handoff. If it gives trouble, **DES exports the frames as PNGs** into `docs/design/` and the agent works from those. That works almost as well.

**If DES finishes early:** DES writes the copy for every screen (plain-language labels, the glossary definitions, the disclaimer), which FE's agent drops in. This is real work that improves the demo.

**Faster alternatives if Figma falls behind:** generate rough mockups with Figma Make or v0 and refine them, or work from the design rules in §5 plus screenshot reviews.

**Polish priorities (in order):** 1) the "You pay" number and savings banner look great; 2) the timeline animation is smooth; 3) loading and error states; 4) phone layout; 5) everything else.

---

## 10. Checklist

- [ ] App set up, tabs, PlanContext, generated API types, Vitest + Playwright set up (by 3:00 PM)
- [ ] DES: Figma style tile (3:30 PM) and 3 mockups (6:00 PM), exported to `docs/design/`; theme values in Tailwind config
- [ ] Setup page (F1)
- [ ] Estimate page against stubs → against real engine (F2) + tests **by 6:30 PM**
- [ ] Plan My Year with timeline and savings banner (F3) + tests **by 10:00 PM**
- [ ] My Benefits + .ics download (F4) + tests
- [ ] Chat drawer with streaming (F5) **by 2:00 AM**
- [ ] Stretch (F6 or F7)
- [ ] Polish pass from DES's tickets; phone-width pass; loading/error states; disclaimer everywhere (2–5 AM)
- [ ] All 3 end-to-end demo flows pass against the real backend
- [ ] `frontend/README.md` up to date (setup, scripts, structure)
- [ ] Production build deployed (Vercel or Netlify) **by 7:00 AM**
