# Task T28: "Which plan fits us?" on the Plans page

**Role:** frontend
**Read first:** agents/README.md, agents/frontend-agent.md, `docs/features/F7-choose-a-plan-monte-carlo.md` (what the user sees and the exact API contract), docs/design/portal-look.md, frontend/README.md (Plans section), `frontend/src/pages/Plans/`, `frontend/src/features/plans/`, `frontend/src/features/planYear/TreatmentBuilder.tsx` (procedure cards to reuse), `frontend/src/state/SessionContext.tsx`

## Goal
Add a new section "Which plan fits us?" to the Plans page that calls `POST /simulate` and shows, for each plan, how often it is cheapest and what a typical and a bad year cost, with a distribution chart. Build against the contract in the F7 document; the backend agent builds `/simulate` at the same time, so mock it in tests and handle a 404 gracefully until it is live.

## You may edit
`frontend/src/features/plans/` (new files, plus small changes to `PlansPage.tsx` in `pages/Plans/` to mount the section), `frontend/src/lib/api/simulate.ts` and `frontend/src/lib/types/simulate.ts` (new), tests next to them, `frontend/README.md` (Plans section).

## You must not touch
The router, shell, SessionContext, other pages, `backend/`.

## What to build
1. **Who is covered:** one tappable card per household member from `useSession().household.members` (name, age). Each card has a segmented control (three buttons, not a dropdown): Low, Average, High care, default Average. Members visible to the primary are included; an adult who sees only themself gets one card. Tapping a card toggles whether they are covered (at least one stays on).
2. **Known care:** reuse the procedure cards (search plus tap) to add treatments someone already knows they need, assigned to a person (a small row of person chips on each added item). Include a one-tap example "Try Mary's crown" when Mary is a member.
3. **Results:** one card per plan (Basic, Preferred, Premium) in the same order as the plan cards: the headline "Cheapest in X% of years" (the largest number on the card), "Typical year" (median), "Bad year" (90th percentile), the premiums total, and a "Best for your family" tag on the winner. Below: a distribution chart of all three plans. Prefer plain SVG or CSS bars drawn from the API's `bin_edges` and `histogram` counts (no statistics in the browser); a Recharts chart is acceptable if its tests stay stable in jsdom. Include a text alternative (a small table or list) for accessibility.
4. **Why:** the `reasons` list from the API in plain sentences. Also show the `assumptions` (collapsed under "How we estimated this") and the disclaimer plus "Based on simulated years with synthetic odds, not a prediction for your family."
5. An in network / out of network toggle (two buttons). Use the API defaults n 5000 and seed 42 so results are stable. Recompute (debounced about 400 ms) when the covered people, care levels, known care or the network toggle change. Show a skeleton while loading, a friendly error with Try again, and "Simulation is not available on the server yet" on 404.
6. **No dollar or percentage math in the browser.** Format numbers from the API only. Layout works at 375 px (cards stack; the chart fits without page overflow). No native `<select>`.
7. The household's current plan keeps its "Your plan" tag. The winner and the current plan can differ, and the page should say so in one plain sentence (written from API fields, not computed).

## Tests
Mocked `fetch`: renders one card per plan with the API's shares and totals; a care-level change sends the right body and updates results; known care appears in the request; toggling coverage; 404 and error states; the loading skeleton; the table alternative is present; the request carries the session token; a non-primary sees one person. `npm run typecheck`, `npm run test` (run twice) and `npm run build` pass.

## Do not
Run git write commands; start or stop servers.

## Report
Format in agents/README.md.
