# Task T14: Code review before merging to main

**Role:** review
**Read first:** agents/README.md, agents/review-agent.md, docs/decisions/README.md, docs/DEMO.md

## Goal
Read the whole integrated product critically and write `docs/reviews/review-2026-10-03.md`. Do not edit code.

## Check
- Money math only in `backend/app/engine/`; the frontend and the assistant never compute dollar amounts (grep the frontend for arithmetic on money).
- Privacy: an adult cannot read another adult's data; managed children visible only to the primary; assistant context scoped to the active member; no secrets or keys in the repo (grep `sk-ant`, `.env`).
- Number guard and safety wording; the estimate disclaimer on every result; urgent care never delayed.
- Decisions D1 to D13 are honored (dental only, three tiers, Preferred $50 deductible, demo sign-in).
- Dead code, duplicated logic, stale docs, broken links, missing tests, accessibility basics (labels, focus, contrast, no dropdowns for choices).
- Risks for the 10:00 AM demo and what to cut.

## Output
A ranked list: must fix before demo, should fix, nice to have. Each item with file:line and a concrete fix. Be honest and specific; no praise padding.

## You may edit
`docs/reviews/` only.

## Report
Format in agents/README.md.
