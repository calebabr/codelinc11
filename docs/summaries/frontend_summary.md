# Frontend summary
_Updated 2026-10-04_

**Built:** the portal shell (utility bar with member switcher, sticky nav, footer with the estimate disclaimer, floating assistant button) and real pages on the backend: Home (`/`), Plans, Family, Costs, Plan My Year, Assistant, plus the public landing page (`/welcome`), demo sign-in (`/login`), the **Scan to try** QR page (`/join`) and `/style`. Product name: Molar Money. The session (`src/state/SessionContext.tsx`) uses `POST /auth/demo-login`: **Try the demo** (landing page and login) makes the visitor's own demo family and signs in as the account holder; the family id is remembered in the browser. Name your family (Home, first run, and Family page "Rename family") calls `PUT /households/{id}/names`. Plans has "Which plan fits us?" (Monte Carlo) with "Save to Plan My Year"; Plan My Year lists saved plan comparisons. The assistant shows "Ask next" chips and up to 7 suggested questions. "Questions to ask your dentist" is a plain list.

**Notifications (sprint 2):** a bell in the top right of the app bar (`features/notifications/NotificationBell.tsx`, 44 px, unread badge, accessible name "Notifications, N unread") opens a panel with "Coming up" and "Alerts", Mark all as read, See all notifications and Notification settings. Tapping an alert marks it read and follows its link. `/notifications` (`pages/Notifications/NotificationsPage.tsx`) has filters, per-person settings (App, Email, Text message, kinds, "Send me a test") and a "Delivery preview" list with the banner "Demo only: emails and text messages are previews. Nothing is sent." Home has a Notifications card. The Family page edits profiles and adds or removes members (demo family only).

**Phones:** pages are lazy loaded (first load about 162 kB of JavaScript, gzipped), `viewport-fit=cover`, 16 px inputs, 44 px targets, a full-screen assistant panel, a web manifest and icons. `npm run dev:lan` serves the app to phones on the same Wi-Fi.

**Counts (2026-10-04, sprint branch):** 205 tests; typecheck and production build clean.

**Stand-in:** types are hand-written (not generated from `models.py`); `/style` is routed live; the landing page hard-codes the golden figures. No Playwright tests. Find Providers and Reports pages are not built.

Details: `frontend/README.md`, `docs/FRONTEND.md`.
