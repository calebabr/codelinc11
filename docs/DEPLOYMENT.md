# Deployment

The app is full-stack: a **FastAPI backend** (SQLite + AI assistant) and a **Vite
SPA frontend**. Recommended hosts: **Render** (backend) + **Vercel** (frontend).
Both have free tiers and deploy straight from this GitHub repo.

> This repo contains the deploy **config** only. Creating the services (which may
> cost money) is done by you in each provider's dashboard. Per `infra/README.md`,
> cloud resources need explicit approval, and using the Anthropic provider sends
> chat content to a third party.

## 1. Backend → Render

Files: [`render.yaml`](../render.yaml) (blueprint) and [`backend/Dockerfile`](../backend/Dockerfile).

1. In Render: **New → Blueprint**, point it at this repo. Render reads `render.yaml`
   and creates a Docker web service `dental-benefits-api` with a 1 GB persistent
   disk mounted at `/data` (so the SQLite demo DB survives restarts).
2. Fill in the env vars Render marks as required:
   - `ANTHROPIC_API_KEY` — your Anthropic key (only if `ASSISTANT_PROVIDER=anthropic`).
     To ship without the AI assistant, set `ASSISTANT_PROVIDER=none` and skip the key.
   - `CORS_ORIGINS` — your frontend URL, e.g. `https://your-app.vercel.app`
     (add the custom domain too if you have one). Comma-separated for multiple.
   - `SESSION_SECRET` is auto-generated; `BENEFITS_DB_PATH` and `SESSION_TTL_HOURS`
     are preset.
3. Deploy. The container runs `python -m app.db` (seeds the demo DB if missing)
   then `uvicorn`. Health check: `GET /health`. API docs: `/docs`.
4. Note the service URL, e.g. `https://dental-benefits-api.onrender.com`.

## 2. Frontend → Vercel

File: [`frontend/vercel.json`](../frontend/vercel.json) (Netlify alternative:
[`frontend/netlify.toml`](../frontend/netlify.toml)).

1. In Vercel: **New Project → import this repo**. Set **Root Directory = `frontend`**.
   Vercel detects Vite; `vercel.json` sets the build + SPA rewrites.
2. Add environment variables (Project → Settings → Environment Variables):
   - `VITE_API_URL` = the Render backend URL from step 1.4.
   - `VITE_CLERK_PUBLISHABLE_KEY` = your Clerk publishable key (`pk_test_…` for a
     dev instance, or a `pk_live_…` from a Clerk **production** instance).
3. Deploy. Note the Vercel URL.

## 3. Wire the two together

1. Put the **Vercel URL** into the backend's `CORS_ORIGINS` on Render and redeploy
   (otherwise the browser blocks API calls).
2. In your **Clerk dashboard**, add the Vercel URL to the allowed origins /
   redirect URLs so sign-in works from the deployed site.
3. Open the Vercel URL → `/` is the landing page, sign in → `/app` is the product.

## Environment variables (summary)

| Where | Variable | Value | Secret |
|---|---|---|---|
| Render (backend) | `ASSISTANT_PROVIDER` | `anthropic` or `none` | No |
| Render | `ANTHROPIC_API_KEY` | your key (if anthropic) | **Yes** |
| Render | `CORS_ORIGINS` | the Vercel URL(s) | No |
| Render | `BENEFITS_DB_PATH` | `/data/benefits.db` (preset) | No |
| Render | `SESSION_SECRET` | auto-generated | **Yes** |
| Vercel (frontend) | `VITE_API_URL` | the Render URL | No |
| Vercel | `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key | No (publishable) |

## 4. Auto-deploy on push to `main` (optional)

[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) redeploys both
hosts automatically — but **only after the CI workflow passes on `main`**, so a
broken build never ships. It triggers each host with a **deploy-hook URL** stored
as a GitHub repository secret (the URLs themselves never go in the repo).

Set these up once:

1. **Render deploy hook:** Render service → **Settings → Deploy Hook** → copy the URL.
2. **Vercel deploy hook:** Vercel project → **Settings → Git → Deploy Hooks** →
   create one for the `main` branch → copy the URL.
3. In GitHub: repo **Settings → Secrets and variables → Actions → New repository
   secret**, add:
   - `RENDER_DEPLOY_HOOK_URL`
   - `VERCEL_DEPLOY_HOOK_URL`

That's it — every push to `main` now runs CI, and on success triggers both deploys.
If a secret is missing, that host is simply skipped (the workflow stays harmless
until you add the hooks). Both Render and Vercel also offer their own built-in
auto-deploy-on-push; this workflow is the CI-gated alternative if you'd rather a
green build be a hard requirement before shipping.

> **Never** paste a deploy-hook URL, API token, or secret key into a file, a commit,
> or chat. They go only in the host dashboard or as a GitHub Actions secret.

## Notes

- **AI assistant in prod:** Ollama (local model) won't run on a small host — use
  Anthropic, or `ASSISTANT_PROVIDER=none` (the app works; the assistant says it's
  unavailable). Anthropic sends chat content to a third party — confirm that's an
  accepted decision before enabling it.
- **Data:** the demo SQLite DB is seeded automatically and persists on the Render
  disk. It is demo data, not real PHI.
- **Alternative hosts:** any Docker host (Railway, Fly.io) can run `backend/Dockerfile`;
  any static host (Netlify, Cloudflare Pages) can serve the frontend with the SPA
  rewrite from `netlify.toml`.
