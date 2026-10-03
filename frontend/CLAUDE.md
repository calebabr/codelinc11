# Frontend rules
@../docs/CONVENTIONS.md
@../docs/FEATURES.md

- Stack: React + Vite + TypeScript, Tailwind, shadcn/ui, TanStack Query, Recharts.
- Only edit files in frontend/. Never edit src/lib/api-types.ts (generated: run `npm run gen:api`).
- NEVER compute dollar amounts in the frontend. Display values from the API only. format.ts may only format.
- Every dollar figure must come from an API response field.
- Before finishing: `npm run typecheck && npm run build`, then check the page at 375px width.
- Follow the design rules in docs/FRONTEND.md section 5.
