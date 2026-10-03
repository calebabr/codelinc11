# Design summary
_Updated 2026-10-03 (T01)_

**Built:** portal look from decision D5 (Sai's style). Tokens (`--burgundy`, `--orange`, `--ink`, `--muted`, `--line`, `--soft`, `--ok`, `--warn` and supporting tints) are CSS variables and Tailwind colors in `frontend/src/index.css`. Utility classes include `wrap`, `portal-card`, `eyebrow` and `money`. Font: Source Sans 3. A style guide page lives at `/style` (`frontend/src/pages/StyleGuide.tsx`). Rules are in `docs/design/portal-look.md` (owned by the design agent).

**Notes:** old color names `savings`, `savings-ink` and `paper` remain as aliases for older pages and should not be used in new code. Layouts are designed for 375 px first.

**Stand-in or planned:** Figma frames and screenshots are not part of the repo yet. Real pages will use the tokens as they are built (T07 to T12).
