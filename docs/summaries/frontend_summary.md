# Frontend summary
_Updated 2026-10-03_

**Built:** the portal shell (utility bar with member switcher, sticky nav, footer with the estimate disclaimer, floating assistant button) and real pages on the backend: Home (`/`), Plans, Family, Costs, Plan My Year, Assistant, plus the public landing page (`/welcome`), demo sign-in (`/login`), the **Scan to try** QR page (`/join`) and `/style`. Product name: Molar Money. The session (`src/state/SessionContext.tsx`) uses `POST /auth/demo-login`: **Try the demo** (landing page and login) makes the visitor's own demo family and signs in as the account holder; the family id is remembered in the browser. Name your family (Home, first run, and Family page "Rename family") calls `PUT /households/{id}/names`. Plans has "Which plan fits us?" (Monte Carlo) with "Save to Plan My Year"; Plan My Year lists saved plan comparisons. The assistant shows "Ask next" chips and up to 7 suggested questions. "Questions to ask your dentist" is a plain list.

**Phones:** pages are lazy loaded (first load about 162 kB of JavaScript, gzipped), `viewport-fit=cover`, 16 px inputs, 44 px targets, a full-screen assistant panel, a web manifest and icons. `npm run dev:lan` serves the app to phones on the same Wi-Fi.

**Counts (2026-10-03):** 17 test files, 151 tests; typecheck and production build clean. On one full run a single sign-in test timed out under load; it passes when run alone.

**Stand-in:** types are hand-written (not generated from `models.py`); `/style` is routed live; the landing page hard-codes the golden figures. No Playwright tests.

Details: `frontend/README.md`, `docs/FRONTEND.md`.
