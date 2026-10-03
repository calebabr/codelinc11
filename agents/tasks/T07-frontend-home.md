# Task T07: Home page and member switcher

**Role:** frontend
**Read first:** agents/README.md, agents/frontend-agent.md, agents/tasks/PLAN.md, `docs/design/portal-look.md`, T02's shell and session context, T05's report (sign-in, overview and schedule endpoints)

## Goal
The first thing a signed-in person sees: their own benefits at a glance, a reminder before benefits expire, and what's coming up. This is demo priority 1, so it has to look like a real portal and be easy to read.

## Scope
Kept features: **benefits tracking** (maximum gauge, deductible, visit chips, end-of-year reminder, calendar file, log a visit; from Caleb, redesigned) and **upcoming schedule** (from Wrigley). Decision D12: the earlier look was cluttered and charts were hard to read, so keep this page simple.
Reference, read-only: Caleb's `frontend/src/pages/Benefits.tsx`, `components/MaxGauge.tsx` (`git show proto/dental-prototype:...`), Wrigley's `Dashboard.tsx` (on `main`).

## You may edit
`frontend/src/pages/Home/`, `frontend/src/features/home/`, `frontend/src/lib/api/home.ts`, `frontend/src/lib/types/home.ts`, and tests next to them.

## You must not touch
The router, shell and shared context (T02), other pages, `backend/`.

## Interfaces
- Data: `GET /members/{id}/overview`, `GET /members/{id}/schedule`, `POST /estimate` (for "log a visit"), `GET /reminders.ics`. All data is for the **active member** from the session context.
- Layout, top to bottom: a hero strip ("Welcome back, <first name>", plan tier, who you're viewing); three plain cards (**Maximum left**, **Deductible**, **Cleanings used**) with one clear number each and a simple bar or gauge; the end-of-year reminder when it applies; **Coming up** (next 3 events); a short list of quick links to Costs, Plan My Year and Assistant.
- Switching the active member in the header changes every number on the page.
- No native dropdowns; large readable numbers; 375 px layout. Estimate disclaimer where results appear.

## Acceptance checks
- Alex in November shows **$400 left of $1,500** and the reminder; Jordan shows his own different numbers.
- "Log a visit" updates only the active member, using the engine's result.
- Calendar button downloads a valid `.ics`.
- Loading, empty and error states exist. `npm run typecheck`, `npm run test`, `npm run build` pass. Tests read exact numbers from mocked API responses.

## Docs to update
`frontend/README.md` (Home section).

## Report
Format in agents/README.md, with the URL and the numbers to compare.
