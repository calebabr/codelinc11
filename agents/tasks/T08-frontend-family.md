# Task T08: Family page

**Role:** frontend
**Read first:** agents/README.md, agents/frontend-agent.md, agents/tasks/PLAN.md, `docs/design/portal-look.md`, T05's report (household and member endpoints)

## Goal
Sai's graphical family view: who is in the household and exactly what each person can use, with each person's own numbers. This is part of demo priority 1.

## Scope
Kept features: **family diagram and "what's available for each person"** (Sai), **age limits, student rule and pending verification** (Wrigley and Sai), **per-person usage** (Wrigley), and the **invite** flow (decision F2).
Reference, read-only: Sai's `public/app.js` (`renderTree`, `renderDetail`) and `index.html` (`git show prototype/sai-benefits-portal:benefits-portal/public/...`), Wrigley's `Profiles.tsx` (on `main`).

## You may edit
`frontend/src/pages/Family/`, `frontend/src/features/family/`, `frontend/src/lib/api/family.ts`, `frontend/src/lib/types/family.ts`, and tests next to them.

## You must not touch
The router, shell and shared context (T02), other pages, `backend/`.

## Interfaces
- Data: `GET /households/{id}`, `GET /members/{id}/overview`, `POST /households/{id}/invites`.
- **Diagram:** a clickable family tree (SVG or HTML) with each person as a node: initial, name, relationship and age, a "pending" style for Noah, and a small "has login" marker for adults. Click a person to select them (this also sets the page's detail view; it does not need to change the signed-in member).
- **Detail panel for the selected person:** chips for each service (preventive, basic, major, orthodontia) shown as available, not available, or pending verification; their own **maximum used and left**, deductible and visits; the age rule that applies ("covered to 19, or 26 as a full-time student"); a note for pending status; and a "View as this person" action that switches the active member if the signed-in account may.
- **Invite:** for the primary, an "Invite" action on adult members without a login (adults 18 and over only); shows the pending invite state. Demo-level only.
- Respect visibility: the primary sees everyone; an adult sees themself only (the page shows just their node).
- Plain wording, no dropdowns, 375 px layout.

## Acceptance checks
- The Rivera household shows four nodes; Noah is pending with his note; Maya is a managed profile with no login marker.
- Selecting each person shows **that person's** numbers (not a household total).
- Signing in as an adult who is not primary shows only their own node.
- Tests read exact values from mocked API responses. `npm run typecheck`, `npm run test`, `npm run build` pass.

## Docs to update
`frontend/README.md` (Family section).

## Report
Format in agents/README.md.
