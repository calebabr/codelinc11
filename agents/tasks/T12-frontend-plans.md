# Task T12: Plans page

**Role:** frontend
**Read first:** agents/README.md, agents/frontend-agent.md, agents/tasks/PLAN.md, `docs/design/portal-look.md`, T05's report (`GET /plans`, `GET /members/{id}/overview`)

## Goal
Compare the three plan tiers and see your own coverage in plain English.

## Scope
Kept features: **plan comparison** (Sai), **per-service coverage details** (Wrigley and Sai), the household's current tier highlighted.
Decision D10: dental only; orthodontia for children stays; no vision.
Reference, read-only: Sai's `public/index.html` and `app.js` (`renderTiers`, `renderCoverage`) via `git show prototype/sai-benefits-portal:...`; Wrigley's `Profiles.tsx` plan section.

## You may edit
`frontend/src/pages/Plans/`, `frontend/src/features/plans/`, `frontend/src/lib/api/plans.ts`, `frontend/src/lib/types/plans.ts`, and tests next to them.

## You must not touch
The router, shell and shared context (T02), other pages, `backend/`.

## Interfaces
- Three tier cards (Basic, Preferred, Premium): monthly price, yearly maximum, deductible, with a "Your plan" tag on the household's tier. Selecting a card updates the coverage bars below (preventive, basic, major, orthodontia) and highlights that tier's column in a side-by-side table.
- A plain-English summary of the selected tier ("Plan pays 80% of fillings after a $50 deductible, up to $1,500 a year").
- Optional: per-service details (how often covered, age limits).
- All values come from `GET /plans`; nothing hard-coded. Cards and chips, no dropdowns; 375 px layout.

## Acceptance checks
- The three tiers match the D6 table exactly (Preferred: $44, $1,500, $50 deductible, 100/80/50, ortho 50%).
- The household's tier is tagged; selecting another tier changes the bars and table.
- Tests read these numbers from a mocked `/plans`. `npm run typecheck`, `npm run test`, `npm run build` pass.

## Docs to update
`frontend/README.md` (Plans section).

## Report
Format in agents/README.md.
