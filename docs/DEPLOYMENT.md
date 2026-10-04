# Deployment

The app is full stack: a **FastAPI backend** (SQLite database, AI assistant) and a **Vite single page frontend**.

## What is live
- **Backend:** AWS (set up by a teammate), built from `backend/Dockerfile`. The container seeds the demo database when it is empty, applies any new database migrations on start, then serves the API. The SQLite file must sit on a persistent disk (`BENEFITS_DB_PATH`).
- **Frontend:** Netlify, from `netlify.toml` at the repo root (build in `frontend/`, single page app routing, security headers). Netlify rebuilds when `main` changes.
- **Sign-in:** none. Visitors tap **Try the demo** and get their own demo family. There is no Clerk or other account service.
- **`main` is production.** A change merged to `main` goes live (the frontend automatically, the backend when it is redeployed). Merge only through a reviewed pull request with the tests green.

## Backend settings (environment variables)
| Variable | Value | Notes |
|---|---|---|
| `ASSISTANT_PROVIDER` | `anthropic` (or `none`) | `none` keeps everything except the assistant's answers |
| `ANTHROPIC_API_KEY` | your key | **Secret.** Set it in the host's secret store, never in the repo or an image |
| `CORS_ORIGINS` | the Netlify address, comma separated | Replaces the localhost defaults, so include them if you still need them |
| `CORS_ORIGIN_REGEX` | for example `https://deploy-preview-.*--<site>\.netlify\.app` | Optional: allows Netlify preview deploys and tunnel addresses |
| `TRUST_PROXY` | `1` | **Required behind a load balancer, CloudFront or any proxy.** Without it every visitor looks like one address and the sign-in limit (10 new demo families a minute per address) is shared by the whole room |
| `SESSION_SECRET` | a long random string | **Secret.** Keep it stable so sign-ins survive restarts. If unset, one is generated into `database/.session_secret` on the persistent disk |
| `SESSION_TTL_HOURS` | `12` | Token lifetime |
| `BENEFITS_DB_PATH` | `/data/benefits.db` | On a persistent disk |
| `CHAT_GLOBAL_DAILY_CAP` | `3000` | Protects the Anthropic key: the most assistant messages per day across everyone. Set it to what you are willing to pay |
| `RATE_CHAT_PER_MINUTE`, `RATE_CHAT_PER_DAY`, `RATE_LOGIN_PER_MINUTE`, `RATE_LOGIN_PER_HOUR`, `RATE_COMPUTE_PER_MINUTE`, `RATE_ATTACH_PER_MINUTE`, `RATE_RESET_PER_MINUTE` | defaults 12, 200, 10, 60, 60, 5, 5 | Per demo family (login: per address). `0` means unlimited. In memory, so they reset when the server restarts. `RATE_LIMIT_ENABLED=0` turns them off |
| `DEMO_SANDBOX_TTL_HOURS`, `DEMO_MAX_SANDBOXES` | `24`, `300` | How long a visitor's demo family lives and the most kept at once (oldest removed first) |

The full list with defaults is in [`.env.example`](../.env.example).

## Frontend settings (Netlify, build time)
| Variable | Value |
|---|---|
| `VITE_API_URL` | the backend's **HTTPS** address (an HTTPS page cannot call an HTTP backend) |

Changing it needs a redeploy, because Vite bakes it into the build. The old `VITE_CLERK_PUBLISHABLE_KEY` setting is no longer used and can be deleted.

## After every release (checklist)
1. The backend container starts and `GET /health` answers with `"chat_mode":"anthropic"`.
2. Open the Netlify address, tap **Try the demo**, and land on Home as the account holder in a new family ("Welcome back, ...").
3. Ask the assistant "What will a crown cost me?" and expect $800 for Alex-type usage; open **Plans**, scroll to "Which plan fits us?" and expect shares that add to 100.
4. On a phone (cellular, not the office Wi-Fi), open `/join` and scan the code.
5. Watch the daily chat cap and the Anthropic usage page for the first day.

**Database upgrades** run automatically on start (new tables and the profile columns). Take a copy of `benefits.db` before the first release that includes migrations 003 to 006 so there is a way back. Rolling back the code does not undo a migration; restore the copy if needed.

## Alternatives that are configured but not used
- **Render** (backend): [`render.yaml`](../render.yaml) with a persistent disk.
- **Vercel** (frontend): [`frontend/vercel.json`](../frontend/vercel.json).
- **AWS kit** (CloudFront, S3, one EC2 server): [`infra/aws/RUNBOOK.md`](../infra/aws/RUNBOOK.md), a reference that has not been run.

Creating cloud resources costs money and needs the product owner's approval. Using the Anthropic provider sends chat content to a third party, so keep demo data synthetic.
