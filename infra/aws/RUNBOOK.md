# Runbook: deploy to AWS

One CloudFormation stack puts the app on the internet:

- **CloudFront** is the only public address (`https://<something>.cloudfront.net`, HTTPS, edge locations worldwide).
- Pages come from a **private S3 bucket**. Anything under `/api/` goes to **one EC2 server** (nginx, then the FastAPI backend, with the SQLite demo database on its disk).
- The browser and the API share one address, so no CORS change is needed.

Nothing here has been run yet. Everything below is the plan, in order.

## What you need first
- An AWS account and the **AWS CLI v2** signed in (`aws configure sso` or `aws configure`). Check with `aws sts get-caller-identity`.
- Node 20+ and npm (to build the frontend). Git Bash, Mac or Linux for the `.sh` scripts, or PowerShell for the `.ps1` one.
- The repository on GitHub must be **public** (the server clones it without a password). If it is private, tell the orchestrator; the template needs a change.
- Pick one region and use it for every command. Examples use `us-east-1`; replace `REGION` below.

## Steps

**1. Pick the region (once per terminal).**
```
export AWS_REGION=us-east-1          # PowerShell: $env:AWS_REGION = "us-east-1"
```

**2. Put the Anthropic key in Parameter Store.** Do this in your own terminal, not in chat. Replace `PASTE_YOUR_KEY_HERE` with your key. The stack never contains the key.
```
aws ssm put-parameter --name /dental/ANTHROPIC_API_KEY --type SecureString --value "PASTE_YOUR_KEY_HERE"
```
If you skip this step the app still works; the assistant says it is unavailable. You can do it later (step 7).
Note: the chat assistant sends chat text to Anthropic (a third party). Decision F5 in `docs/decisions/` controls what may be sent.

**3. Find the CloudFront prefix list id** (it differs by region):
```
aws ec2 describe-managed-prefix-lists --filters Name=prefix-list-name,Values=com.amazonaws.global.cloudfront.origin-facing --query "PrefixLists[0].PrefixListId" --output text
```
It prints something like `pl-3b927c52`. That is `PREFIX_LIST_ID` below.

**4. Create the stack** (takes about 5 to 10 minutes; CloudFront is the slow part):
```
aws cloudformation deploy --stack-name dental --template-file infra/aws/stack.yaml --capabilities CAPABILITY_IAM --parameter-overrides CloudFrontPrefixListId=PREFIX_LIST_ID
```
Optional overrides on the same line: `GitBranch=main`, `GitRepoUrl=...`, `InstanceType=t3.small`, `VolumeSizeGiB=16`.

**5. Read the outputs:**
```
aws cloudformation describe-stacks --stack-name dental --query "Stacks[0].Outputs" --output table
```
| Output | Meaning |
|---|---|
| `SiteUrl` | The public address of the app |
| `BucketName` | S3 bucket for the frontend (`BUCKET` below) |
| `DistributionId` | CloudFront id (`DIST` below) |
| `InstanceId` | The server (`INSTANCE_ID` below) |
| `ApiParameterName` | Where the key lives: `/dental/ANTHROPIC_API_KEY` |

**6. Publish the frontend** (builds with `VITE_API_URL=/api`, uploads, clears the CloudFront cache):
```
infra/aws/deploy-frontend.sh BUCKET DIST
```
PowerShell: `infra\aws\deploy-frontend.ps1 -Bucket BUCKET -DistributionId DIST`

**7. If you stored the key after the server first started, restart the API so it reads the key:**
```
aws ssm send-command --instance-ids INSTANCE_ID --document-name AWS-RunShellScript --parameters commands="systemctl restart dental-api"
```

**8. Check it.** Open `SiteUrl` in a browser, then:
```
curl https://<SiteUrl host>/api/health
```
Expected: `{"ok":true,...,"chat_mode":"anthropic"}`. If `chat_mode` is `unavailable`, the key is missing or wrong (step 2, then step 7). The server needs 2 to 4 minutes after the stack finishes to install everything; a `502` right after step 4 means "wait and retry".

## Update later
- New frontend: step 6 again.
- New backend code (after merging to the deployed branch): `infra/aws/deploy-backend.sh INSTANCE_ID` (pulls the branch through SSM, installs requirements, restarts, prints `/health`).

## Look inside the server (no SSH)
```
aws ssm start-session --target INSTANCE_ID        # needs the Session Manager plugin
sudo journalctl -u dental-api -n 100 --no-pager
sudo systemctl status dental-api nginx
sudo tail -n 50 /var/log/cloud-init-output.log     # first-boot install log
```

## Secrets: where they live
- `ANTHROPIC_API_KEY`: SSM Parameter Store SecureString `/dental/ANTHROPIC_API_KEY`. The service start-up step reads it into `/run/dental/secrets.env` (memory-backed, mode 600, readable by the service user only) and the process gets it as an environment variable. It is never written to logs or the repo.
- `SESSION_SECRET`: generated once on first boot into `/etc/dental/session_secret` (root-only file on the encrypted volume), loaded the same way. Changing servers signs everyone out; that is fine for a demo.

## Roll back
- Frontend: check out the earlier commit and run step 6.
- Backend: `git revert` on the branch, then `deploy-backend.sh`; or in a session, `cd /opt/dental && git reset --hard <good-commit>` and restart `dental-api`.
- Whole stack broken: delete it (below) and redo steps 4 to 6. Demo data is rebuilt automatically.

## Tear down (stops all charges)
```
aws s3 rm s3://BUCKET --recursive
aws cloudformation delete-stack --stack-name dental
aws cloudformation wait stack-delete-complete --stack-name dental
aws ssm delete-parameter --name /dental/ANTHROPIC_API_KEY
```
The bucket must be empty or the delete fails. The parameter is not part of the stack, so remove it yourself.

## Cost (rough, us-east-1, 24/7)
| Item | About per month |
|---|---|
| `t3.micro` instance | $7.60 (`t3.small`: $15.20) |
| 8 GB gp3 volume | $0.64 |
| Public IPv4 address | $3.65 |
| S3, CloudFront, SSM parameter | under $1 at demo traffic (CloudFront has a free allowance of 1 TB out) |
| **Total** | **about $12 to $20** |
Assumes demo traffic only and no data-transfer spikes. New-account AWS credits, if you have them, cover this. The Anthropic key is billed separately by Anthropic.

## Honest limits
- **One region, one server, one disk.** SQLite lives on that disk, so there is no failover and no multi-region copy. If the server dies, the demo data is rebuilt from the seed, and any changes are lost. Fine for a demo, not for real members.
- Only CloudFront (global) is spread worldwide; the API itself runs in one place, so distant users see higher latency on API calls.
- The security group admits CloudFront servers in general, not only this distribution, so someone who learns the server's DNS name could reach it through their own CloudFront. A shared secret header would close that; not done yet.
- Traffic from CloudFront to the server is plain HTTP inside AWS. Viewers always get HTTPS.
- CloudFront waits up to 60 seconds for the server to answer; long assistant answers stream, so this is normally fine.
- The managed prefix list uses about 55 of the 60 default rules per security group. Do not add other rules without raising the quota.
- Do not put real member data in this deployment; it is a synthetic-data demo.

## Not verified yet
Nothing was created in AWS. The template passed `cfn-lint`; the scripts passed syntax checks. The first real deploy may need small fixes (for example the first-boot install time or package names on Amazon Linux 2023).
