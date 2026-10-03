# Task T11: Costs page

**Role:** frontend
**Read first:** agents/README.md, agents/frontend-agent.md, agents/tasks/PLAN.md, `docs/design/portal-look.md`, the ported backend from T03 (and T05's `POST /annual-cost` when it lands)

## Goal
Everything about "what will this cost me": estimate one procedure, read a dentist quote, estimate the yearly cost, with savings tips and the questions to ask your dentist alongside.

## Scope
Kept features: **cost of one procedure** (browse or search, You pay / Plan pays, breakdown chart, show the math, in vs out of network; Caleb), **dentist quote reader** (Caleb), **annual cost calculator** (Sai, rebuilt on the engine), **savings tips**, **questions to ask your dentist**.
Decision D12: features liked, look not. Simplify and make the numbers obvious.
Reference, read-only: Caleb's `Estimate.tsx`, `TreatmentPlan.tsx`, `components/quote/`, `ProcedureGrid.tsx`, `TraceWaterfall.tsx`, `NetworkCompare.tsx`; Sai's calculator in `public/app.js` for the layout idea only.

## You may edit
`frontend/src/pages/Costs/`, `frontend/src/features/costs/`, `frontend/src/lib/api/costs.ts`, `frontend/src/lib/types/costs.ts`, and tests next to them.

## You must not touch
The router, shell and shared context (T02), other pages, `backend/`.

## Interfaces
- Three views switched by a segmented control at the top: **Estimate a procedure**, **Read my dentist's quote**, **Yearly cost**. No dropdowns.
- **Estimate:** procedure cards or plain-word search; a big "You pay $X" with "Plan pays $Y"; a simple step chart; an "in network / out of network" toggle; savings tips and questions below. For the active member's plan and usage.
- **Quote:** paste text (PDF upload is handled by the Assistant in T10); read, review cards with quoted versus typical price and a high-quote flag, then "Optimize my year" sends the treatments to Plan My Year (use the shared context hand-off from T02).
- **Yearly cost:** Sai's idea, rebuilt: sliders for people covered, visits and expected major work; shows each tier side by side with premiums plus expected cost from `POST /annual-cost`, with its assumptions listed. Never compute anything in the browser.
- Estimate disclaimer on results; 375 px layout.

## Acceptance checks
- Crown, fresh year, Preferred: **you pay $625**; with $1,100 used: **$800**; out of network, fresh year: **$925 with $300 balance billing**.
- The sample quote reads 5 matched items with the crown flagged high.
- The yearly cost view shows the three tiers with numbers from the API.
- Tests read exact numbers from mocked responses. `npm run typecheck`, `npm run test`, `npm run build` pass.

## Docs to update
`frontend/README.md` (Costs section).

## Report
Format in agents/README.md.
