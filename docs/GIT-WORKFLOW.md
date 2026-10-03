# GIT-WORKFLOW.md: One Repo, Five People, Three Claude Codes

You don't need to be good at Git for this. The plan below is built so that **conflicts almost never happen**, and when they do, there's a short recipe. Your agents can run all the Git commands. Your job is to give them the right prompt and to know what "good" looks like.

---

## 1. The idea in one minute

```
main  ●────●────────●─────────●────────●──────────●   (always works, always demoable)
       \   /  \     /  \      /  \     /
 fe/estimate   api/estimate   ai/chat  engine/sequencer     (short-lived branches, one task each)
```

- **`main`** is the shared, working version. It should always run and be demoable. Nobody works directly on it.
- **A branch** is your own copy to work on without breaking anyone. One task = one branch = one pull request.
- **A pull request (PR)** is a request to add your branch to `main`. GitHub checks it automatically (CI), someone looks at it, and it gets merged.
- **Small and often wins.** Aim for a merge **every 60–90 minutes**. A branch that lives for 6 hours is where conflicts come from.

**Three rules that remove most of the pain:**
1. **Everyone edits only their own folders** (FEATURES.md §1). Two people rarely touch the same file, so Git has nothing to conflict on.
2. **Everyone starts every task from the latest `main`, and pulls `main` into their branch before opening a PR.**
3. **Nobody force-pushes, ever.** (And nobody commits straight to `main`.)

---

## 2. Glossary (all you need)

| Word | Meaning |
|---|---|
| **repo** | The project folder tracked by Git, hosted on GitHub |
| **clone** | Download the repo to your laptop (once) |
| **commit** | A saved snapshot with a message. Commit often; it's your undo button |
| **branch** | Your own line of commits, separate from `main` |
| **push** | Upload your commits to GitHub |
| **pull** | Download new commits from GitHub |
| **PR** | A request to merge your branch into `main` |
| **merge** | Combine one branch into another |
| **conflict** | Two people changed the same lines; Git asks a human to choose |

---

## 3. Setup (BE and FLEX, first 30–40 minutes)

BE does this with their Claude Code agent; FLEX checks it. Everyone else waits for the "repo is ready" message, then clones.

**Step 1: Create the repo and add everyone.** On GitHub: new repo (private is fine), then Settings → Collaborators → add all five people with **Write** access. Everyone installs the GitHub CLI and logs in once:

```bash
gh auth login
```

**Step 2: Make the first commit directly on `main`** (the one time this is allowed). BE's agent creates the skeleton from the docs:
- the folder structure from `docs/planning/path1-deep-dive.md` §2 (`backend/`, `frontend/`, `docs/`) with empty placeholder files,
- the `docs/` files from this project,
- `CLAUDE.md` (root), `backend/CLAUDE.md`, `frontend/CLAUDE.md`,
- a `.gitignore` (below), a `.env.example`, and the PR template (below),
- a first CI workflow (§10).

**`.gitignore` must include** (so secrets and junk never get committed):

```
.env
.env.*
!.env.example
node_modules/
.venv/
__pycache__/
*.pyc
frontend/dist/
.claude/settings.local.json
.DS_Store
*.sqlite
chroma/
```

**Step 3: Protect `main`.** GitHub → Settings → Branches (or Rulesets) → add a rule for `main`:
- Require a pull request before merging
- Require status checks to pass (select the CI check once it exists)
- Block force pushes and deletions
- Do **not** require approvals (it would slow a 5-person team; humans check before merging instead)

> Branch protection on **private** repos needs a paid GitHub plan. If it's unavailable, make the repo public for the weekend or just follow rule 3 as a team agreement.

**Step 4 (optional but useful): `CODEOWNERS`.** This makes GitHub automatically request the right person on a PR, and it makes M the required reviewer for golden test changes. Create `.github/CODEOWNERS` with the team's GitHub usernames:

```
/backend/app/engine/            @M-username
/backend/tests/test_engine*.py  @M-username
/backend/data/                  @M-username
/backend/app/models.py          @BE-username
/backend/app/main.py            @BE-username
/.github/                       @BE-username
/backend/app/agent/             @FLEX-username
/backend/app/rag/               @FLEX-username
/frontend/                      @FE-username
/docs/design/                   @DES-username
```

**Step 5: Everyone clones** and installs their tools:

```bash
git clone https://github.com/<org-or-user>/codelinc11.git
```

**PR template** (`.github/pull_request_template.md`): so every PR says what to check.

```markdown
## What changed
<!-- one or two sentences -->

## Feature / task
<!-- e.g. F2 Estimate page -->

## Tests run (paste results)
<!-- pytest -q / npm run typecheck && npm run build && npm run test -->

## What a human should check
<!-- e.g. open /estimate, type "cap on my back tooth", you pay should be $800 -->

## Only my folders changed?
- [ ] Yes (checked with `git diff --stat origin/main`)
```

---

## 4. Who works where (why conflicts are rare)

| Person | Their one working copy | Branch prefix | Folders (see FEATURES.md §1) |
|---|---|---|---|
| **M** (Kiro) | M's laptop | `engine/…` | `backend/app/engine/`, `backend/tests/test_engine*.py`, `backend/data/`, `docs/MATH.md`, `.kiro/` |
| **BE** (Claude Code #1) | BE's laptop | `api/…` | `backend/app/main.py`, `models.py`, `extract.py`, `backend/fixtures/`, `.github/`, root config |
| **FLEX** (Claude Code #2) | FLEX's laptop | `ai/…` | `backend/app/agent/`, `backend/app/rag/`, agent tests, `docs/AI.md` |
| **FE** (Claude Code #3) | FE's laptop | `fe/…` | `frontend/`, `docs/FRONTEND.md` |
| **DES** (Figma, Bob) | DES's laptop or the GitHub website | `des/…` | `docs/design/`, `docs/pitch/`, `README.md` |

**Each laptop has its own clone, so each person is on their own branch.** No special setup is needed for three Claude Code seats: they never share a folder.

### Hotspots: the few files two people might both want to change

| File | Why it's risky | Rule |
|---|---|---|
| `backend/app/models.py` (the API contract) | Everyone depends on it | **Only BE's agent edits it.** Others ask BE in `#contract`. After the PR merges, FE runs `npm run gen:api`. |
| `backend/requirements.txt` | Several people add packages | **Whoever needs a package makes a tiny PR that only adds that line, and merges it right away.** Everyone then pulls `main`. No other changes in that PR. |
| `frontend/package.json` + lockfile | Merge conflicts in lockfiles are painful | **Only FE's agent changes them.** If a conflict happens in the lockfile, delete it and run `npm install` again. |
| `frontend/src/lib/api-types.ts` | Generated | **Never edit by hand.** Only FE regenerates it. |
| `docs/FEATURES.md` §2 (golden numbers) | Everything is tested against it | Only M changes it. |
| `docs/FEATURES.md`, `BACKEND.md`, `FRONTEND.md`, `CONVENTIONS.md` | Shared plans | Change only after agreement at a stand-up. Use a tiny docs-only PR. |
| `.env` | Contains secrets | **Never committed.** Share keys privately, not in Git or chat. |

---

## 5. The loop every task follows

Everyone does these steps. **Claude Code can run all of them; you just give the prompts in §6.**

```bash
# 1. Start from the latest main
git switch main
git pull

# 2. New branch for this one task
git switch -c fe/estimate-page

# 3. Work. Commit after each working step (the agent does this)
git add -A
git commit -m "Add BreakdownCard component"

# 4. Before opening the PR, bring the newest main into your branch
git fetch origin
git merge origin/main
#    run the tests again here

# 5. Check that only your folders changed
git diff --stat origin/main

# 6. Push and open the PR
git push -u origin fe/estimate-page
gh pr create --fill

# 7. After the PR is merged: clean up and start the next task from step 1
git switch main
git pull
git branch -d fe/estimate-page
```

**Why `merge`, not `rebase`:** merging `main` into your branch is the safer choice for beginners, because it never rewrites history. Don't use `rebase`.

**Why check `git diff --stat origin/main` (step 5):** it lists every file you changed. If you see a file in someone else's folder, stop. Either undo that change or ask its owner.

**Branch names:** `<prefix>/<short-task>`, for example `fe/estimate-page`, `api/estimate-endpoint`, `engine/sequencer`, `ai/find-procedure`, `des/style-tile`.

**One task per branch.** Finish and merge it before starting the next. Don't keep a branch open for hours "while you add more".

---

## 6. Prompts to give your Claude Code agent

Copy and paste these. They tell the agent exactly how to use Git.

**Start a task**
> Switch to `main`, pull the latest, and create a new branch called `fe/estimate-page`. Then read `docs/FEATURES.md` feature F2 and plan the work before changing anything.

**Save progress** (every 20–30 minutes, or after each working step)
> Run the tests. If they pass, stage only files inside `frontend/`, commit with a clear message, and show me `git status`.

**Open a PR**
> Fetch and merge `origin/main` into this branch. If there are conflicts, stop and tell me which files. Otherwise run the tests, run `git diff --stat origin/main` and confirm that only files in my folders changed, push the branch, and open a PR with `gh pr create`. Fill in the PR template: what changed, tests run, and what a human should check.

**Pull in the latest main** (when someone merged something you need, for example a new API shape)
> Commit what I have so far. Then fetch and merge `origin/main` into this branch and tell me what came in. If there are conflicts, stop and show me.

**Resolve a conflict** (see §9 first)
> There's a merge conflict. List the conflicted files. For each one, explain what each side changed. Don't choose yet. If the file belongs to someone else's folder, stop and tell me.

**After the merge**
> Switch to `main`, pull, delete the merged branch locally, and tell me the new state.

**Safety prompt to put in every `CLAUDE.md`** (add this to the "Hard rules" section):
> Git rules: never commit to `main`; never force-push; never run `git reset --hard`, `git clean -fd` or `git checkout -- .` without asking me first; never use `git add` on files outside my folders; never commit `.env` or any file containing a key. If a Git command fails or something looks odd, stop and ask me.

---

## 7. Merging pull requests

**Who merges:**
- **A PR that touches only the author's own folders, has green CI, and that the author has checked in the browser/tests:** the **author merges it** (click "Squash and merge"). This avoids a bottleneck.
- **A PR that touches `models.py`, `requirements.txt`, `package.json`, `.github/`, shared docs, or anything outside the author's folders:** **BE merges it** (backup: FLEX), after a quick look.
- **A PR that changes a golden number or `test_engine*.py`:** **M must approve** (CODEOWNERS will ask automatically if enabled).

**Always use "Squash and merge"** on GitHub. It turns your branch's many small commits into one clean commit on `main`, which keeps history readable and makes problems easy to undo.

**Before merging, a human checks:**
1. CI is green.
2. The PR description says what to check, and you checked it (open the page, send the request, compare the number with FEATURES.md §2).
3. `git diff --stat` / "Files changed" shows only expected files.

**Merge windows:** Everyone **merges what's finished 10 minutes before each checkpoint** (6:30 PM, 10:00 PM, 2:00 AM, 5:00 AM). Don't merge half-working work right before a checkpoint. At the checkpoint everyone pulls `main` and clicks through together.

**Merge order when several PRs are ready:** contract (`models.py`) → engine → agent → API wiring → frontend → docs. That way the things others depend on land first.

**Merged something that broke `main`?** Don't debug under pressure. On the PR page click **Revert**, merge the revert PR, and fix on your branch.

---

## 8. Keeping the three Claude Codes (and their sub-agents) from stepping on each other

- **One seat = one laptop = one clone = one branch at a time.** The three Claude Code seats never share a working folder.
- **Sub-agents inside one seat share that seat's working folder.** So when an orchestrator runs two sub-agents at once, give each a **separate list of files**, and make sure those files don't overlap. If you can't separate them, run them one after the other.
- **Real parallel work in one seat** (for example, FE wants to build the Estimate page *and* fix a bug at the same time): use a **git worktree**, which is a second folder for a second branch:

  ```bash
  git worktree add ../codelinc11-fe-bugfix -b fe/fix-timeline-overlap origin/main
  ```

  Open a second Claude Code session in that new folder. When finished: `git worktree remove ../codelinc11-fe-bugfix`. Only do this if you need it; most people never will.
- **Kiro and Bob follow the same rules.** M's Kiro commits on `engine/…` branches. If Bob creates files, it commits on a `des/…` branch.
- **DES and Git:** DES may prefer not to use the command line. Two easy options: (1) drag-and-drop PNG exports onto the GitHub website (it creates a branch and a PR for you), or (2) ask Bob or any Claude Code seat to commit them.

---

## 9. When there's a conflict

A conflict looks scary but is just Git asking "which version do you want?" Take it step by step.

1. **Don't panic and don't delete anything.** Nothing is lost.
2. Ask your agent to list the conflicted files and explain both sides (prompt in §6). Don't let it choose yet.
3. **Whose file is it?**
   - **In your own folder:** your agent can resolve it. Tell it: "Keep the intent of both sides, then run the tests."
   - **In someone else's folder, or a shared file:** stop. Ask the owner to resolve it in a call or in Discord. If you edited a file you shouldn't have, the usual fix is to **take their version of that file** and drop your change.
   - **`package-lock.json`:** delete it and run `npm install`.
   - **`api-types.ts`:** take either version, then run `npm run gen:api`.
4. Run the tests. Commit the resolution. Continue.

**If it's a mess:** abort the merge with `git merge --abort` (you're back where you were) and ask the merge captain (BE) or FLEX for help. Another option: copy the files you changed somewhere safe, make a fresh branch from `main`, and copy them back.

---

## 10. CI (the automatic check on every PR)

BE's agent creates one GitHub Actions workflow (`.github/workflows/ci.yml`) that runs on every PR and every push to `main`:

| Job | Runs |
|---|---|
| **backend** | `pip install -r requirements.txt` → `ruff check .` → `pytest -q` |
| **frontend** | `npm ci` → `npm run typecheck` → `npm run build` → `npm run test` |

The Playwright end-to-end tests need the backend running, so they run on laptops before each checkpoint, not in CI. If CI is red, the PR isn't merged. If CI is broken for a reason unrelated to the change, tell BE.

---

## 11. Freeze, deploy and backup (5:00–7:00 AM)

- **At 5:00 AM** stop starting new features. Merge everything finished.
- **At 7:00 AM: code freeze.** From now on only **bug-fix PRs** go in, and **BE (or FLEX) merges them**, one at a time, after checking in the browser.
- **Tag the working versions** so you can always go back:

  ```bash
  git tag demo-ready-1 && git push origin demo-ready-1
  ```

  Tag at 10 PM, 2 AM and 7 AM as soon as the checkpoint click-through passes. If something goes wrong later, `git switch --detach demo-ready-1` gets you back to a known-good version.
- **Deploy from `main`.** Keep a local copy of the last tagged version running as a backup for the demo.

---

## 12. Overnight: handoffs and sleep shifts

- **Never leave a PR half-done.** Before sleeping, either merge it or leave a one-line note in the PR and in `TASKS.md`: "Branch `ai/chat-loop`, tests pass, needs review of the prompt tone."
- **Always keep someone awake with merge rights** (BE or FLEX). If both sleep at the same time, nobody can unblock the others.
- **Commit and push before leaving a laptop.** Unpushed work only lives on one machine.

---

## 13. Cheat sheet

| I want to… | Do this |
|---|---|
| See where I am | `git status` and `git branch` |
| Start a task | `git switch main && git pull && git switch -c fe/my-task` |
| Save my work | `git add <my files> && git commit -m "message"` |
| Get the latest from others | `git fetch origin && git merge origin/main` |
| Check I only changed my folders | `git diff --stat origin/main` |
| Upload my work | `git push -u origin <branch>` |
| Open a PR | `gh pr create --fill` |
| Undo my last commit but keep the changes | `git reset --soft HEAD~1` |
| Park my changes for a moment | `git stash` (and later `git stash pop`) |
| Back out of a merge that went wrong | `git merge --abort` |
| Make a safety copy before something risky | `git branch backup-$(date +%H%M)` |
| Go back to a known-good version | `git switch --detach demo-ready-1` |

**Never:** `git push --force`, `git reset --hard` (unless a teammate who understands it says so), committing to `main`, committing `.env`.

**If you're stuck:** run `git status`, copy the output to your agent or to BE, and say what you were trying to do. Nearly everything in Git can be recovered as long as it was committed.
