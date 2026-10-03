# Frontend summary
_Updated 2026-10-03 (T02)_

**Built:** portal shell (utility bar with member switcher, sticky nav, footer with the estimate disclaimer, floating assistant button hidden on `/assistant`). Six routes in `frontend/src/App.tsx`: `/`, `/plans`, `/family`, `/costs`, `/plan-year`, `/assistant`, plus `/login` (placeholder) and `/style`. Session context (`frontend/src/state/SessionContext.tsx`) gives `account`, `household`, `activeMember`, `setActiveMemberId`, `signOut`. The member switcher uses cards, not a native select. 10 tests in `frontend/src/App.test.tsx` pass.

**Stand-in:** the six pages are placeholders (`components/shell/PlaceholderPage.tsx`). The household is a mock Rivera household inside `SessionContext`. The frontend makes no calls to the backend (a code search found no `fetch` calls).

**Left over:** old prototype pages (`Chatbot`, `Coverage`, `Dashboard`, `Estimate`, `GetStarted`, `Home.tsx`, `PlanYear.tsx`, `Profiles`) and prototype libs (`mockApi.ts`, `chat.ts`, `seed.ts`, `accountApi.ts`) are still in the tree and unrouted. They are to be ported and removed by T07 to T12.

**Planned:** real pages T07 to T12, login UI (T17, Ulisses). Frontend rule: never compute dollar amounts; show values from the API.
