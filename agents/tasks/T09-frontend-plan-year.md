# Task T09: Plan My Year page

**Role:** frontend
**Read first:** agents/README.md, agents/frontend-agent.md, agents/tasks/PLAN.md, `docs/design/portal-look.md`, the ported backend from T03 (`POST /schedule`, `/procedures`, `/savings-tips`, `/questions`)

## Goal
Demo priority 2: a person lists the treatments they need and sees the cheapest schedule across the plan year, in a way anyone can understand at a glance.

## Scope
Kept features: **plan-year scheduler and timeline** (Caleb; features liked, look not), with **savings tips** and **questions to ask your dentist** shown on the result.
Decision D12: fix the four complaints (look and layout, clutter and extra steps, hard-to-read charts, not portal-like). Fewer steps than before.
Reference, read-only: Caleb's `PlanYear.tsx`, `TreatmentBuilder.tsx`, `ScheduleChart.tsx`, `SavingsBanner.tsx`, `SavingsTips.tsx`, `QuestionsCard.tsx` and their small subcomponents (`git show proto/dental-prototype:frontend/src/...`).

## You may edit
`frontend/src/pages/PlanYear/`, `frontend/src/features/planYear/`, `frontend/src/lib/api/planYear.ts`, `frontend/src/lib/types/planYear.ts`, and tests next to them.

## You must not touch
The router, shell and shared context (T02), other pages, `backend/`.

## Interfaces
- Uses the **active member's** plan tier and usage from the session context and `GET /members/{id}/overview`; the demo clock is November.
- **Fewer steps:** one screen. Left: "Your treatments" as tappable procedure cards and a short list with an urgency toggle (urgent, soon, flexible) and "comes after". Right or below: the result.
- **Result, in this order:** (1) a large savings banner ("Doing everything now $2,300 → Optimized $1,405 → You save $895"); (2) a clean month-by-month timeline with the plan-year reset marked and each treatment's cost; (3) a short "Why this order" list; (4) savings tips; (5) questions to ask your dentist; (6) "Add reminders to my calendar".
- **Charts must read at a glance:** big numbers, direct labels, one idea per chart, no more than the timeline and a single "maximum used" bar per year. No dropdowns.
- A "Try the demo case" button that fills the S2 treatments for the active member.
- Estimate disclaimer; "urgent care should never wait" note; 375 px layout.

## Acceptance checks
- For Mary in November with the S2 treatments the page shows **$2,300 → $1,405, saves $895**, with the root canal in the current year and the crown in January.
- Switching to a different member recomputes with that person's usage.
- Tests read these exact numbers from mocked responses. `npm run typecheck`, `npm run test`, `npm run build` pass.

## Docs to update
`frontend/README.md` (Plan My Year section).

## Report
Format in agents/README.md.
