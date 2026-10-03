# Frontend (React + Vite + TypeScript)

Tailwind, shadcn/ui, TanStack Query, Recharts. Overview: [../docs/PROTOTYPE.md](../docs/PROTOTYPE.md); spec: [../docs/PROTOTYPE-SPEC.md](../docs/PROTOTYPE-SPEC.md).

## Setup

From `frontend/`:

```bash
npm install
cp .env.example .env     # optional; sets VITE_API_URL
npm run dev              # http://localhost:5173
```

The backend should be running on port 8000 (see [../backend/README.md](../backend/README.md)).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server at http://localhost:5173 |
| `npm run build` | Typecheck then production build into `dist/` |
| `npm run typecheck` | TypeScript check only |
| `npm run test` | Vitest (jsdom, Testing Library; `fetch` is mocked) |
| `npm run lint` | ESLint |

Before handing work over: `npm run typecheck && npm run build && npm run test`.

## Talking to the backend

`src/lib/api.ts` has typed fetch functions. The base URL is `import.meta.env.VITE_API_URL ?? "http://localhost:8000"`. Set `VITE_API_URL` in `frontend/.env` to point at another host. Chat uses server-sent events through `@microsoft/fetch-event-source` (`src/lib/chat.ts`). If the server is down the UI shows "Can't reach the server: is the backend running on port 8000?".

## Structure

```
src/
  main.tsx, App.tsx     entry; navigation is React state (lib/nav.ts), no router
  lib/                  types.ts (hand-written mirror of backend models.py), api.ts, format.ts, chat.ts, nav.ts, utils.ts
  state/PlanContext.tsx selected/custom plan, usage, current month (saved to localStorage)
  pages/                Landing, Setup, Estimate, PlanYear, Benefits, TreatmentPlan
  components/           app components (below)
  components/ui/        shadcn primitives
  test/                 fixtures, helpers, setup (tests also sit beside code as *.test.ts(x))
```

## Pages

Landing, then Setup (pick or enter a plan, what you have used, current month), then Estimate, Plan My Year (PlanYear) and My Benefits (Benefits). A **Chat drawer** is available on every page after Landing with an "AI: Ollama" / "AI: offline mode" badge. **Dentist Quote** (`TreatmentPlan.tsx`): paste a treatment plan, read it, see quoted vs typical price bars, edit urgency, then "Optimize my year with these" hands the items to Plan My Year through a draft in `PlanContext` (in memory only; quote data is not saved). Paste text only; photo/PDF upload is planned. Estimate and Plan My Year also show `SavingsTips` and `QuestionsCard`. Not built: plan PDF upload, Compare Plans.

## Components

No native dropdowns; the UI uses visual controls.
- `Controls.tsx`: SegmentedControl, MonthStrip, SliderField, VisitChips
- `ProcedureGrid` (tappable procedure cards by category), `ProcedureSearch`, `TreatmentBuilder` (chip tray, 3-way urgency, "Must come after..." linking)
- Estimate: `BreakdownCard`, `NetworkCompare`, `MathTrace`, `TraceWaterfall` (Recharts, hover explanations), `CoverageBars`
- Plan My Year: `SavingsBanner`, `ScheduleChart` (month timeline with "New plan year" line, per-year max bars), `YearTimeline`
- Benefits: `MaxGauge` (radial max gauge)
- Dentist Quote: `components/quote/` (`PriceBars`, `QuoteItemCard`, `UnmatchedPanel`, `buildHandoff`, `sample`)
- `QuestionsCard` (tickable question cards, progress, Copy list, Print; `questions/format.ts`) and `SavingsTips` (`savings/TipCard`, `BeforeAfterBars`). Tips overlap, so savings are never summed.
- Shared: `AppShell`, `ChatDrawer`, `Glossary`, `Disclaimer`, `StateViews`, `CategoryChip`

## Design rules

- **Never compute dollar amounts** in the frontend. Display API fields only; `src/lib/format.ts` formats numbers and nothing else.
- Brand colors: maroon `#6b0f2a`, orange `#f5591f`.
- Mobile friendly down to 375 px wide.
- Plain language, calm tone. Every results screen shows: "This is an estimate, not a guarantee. Your actual cost depends on your dentist's charges and claim review."
- Loading skeletons and friendly error states.
- Never suggest delaying urgent care.
