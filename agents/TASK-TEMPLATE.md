# Task Brief Template

The orchestrator fills this in for each agent and saves it as `agents/tasks/<date>-<short-name>-<role>.md`. Keep it short and specific. An agent starts cold, so the brief has to stand alone.

```markdown
# Task: <short name>

**Role:** <frontend | design | backend | ai | database | tests | docs | devops | integration | review>
**Read first:** agents/README.md, agents/<role>-agent.md, <other files this task needs>

## Goal
One or two sentences: what should exist when this is done, and why.

## Scope
- Feature (from the decision log): <name>
- Source to port or reference, read-only: <prototype branch and files, or "none">

## You may edit
- <exact folders or files>

## You must not touch
- <anything near your files that belongs to someone else>

## Interfaces
- API shape you depend on or must provide: <endpoint, request, response>
- Another agent running at the same time: <who, and which files they own>

## Acceptance checks
- <specific, checkable behavior, with exact numbers where possible>
- Tests required: <unit / contract / end-to-end>
- Golden numbers affected: <none, or which>

## Docs to update
- <files>

## Report
Use the format in agents/README.md. Include exactly what a human should check.
```

## Good briefs

- Name exact files and exact numbers ("crown, fresh year, you pay $625").
- Say what is out of scope so the agent doesn't wander.
- List the other agents running in parallel and the files they own.
- Split large work into slices an agent can finish and check in one go (one feature or one layer of a feature).
