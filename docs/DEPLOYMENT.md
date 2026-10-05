# Deployment

The app is full stack: a **FastAPI backend** (SQLite database, AI assistant) and a **Vite single page frontend**.

## What is live
- **Backend:** AWS EC2 (set up by a teammate), a Docker container `dental-api` built from `backend/Dockerfile`, data on the volume `dental-data`. The container seeds the demo database when it is empty, applies any new database migrations on start, then serves the API. The SQLite file must sit on a persistent disk (`BENEFITS_DB_PATH`).
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

### Settings that protect the demo
The backend port can be reached directly, so a caller can forge `X-Forwarded-For`. With `TRUST_PROXY=1` the server believes `X-Nf-Client-Connection-Ip` (Netlify) or else the last `X-Forwarded-For` hop, never the first; set it only when all traffic really passes through your proxy. Three limits do not depend on any header: `DEMO_GLOBAL_LOGIN_PER_MINUTE` / `DEMO_GLOBAL_LOGIN_PER_HOUR` (`60`, `600`: new demo families across everyone), `RATE_CHAT_PER_IP_PER_MINUTE` / `RATE_CHAT_PER_IP_PER_DAY` (`20`, `300`: assistant messages per address, also counted on the socket address; behind a proxy that shared socket bucket is allowed 10 times as much) and `RATE_PROBE_PER_MINUTE` (`10`: unknown or expired family ids one address may try a minute). New family ids are 16 hex characters and cannot be guessed. `ATTACHMENT_TTL_MINUTES` (`30`) is how long an uploaded chat document is kept in memory (at most 3 per family, 50 in total). The database uses WAL mode with a 5 s busy timeout (`benefits.db-wal` and `-shm` files appear next to it; keep them together when copying the database). Expired families are deleted at start-up and at most every 10 minutes on a family lookup.

## Frontend settings (Netlify, build time)
| Variable | Value |
|---|---|
| `VITE_API_URL` | `/api`. Netlify forwards `/api/*` to the AWS backend (`netlify.toml`; the target is the hostname `3-149-89-171.sslip.io` on port 8000, which points at the server's Elastic IP; Netlify gives up on a forwarded request after about 26 seconds), so the browser only talks HTTPS to the Netlify site. Needs `TRUST_PROXY=1` on the backend and port 8000 open in its security group |

Changing it needs a redeploy, because Vite bakes it into the build. The old `VITE_CLERK_PUBLISHABLE_KEY` setting is no longer used and can be deleted.

## How the live backend is updated
The live backend runs as the Docker container `dental-api` on an AWS EC2 server. The SQLite file lives on the Docker volume `dental-data` (mounted at `/data`). Settings come from an env file on the server (never in the repo). The frontend needs no manual step: Netlify rebuilds when `main` changes.

### Manual update (what a person does)
Run these on the server, from the folder that holds the repo clone. Details such as the folder name and the env file path are not in this repo (not verified); use the ones on your server.
```
git pull origin main
docker build -f backend/Dockerfile -t dental-api .
docker stop dental-api && docker rm dental-api
docker run -d --name dental-api --restart unless-stopped \
  -p 8000:8000 -v dental-data:/data --env-file <path to your env file> dental-api
curl http://localhost:8000/health
```
The Dockerfile builds from the repo root (it copies `backend/` and `database/`). Back up the volume first (below) when the release adds a migration.

### Optional auto-update timer
A teammate's branch `infra/ec2-auto-update` adds a timer on the server that does the same pull, build and swap on a schedule. It was **not on `main` and not read for this page**, so how it works and whether it is switched on is not verified. Ask the teammate before relying on it. If it is on, a merge to `main` reaches the backend without a manual step; if you need to hold a release back, stop the timer first.

### What a restart does to the database
- On start the container runs `python -m app.db`, then the API. The API start applies any **new migration files** in `database/migrations/` (nine today, `001` to `009`). Each is recorded in `schema_migrations` and runs once.
- A restart **does not reseed**. Seed data loads only when the database is empty, so existing demo families and saved data stay.
- To reseed on purpose, use `python -m app.db --reset` inside the container. That erases the data, so back up first.
- Rolling back the code does not undo a migration. Restore the backup if you need to go back.

### Backup of the data volume
Copy the volume to a dated file on the server:
```
docker run --rm -v dental-data:/data -v "$PWD":/backup alpine \
  tar czf /backup/dental-data-$(date +%F).tgz -C /data .
```
Copy that file off the server too. To restore, stop the container and untar the file into the volume.

## After every release (checklist)
1. The container is running (`docker ps`) and `GET /health` answers with `"chat_mode":"anthropic"`.
2. Open the Netlify address, tap **Try the demo**, and land on Home as **Abraham Lincoln** in a new family.
3. **Reports** shows $90 owed for Abraham; **Find Providers** with ZIP 36830 lists dentists.
4. Ask the assistant "What will a crown cost me?" and wait for the full answer (Netlify cuts forwarded requests at about 26 seconds). Open **Plans**, scroll to "Which plan fits us?" and expect shares that add to 100.
5. On a phone (cellular, not the office Wi-Fi), open `/join` and scan the code.
6. Check `docker logs dental-api` for errors, and watch the daily chat cap and the Anthropic usage page for the first day.

## Alternatives that are configured but not used
- **Render** (backend): [`render.yaml`](../render.yaml) with a persistent disk.
- **Vercel** (frontend): [`frontend/vercel.json`](../frontend/vercel.json).
- **AWS kit** (CloudFront, S3, one EC2 server): [`infra/aws/RUNBOOK.md`](../infra/aws/RUNBOOK.md), a reference that has not been run.

Creating cloud resources costs money and needs the product owner's approval. Using the Anthropic provider sends chat content to a third party, so keep demo data synthetic.
