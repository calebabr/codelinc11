# Cleanup audit (2026-10-03)

Scope: root, `docs/`, `.gitignore`, top-level READMEs. No code under `frontend/src` or `backend/app` was touched.

## Done

| Finding | Action |
|---|---|
| `codeLinc11-project-ideas.md` and `path1-deep-dive.md` at the root were early planning docs | Moved to `docs/planning/` |
| Links to them in `docs/FEATURES.md`, `docs/GIT-WORKFLOW.md` | Updated. `docs/CONVENTIONS.md`, `docs/BACKEND.md` and the root README had no link to them |
| Moved `path1-deep-dive.md` had links relative to the root (`docs/FEATURES.md`...) | Rewritten to `../FEATURES.md` etc. |
| `docs/README.md` did not index `planning/`, `backend/`, `frontend/` READMEs | Added |
| `backend/` had no README | Added `backend/README.md` |
| `.gitignore` lacked `.worktrees/`, `*.tar.gz`, `*.log` | Added. Already covered: `.env`, `*.db`, `.venv`, `node_modules`, `dist`, `__pycache__`, `.pytest_cache`, `.ruff_cache`. `.env.example` stays tracked |
| Root README folder table | Points at the backend README and `docs/planning/` |
| Relative markdown link check (script over every `.md`) | 0 broken after fixes (5 were broken by the move, now fixed) |

Deleted: nothing. Empty-looking items found were only `.gitkeep` placeholders and ignored caches (`backend/.pytest_cache`, `backend/.ruff_cache`, `frontend/dist`), left alone. `database/benefits.db`, `backend/.env`, `backend/.venv` and `frontend/node_modules` untouched.

Files moved: `codeLinc11-project-ideas.md` -> `docs/planning/`, `path1-deep-dive.md` -> `docs/planning/`.

## Findings for the orchestrator

- **Secrets:** the string `sk-ant` appears only in `backend/.env`, which is git-ignored. Nowhere else. Make sure `benefits-portal.tar.gz` (untracked at the repo root of the main checkout) never gets committed; it is now ignored.
- **LICENSE:** none exists. Not added, as instructed.
- `.kiro/` (specs, steering) and `docs/pitch/` are near-empty placeholders. Kept; they are named in FEATURES.md.
- `docs/FEATURES.md` still describes the original 5-person roster and schedule; it is the old plan and is partly out of date against `docs/TASKS.md`.
- `docs/prototypes/FEATURE-DECISIONS-SHEET.md` vs the untracked `docs/FEATURE-DECISIONS.md` (main checkout) look like possible duplicates; not checked here.
- Root `README.md` says tests are 148 backend / 10 frontend; not re-verified in this pass.

## Legacy prototype files to remove later (not touched)

None of these is imported by `frontend/src/App.tsx` (it uses `pages/Home/`, `pages/PlanYear/`, etc.). They only import each other:

| File | Imported by |
|---|---|
| `pages/Chatbot.tsx`, `pages/Dashboard.tsx`, `pages/Profiles.tsx` | nothing |
| `pages/Coverage.tsx`, `pages/Estimate.tsx`, `pages/GetStarted.tsx`, `pages/Home.tsx`, `pages/PlanYear.tsx` | nothing |
| `components/ChatPanel.tsx` | `pages/Chatbot.tsx` |
| `components/ProfileSwitcher.tsx` | nothing |
| `state/UserContext.tsx` | `ChatPanel`, `ProfileSwitcher`, `Chatbot`, `Dashboard`, `Profiles` |
| `lib/mockApi.ts` | `lib/accountApi.ts`, `lib/chat.ts`, `Chatbot`, `Dashboard`, `Profiles` |
| `lib/seed.ts` | `lib/accountApi.ts`, `lib/mockApi.ts`, `state/UserContext.tsx` |
| `lib/accountApi.ts`, `lib/chat.ts`, `lib/types.ts` | each other and the files above (check `types.ts` users before deleting) |

Removing the whole cluster together should be safe; run `npm run typecheck && npm run test && npm run build` afterward.
