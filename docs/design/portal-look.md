# Portal look (decision D5)

Insurer-portal styling taken from Sai's prototype (`benefits-portal/public/styles.css`). It replaces the old editorial theme (warm paper, maroon `#6B0F2A`, Fraunces and Geist). Live reference: `/style`. Source of truth in code: `frontend/src/index.css`.

## Tokens

Each token is a CSS variable and a Tailwind color. Names are fixed (see `agents/tasks/PLAN.md`), so do not rename them.

| Token | Value | Tailwind | Use |
|---|---|---|---|
| `--burgundy` | `#650030` | `bg-burgundy`, `text-burgundy`, `border-burgundy` | Brand, headings, primary actions |
| `--burgundy-dark` | `#45001f` | `bg-burgundy-dark` | Utility bar, footer, gradient start |
| `--orange` | `#FF4F17` | `bg-orange`, `border-orange` | Accents, glow, bar fills, selected borders |
| `--orange-dark` | `#d93d0a` | `bg-orange-dark`, `text-orange-dark` | Orange button fill, small orange text |
| `--ink` | `#1c1c1e` | `text-ink`, `bg-ink` | Body text |
| `--muted` | `#5f6368` | `text-muted-foreground` (also `text-muted-ink`) | Secondary text |
| `--line` | `#e6e1e3` | `border-line`, `bg-line` | Borders, dividers |
| `--soft` | `#faf6f7` | `bg-soft` | Alternate section background |
| `--ok` | `#1a7f4b` | `bg-ok`, `text-ok` | Success |
| `--warn` | `#b26a00` | `bg-warn`, `text-warn` | Warning, pending |

Supporting tokens: `--burgundy-light #8a1646` (hero gradient end), `--ok-ink #146b3d` and `--warn-ink #8a5100` (text on the tints), `--tint-orange #fff4ef`, `--tint-ok #e6f5ec`, `--tint-warn #fff1dc`, `--track #f1e8ec` (empty bar).

**Note on `muted`.** shadcn uses `bg-muted` as a background, so Tailwind's `muted` color is the light tint `#f1e8ec`. The portal's gray text `#5f6368` is `text-muted-foreground`. This keeps existing shadcn components readable. The CSS variable `--muted` itself is the gray text color, as in PLAN.md.

shadcn semantic colors (`primary`, `card`, `border`, `ring` ...) map onto these tokens, so existing `components/ui/*` follow the new look. Old names `savings`, `savings-ink` and `paper` still exist as aliases (orange-dark, orange-dark, soft) so older pages do not break. Do not use them in new code.

## Type
- Font: Source Sans 3 (400, 600, 700), loaded in `frontend/index.html`, falling back to Segoe UI and system fonts. Headings and body use the same family.
- Body 16px, line height 1.5. Page titles bold, 36 to 56px. Section titles bold burgundy, 28 to 40px. Card titles 18px bold burgundy.
- Eyebrow (`eyebrow` utility): 12px, bold, uppercase, 0.14em spacing, orange-dark.
- Money (`money` utility): bold, tabular numbers, tight spacing. The "You pay" figure is the biggest thing on a result screen (40px or more, burgundy).

## Spacing and shape
- Page width: `wrap` utility (max 1160px, 16px side gutter on phones, 24px from 640px).
- Cards: `portal-card`, 1px line border, 18px radius, 24px padding. Panels and hero: 18 to 24px radius.
- Buttons and chips: fully rounded (pill).
- Sections: about 72px vertical rhythm on desktop, 40px on phones. Design for 375px first.

## Components (classes in `index.css`)
- **Pill buttons:** `btn` plus `btn-orange`, `btn-outline` or `btn-ghost`. Minimum height 44px. Ghost is only for use on burgundy.
- **Card:** `portal-card`, `portal-card-title`. Choosable cards add `portal-card-select` and `aria-pressed="true"` (or `data-selected="true"`) for the selected look.
- **Coverage bar:** `<div class="coverage"><i style="width:73%"></i></div>`. Use `coverage coverage-on-dark` on burgundy. Give it `role="progressbar"` and an `aria-label`. The width comes from an API value. Never compute it from dollars in the frontend.
- **Status chips:** `chip` plus `chip-ok`, `chip-warn`, `chip-pending` (dashed border) or `chip-off`. Always include text.
- **Hero banner:** `hero-banner` (burgundy gradient with the orange glow). Children sit above the glow automatically. `hero-summary` is the frosted panel. `result-panel` is the burgundy result card.
- **Shell pieces:** `util-bar` (slim burgundy-dark bar), `nav-bar` (sticky white nav), `nav-link` (orange underline on hover or `aria-current="page"`).
- **Note:** `note`, orange left border on a light tint.

## Contrast (WCAG 2.x, computed)

| Pair | Ratio | Result |
|---|---|---|
| White on burgundy `#650030` | 13.2 | AA and AAA |
| White on burgundy-dark `#45001f` | 16.5 | AA and AAA |
| White on burgundy-light `#8a1646` | 9.2 | AA |
| Ink on white / on soft | 17.0 / 15.9 | AA and AAA |
| Muted `#5f6368` on white / on soft | 6.1 / 5.6 | AA |
| Burgundy on white / on soft / on orange tint | 13.2 / 12.3 / 12.2 | AA |
| **White on orange `#FF4F17`** | **3.3** | **Fails AA for body text.** Only for large text (24px, or 19px bold) and graphics |
| White on orange-dark `#d93d0a` | 4.5 | AA. This is why `btn-orange` uses orange-dark as its fill |
| Orange-dark on white | 4.5 | AA. Not on soft (4.2): use burgundy there |
| Orange `#FF4F17` on white (as text) | 3.3 | Do not use for text |
| Light peach `#ffb199` on burgundy (hero eyebrow) | 7.5 | AA |
| Ok `#1a7f4b` on white | 5.0 | AA. On the ok tint it is 4.5 borderline, so chips use `ok-ink` (5.8) |
| Warn `#b26a00` on white | 4.2 | Fails for small text. Chips use `warn-ink` (5.8), small warn text on white should too |
| Burgundy on orange | 4.0 | Large text only |

Deviations from Sai's CSS: orange buttons use `#d93d0a` instead of `#FF4F17`, the eyebrow uses orange-dark, and chip text uses the darker ink variants. All were needed to reach AA.

## Rules
- Use tokens, never raw hex values, in pages and components.
- Meaning is never carried by color alone: chips carry a word, bars carry a number.
- Calm tone. No red alarm styling for ordinary numbers. The urgent-care message is the one place that may stand out.
- Visual controls (cards, chips, sliders, month strips) instead of native dropdowns.
- Focus ring: 3px orange outline with 2px offset on every interactive element.
- Cleanup note for the Frontend agent: pages written before D5 (`Dashboard`, `Profiles`, `Chatbot`, `ChatPanel`) still use `text-savings`, `bg-paper` and `font-heading` class names. They render in the new colors through the aliases. When each page is rebuilt, switch to the portal tokens and drop the aliases.
