# Task T30: AWS deployment kit (global frontend, backend behind the same front door)

**Role:** devops
**Read first:** agents/README.md, agents/devops-agent.md, infra/README.md, docs/SETUP.md, `.env.example`, `backend/app/main.py` (CORS, routers), `backend/app/db/` (SQLite path via `BENEFITS_DB_PATH`, seed on empty), `backend/app/routers/session.py` (`SESSION_SECRET`), `backend/requirements.txt`, `frontend/src/lib/api/` (API URL comes from `VITE_API_URL`).

## Goal
Everything needed to deploy the **current `main`** to AWS with one CloudFormation stack plus a short runbook, so the user can sign in once and the orchestrator can run the commands. **Create nothing in AWS in this task** (no credentials exist on this machine); write, lint and document.

## Architecture (decided with the user: both parts global-facing, as cheap as possible)
- **CloudFront** is the single public front door (HTTPS on the free `*.cloudfront.net` name, edge locations worldwide).
  - Default behavior: a **private S3 bucket** (frontend `dist/`), via Origin Access Control. SPA fallback: 403/404 returns `/index.html` with status 200.
  - Behavior `/api/*`: the **EC2 backend** origin, caching disabled, all methods allowed, forward the `Authorization` header and query strings, no cookies, **origin read timeout 60 s**, and the response must stream (the assistant uses Server-Sent Events). Use the AWS managed policies `CachingDisabled` and `AllViewerExceptHostHeader`.
- **EC2** (one `t3.micro` or `t3.small`, Amazon Linux 2023, 8 to 16 GB gp3 volume): `nginx` listens on port 80 and proxies `/api/` to `127.0.0.1:8000/` (strips the `/api` prefix; `proxy_buffering off`, `proxy_read_timeout 120s`, `X-Accel-Buffering no`); `uvicorn app.main:app --host 127.0.0.1 --port 8000` runs as a **systemd** service (no `--reload`). SQLite file on the volume (`BENEFITS_DB_PATH=/var/lib/benefits/benefits.db`), seeded automatically when empty.
- Security group: inbound port 80 only from the **CloudFront origin-facing managed prefix list** (`com.amazonaws.global.cloudfront.origin-facing`); no SSH (use SSM Session Manager). IAM instance role: `AmazonSSMManagedInstanceCore` plus read access to the SSM parameters below.
- Same origin for browser and API (`https://<id>.cloudfront.net` and `/api/...`), so **no CORS change is needed**. Frontend is built with `VITE_API_URL=/api`.
- **Secrets:** `ANTHROPIC_API_KEY` is an SSM Parameter Store **SecureString** at `/dental/ANTHROPIC_API_KEY`. The stack must NOT create it with a value, and no script or file may contain a key. The user puts the value in with their own terminal (`aws ssm put-parameter --type SecureString ...`); document that exact command with a placeholder. `SESSION_SECRET` is generated on the instance at first boot and stored in an SSM SecureString or on the volume (document which). The service reads secrets at start (user-data or a small `ExecStartPre` script that exports them), never writes them to logs.
- Honest limits to document: single region, single server, SQLite on one disk (not multi-region or highly available); acceptable for a demo; cost estimate (about $8 to $15 a month for a `t3.micro` plus tiny S3/CloudFront charges, covered by AWS new-account credits if available); how to shut everything down (`aws cloudformation delete-stack`, empty the bucket first).

## You may edit
`infra/aws/` (new): `stack.yaml` (CloudFormation), `user-data.sh` (or inline in the template), `nginx.conf`, `dental-api.service`, `deploy-frontend.ps1` and `deploy-frontend.sh` (build with `VITE_API_URL=/api`, `aws s3 sync dist/ s3://<bucket> --delete`, CloudFront invalidation), `deploy-backend.sh` (how to update code on the instance through SSM Run Command: `git pull` of `main`, `pip install -r requirements.txt`, restart the service), `RUNBOOK.md`, and `infra/README.md` (link to the runbook), `docs/SETUP.md` (a short "Deploy on AWS" pointer). Parameters for the stack: `GitRepoUrl` (default `https://github.com/calebabr/codelinc11.git`), `GitBranch` (default `main`), `InstanceType`, `KeyAlias` not needed.

## You must not touch
`backend/app`, `frontend/src`, tests (report any needed code change instead: for example if the backend needs a health route under `/api`, say so; `/health` already exists).

## Checks
- Lint the template: `pip install cfn-lint` into a temp venv (not `backend/.venv`) and run it; fix all errors. If the AWS CLI becomes available later, `aws cloudformation validate-template`.
- `bash -n` on the shell scripts and the PowerShell parser on the `.ps1` files.
- Read the runbook as a stranger would: every command in order, every placeholder explained, how to find the CloudFront URL (stack output), how to confirm `/api/health` shows `"chat_mode":"anthropic"` after the key is set, how to roll back.
- No key or secret value anywhere (grep `sk-ant` across `infra/`).

## Report
Format in agents/README.md. List the exact commands the user runs in order, the stack outputs, estimated monthly cost with assumptions, and everything not verified (nothing was created in AWS).
