# T43 frontend: Reports pages, "Ask about my reports", and the quote's dentist

**Product owner (2026-10-04):** Claims, EOBs and copays on the Reports page are **synthetic data for the demo**. Stories 7 and 8 of `docs/sprints/SPRINT-2.md`. Where is the page? It does not exist yet; you build it.

Read first: `docs/sprints/SPRINT-2.md` sections "B4 reports and quote matching" and "A1 assistant for reports" (contracts are binding; the backend agent builds the routes in parallel, so mock them in tests and write the client to the contract), `frontend/CLAUDE.md`, `agents/README.md`, `agents/frontend-agent.md`. Copy the structure of the finished Find Providers work (`frontend/src/pages/Providers/`, `features/providers/`, `lib/api/providers.ts`, `lib/types/providers.ts`) and of Notifications.

## Build
1. **`/reports` page** (8th nav item "Reports" in `components/shell/NavBar.tsx`, lazy route in `App.tsx`, update `App.test.tsx` expectations):
   - Top: a plain notice "These are made-up sample documents for the demo. Please do not upload real records." and the estimate/disclaimer line.
   - A "What you owe right now" summary card and totals (billed, allowed, plan paid, you paid, you owe open), all values straight from the API `totals` (no math in the browser; formatting only, use the shared `money()` helper that never prints NaN).
   - Chronological list of saved items (claims, EOBs, copays) with kind chips as filters (All, Claims, EOBs, Copays; chips not dropdowns), a date order toggle, a status badge, and "Mark paid" and "Delete (with confirm)".
   - **Open an item**: card or drawer with the plain-language explanation from `GET .../explain`: what it is, the ordered steps billed, allowed, deductible, plan paid, you owe, what to do next, and an out-of-network balance billing note when present. Show the steps as a simple visual breakdown (bars or a stacked list), not just text.
   - **Add a document**: "Add a sample" cards from `GET /reports/samples` (one tap adds), plus an upload area that accepts a small text file or pasted text in the sample template (`POST .../reports/upload`); show the 422 message plainly. Nothing else is accepted.
   - Friendly loading, empty and error states; works for the viewed member (switcher), managed members show the existing "no access" pattern.
   - A prominent button "Ask the assistant about my reports" linking to `/reports/ask`.
2. **`/reports/ask` page** (separate page, not in the nav, linked from Reports): a full chat page reusing the existing assistant chat components in `features/assistant/` but sending `scope: "reports"` to `POST /chat` (look at how the chat client sets the scope and add the option with minimal change; if a change is needed inside `features/assistant/`, make it small and keep its tests green). Suggestion chips: "What do I owe right now?", "Explain my last EOB", "Why was this claim denied?", "Which visits are still unpaid?". Include a back link to Reports and the synthetic-data notice.
3. **Quote's dentist (story 7)** on the Costs page quote view (`features/costs/`): when the quote parse response has `provider_match`, show a card "This quote is from: <practice>, <dentist>, <address>" with an In network or Out of network badge and "Source: insurer directory"; when `matched` is false say "We could not find this dentist in your plan's directory, so this is priced as out of network" and link to Find Providers. Offer the synthetic quote samples from `GET /treatment-plan/samples` as one-tap "Try a sample quote" cards if the page has a quote input.
4. Types and clients: `lib/types/reports.ts`, `lib/api/reports.ts`, additions to the treatment plan types. Phone friendly (375 px, 44 px targets, 16 px inputs, no sideways scroll), plain language, accessible names on every control.
5. Tests next to the code (MSW or the repo's fetch mocking pattern): list and totals render from the API, filters, open explanation, add sample, upload error message, mark paid, delete confirm, empty and error states, ask page sends `scope: "reports"`, quote provider card matched and unmatched, nav item and routes.

## Do not touch
`backend/`, `database/`, `docs/` (the docs agent does that), theme tokens. No new dependencies. Never run git. Do not start servers on 8000 or 5173.

## Done when
`npm run typecheck`, `npm run test -- --maxWorkers=2` (run twice) and `npm run build` pass. Report in the format in `agents/README.md`.
