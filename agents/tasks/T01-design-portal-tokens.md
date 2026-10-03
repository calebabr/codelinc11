# Task T01: Portal tokens and style guide

**Role:** design
**Read first:** agents/README.md, agents/design-agent.md, agents/tasks/PLAN.md ("Look"), `frontend/src/index.css`, `frontend/src/pages/StyleGuide.tsx`, Sai's stylesheet via `git show prototype/sai-benefits-portal:benefits-portal/public/styles.css`

## Goal
Replace the editorial theme on `main` with Sai's portal look as design tokens, so every page can be built on it. Rework the style guide page to show the new look.

## Scope
- Decision D5 (Sai's portal look).
- Source to reference, read-only: `prototype/sai-benefits-portal` styles.

## You may edit
- `frontend/src/index.css` (tokens and base styles only)
- `frontend/src/pages/StyleGuide.tsx`
- `frontend/index.html` (only to add the Source Sans 3 font link)
- `docs/design/` (create it: `portal-look.md` with the tokens, type, spacing, component rules)

## You must not touch
Other pages, `frontend/src/App.tsx` and the shell (T02 owns them), `backend/`, `tests/`.

## Interfaces
- Token names and values are fixed in `agents/tasks/PLAN.md` ("Look"). Expose each as a CSS variable **and** a Tailwind theme color (for example `bg-burgundy`, `text-burgundy`, `bg-orange`, `border-line`, `bg-soft`).
- Provide reusable classes or variants for: pill buttons (orange, outline, ghost), cards, coverage bar, status chips (ok, warn, pending), and a hero banner with the orange glow.
- Font: Source Sans 3 with system fallbacks.
- **Running at the same time:** T02 (shell) uses your token names. Do not rename them.

## Acceptance checks
- `/style` shows every token, the button variants, a card, a coverage bar, status chips and the hero banner.
- Contrast of text on burgundy, orange and soft backgrounds is checked and noted in `portal-look.md` (aim for WCAG AA for body text).
- Nothing in the old editorial theme remains that could clash (old maroon `#6B0F2A`, paper background).
- `npm run typecheck` and `npm run build` pass. Tests: none required beyond not breaking existing ones.

## Docs to update
`docs/design/portal-look.md`.

## Report
Format in agents/README.md. Include a screenshot-ready URL (`/style`).
