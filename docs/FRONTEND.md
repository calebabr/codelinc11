# FRONTEND.md: Frontend Lead (CS3) and UI Agent (Claude Code)

Read [FEATURES.md](FEATURES.md) first. That file says **what** to build; this one says **how** the frontend gets built and who does what.

---

## 1. Roles

### CS3: Frontend lead (human)
- **Owns:** everything in `frontend/`. Decides how screens look and behave.
- **CS3 writes little code. The UI agent writes the code and tests; CS3 directs and checks.**
- **Directs:**
  - Sketches each screen (paper, Excalidraw or Figma, 5 minutes) **before** asking the agent to build it. The agent builds much better UI from a sketch or a clear description than from "make it look nice."
  - Gives specific feedback ("make the You pay number 48px and maroon", "the timeline chips overlap at 375px").
- **Checks before approving every PR:**
  - The screen in the browser at desktop and 375 px. Does it match the sketch or Figma frame?
  - Every dollar figure matches FEATURES.md §2 and comes from the API, never computed in the frontend.
  - Loading, error and empty states exist. The disclaimer is shown.
  - The agent's report says typecheck, build and tests passed.
- **Coordinates:** with CS1 about the API contract, with CS4 about demo wording.

### UI agent (Claude Code, run by CS3)
- **Job:** builds screens, components, charts and the chat drawer inside `frontend/`, against the generated API types.
- **Allowed:** create and edit files in `frontend/`, `docs/FRONTEND.md` and `docs/design/`; run `npm` scripts; read (not edit) `backend/app/models.py` and the other `docs/`.
- **Not allowed:** edit anything outside `frontend/`; add money calculations in TypeScript; change generated API types by hand; add large new dependencies without asking CS3.
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

  Add it as an `npm run gen:api` script and rerun it whenever CS1 announces a contract change in `#contract`.
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

### Chat streaming events (agreed with CS2 and CS1)

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

## 6. How CS3 works with the UI agent

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
5. Commit, open a PR, and post the PR in `#frontend`. CS1 merges.

**Example starting prompts:**
- *Setup:* "Set up the Vite React TS app in frontend/ per docs/FRONTEND.md sections 2–3: Tailwind, shadcn/ui with the listed components, TanStack Query, the folder structure, PlanContext saved to localStorage, and a tab layout. Stop after typecheck and build pass."
- *Estimate:* "Build pages/Estimate.tsx for feature F2 using the stub /estimate endpoint. Components: ProcedureSearch, BreakdownCard, CostWaterfall (from the trace array), MathTrace, NetworkToggle. Follow the design rules in section 5. All numbers come from the API response."
- *Chat:* "Build ChatDrawer.tsx: a shadcn Sheet opened from a floating button, POST /chat with fetch-event-source, handling the tool_start/tool_end/token/done/error events in FRONTEND.md section 4, with streaming text and tool status chips."

**Running two things in parallel:** if CS3 wants the agent to build one screen while another session fixes something else, use a separate git worktree for each so they don't overwrite each other's files.

---

## 7. The UI agent's sub-agent team

The main Claude Code session acts as the **orchestrator**: it plans, hands focused tasks to sub-agents, and reviews their work before CS3 sees it. Keep the team small (2–4 sub-agents) so it stays easy to review.

| Sub-agent | Job | Works in | When |
|---|---|---|---|
| **Screen builder** | Builds one page and its components from the plan | `src/pages/<Page>.tsx`, that page's components | Each feature slot |
| **Test writer** | Writes component tests and the end-to-end test for the finished screen | `src/**/*.test.tsx`, `e2e/` | Right after each screen is built |
| **Docs writer** | Updates `frontend/README.md` and the component table in this file | `frontend/README.md`, `docs/FRONTEND.md` §3 | At each checkpoint |
| **Design polisher** | Applies the Figma design / design rules, checks screenshots at desktop and 375 px | styles and components only, no logic | Polish phase (2–5 AM) |

**Rules for parallel sub-agents:**
- Two sub-agents running at once must **never edit the same files**. Give each a clear file list in its task. If they must overlap, run them one after the other.
- For bigger parallel tasks, give each its own **git worktree** and merge the results.
- The orchestrator runs `typecheck`, `build` and tests after sub-agents finish, then CS3 reviews in the browser.
- Watch usage limits: sub-agents use up a seat's allowance quickly. Use them for clearly separate chunks of work, not tiny edits.

**Example orchestrator prompt:**
> "Feature F3 is next. Plan it, then use sub-agents: (1) a screen builder for `pages/PlanYear.tsx` + `TreatmentBuilder`, `YearTimeline`, `MaxBars`, `SavingsBanner`; (2) once that's done, a test writer for those components plus an end-to-end test of scenario S2. Run typecheck, build and all tests at the end and report what passed."

---

## 8. Tests

| Level | Tool | What to test | Owner |
|---|---|---|---|
| **Component** | Vitest + React Testing Library | Each component renders the API values it's given (for example, BreakdownCard shows "$800" for the G3 response); loading, empty and error states | Test-writer sub-agent |
| **API mocking** | MSW (Mock Service Worker) | Component and page tests use fixture responses copied from `backend/fixtures/`, so they match the stubs exactly | Test-writer sub-agent |
| **End-to-end** | Playwright | The three demo flows against the real backend: (1) G3 estimate shows "$800", (2) S2 shows "save $895", (3) chat answer includes "$625" | Test-writer sub-agent; CS3 checks |
| **Visual** | Playwright screenshots | Each page at 1280 px and 375 px, saved for the design polisher to compare | Design polisher |

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom msw @playwright/test
```

Add `test` (`vitest run`) and `e2e` (`playwright test`) scripts. CI runs `typecheck`, `build` and `test`. The end-to-end tests run locally before each checkpoint and before the code freeze, because they need the backend running.

**The rule for tests:** the end-to-end tests check the **golden numbers from FEATURES.md**. If an end-to-end test fails on a dollar amount, the bug is in the engine or the API, not in the test. Tell M or CS1.

---

## 9. Design polish with Figma

The plan is to **build on shadcn defaults first, then polish from a design**, so a pretty design never blocks working features.

| When | Who | What |
|---|---|---|
| **2:30–6:00 PM** | CS3 (or CS4 when the data is done) | In Figma, make a **style tile** (colors, type scale, card style, button style, chart colors) plus quick mockups of the **3 demo screens**: Estimate, Plan My Year, My Benefits. Keep it rough. This is about 1–2 hours. |
| **6:00 PM–2:00 AM** | UI agent | Builds features with the style tile's colors and fonts already set as Tailwind theme values, so later polish is small. |
| **2:00–5:00 AM** | Design polisher sub-agent | Polish pass: matches the Figma mockups, spacing, empty states, small animations, phone layout. Compares Playwright screenshots against the mockups. |

**Connecting Figma to Claude Code:** Figma's Dev Mode MCP server lets Claude Code read frames directly (layout, colors, spacing) instead of working from screenshots. Set it up in the afternoon so it's ready by the polish phase. If setup gives you trouble, **export the frames as PNGs** into `docs/design/` and point the agent at them. That works almost as well.

**Faster alternatives if nobody wants to use Figma:** generate mockups with an AI UI tool (Figma Make, v0, or Claude itself) and use them as the reference, or skip mockups and polish against the design rules in section 5 plus screenshot reviews.

**Polish priorities (in order):** 1) the "You pay" number and savings banner look great; 2) the timeline animation is smooth; 3) loading and error states; 4) phone layout; 5) everything else.

---

## 10. Checklist

- [ ] App set up, tabs, PlanContext, generated API types, Vitest + Playwright set up (by 3:00 PM)
- [ ] Figma style tile + 3 mockups (by 6:00 PM); theme values in Tailwind config
- [ ] Setup page (F1)
- [ ] Estimate page against stubs → against real engine (F2) + tests **by 6:30 PM**
- [ ] Plan My Year with timeline and savings banner (F3) + tests **by 10:00 PM**
- [ ] My Benefits + .ics download (F4) + tests
- [ ] Chat drawer with streaming (F5) **by 2:00 AM**
- [ ] Stretch (F6 or F7)
- [ ] Polish pass from Figma; phone-width pass; loading/error states; disclaimer everywhere (2–5 AM)
- [ ] All 3 end-to-end demo flows pass against the real backend
- [ ] `frontend/README.md` up to date (setup, scripts, structure)
- [ ] Production build deployed (Vercel or Netlify) **by 7:00 AM**
