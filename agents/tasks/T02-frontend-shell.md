# Task T02: Portal shell and six routes

**Role:** frontend
**Read first:** agents/README.md, agents/frontend-agent.md, agents/tasks/PLAN.md, `frontend/src/App.tsx`, `frontend/src/pages/`, `frontend/src/state/UserContext.tsx`, `frontend/src/components/ChatPanel.tsx`

## Goal
A portal-style app shell with the six pages as routes (placeholders for now), so every page task and Ulisses's login UI can be built into it.

## Scope
- Decisions D4 (six pages) and D5 (portal look).
- Reference, read-only: Sai's layout (`git show prototype/sai-benefits-portal:benefits-portal/public/index.html`) and the current `main` shell.

## You may edit
- `frontend/src/App.tsx`, `frontend/src/main.tsx`, router setup
- `frontend/src/components/shell/` (create: utility bar, sticky nav, footer, global assistant button)
- `frontend/src/state/` (session and active-member context)
- `frontend/src/pages/Home/`, `Plans/`, `Family/`, `Costs/`, `PlanYear/`, `Assistant/` (placeholder pages only, each with a heading and an empty state)
- Remove or retire the old placeholder pages (`Coverage`, `Estimate`, `GetStarted`, `Dashboard`, `Chatbot`, `Profiles`) once replaced, keeping their features for T07–T12 to port

## You must not touch
`index.css` tokens (T01), `backend/`, `database/`, `tests/`, `package.json`.

## Interfaces
- Routes: `/` Home, `/plans`, `/family`, `/costs`, `/plan-year`, `/assistant`, plus `/login` reserved for Ulisses.
- Nav items: Home, Plans, Family, Costs, Plan My Year, Assistant. A slim utility bar above a sticky white nav, in the portal look, using token names from `agents/tasks/PLAN.md`.
- **Session context:** exposes the signed-in account, the household and the **active member**, with a member switcher in the header. Until T05 lands, back it with a small mock so the pages can be built.
- A floating assistant button on every page except `/assistant`, opening a chat panel (the panel body is T10's; stub it).
- **Running at the same time:** T01 (tokens), T03, T04. Do not edit their files.

## Acceptance checks
- Every route renders a placeholder; nav highlights the current page; layout works at 375 px (nav scrolls or collapses).
- Switching the active member updates the context and the header label.
- No native dropdown for the member switcher (use a card or chip menu).
- `npm run typecheck`, `npm run build` and `npm run test` pass.
- Tests: route rendering and member-switching tests next to the code.

## Docs to update
`frontend/README.md` (routes and context).

## Report
Format in agents/README.md. After this passes, the orchestrator pushes the integration branch for Ulisses.
