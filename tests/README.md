# tests/

Cross-cutting tests: the checks that look at the whole product, not one file. The Tests agent (`agents/tests-agent.md`) owns this folder.

```
tests/
├── e2e/        real user flows in a browser against the running app
├── contract/   frontend API expectations match what the backend returns
├── fixtures/   shared synthetic members, plans and quotes
└── README.md
```

## Where every kind of test lives

| Kind | Location | Written by |
|---|---|---|
| Backend unit tests (engine, API, chat) | `backend/tests/` | The agent that writes the backend code |
| Frontend unit and component tests | next to the code, `frontend/src/**/*.test.ts(x)` | The Frontend agent |
| End-to-end flows | `tests/e2e/` | Tests agent |
| API contract checks | `tests/contract/` | Tests agent |
| Golden numbers | engine tests plus `tests/fixtures/` | Engine tests hold them; the Tests agent adds regression checks |

## The golden numbers
The correct answers for the demo plan are in `docs/FEATURES.md` section 2 (cleaning $0, crown fresh year $625, crown late in the year $800, out-of-network crown $925 with $300 balance billing, plan-year scenario $2,300 to $1,405 saving $895). Tests check these exactly. **No one changes an expected value to make code pass.**

## Rules
- Tests must not need Ollama, a paid API or the internet. Chat is tested with a scripted fake model and the "model unavailable" path.
- Tests are repeatable: fixed seeds and no reliance on today's date unless it's passed in.
- Check exact numbers and unhappy paths (server down, empty input, unknown ids, quotes with junk lines, one family member's data never showing up for another).

## Commands (fill in as suites are added)
- Backend: `cd backend && pytest -q`
- Frontend: `cd frontend && npm run test`
- End-to-end: documented here when the suite exists
