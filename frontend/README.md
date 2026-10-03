# Plan Coverage Explainer — Frontend Prototype

A clickable prototype of the dental **Plan Coverage Explainer**, built around the
star feature: a **personalized AI chatbot** that knows each user's plan, history,
benefit usage and preferences.

> **Prototype note:** there is no running backend yet. A mock engine in
> `src/lib/mockApi.ts` plays the role of `backend/app/engine/` — it is the single
> place dollar amounts are computed, so pages and the chatbot only ever *display*
> numbers (per `docs/CONVENTIONS.md` rule #1). The numbers match the golden
> scenarios G1–G6 and S2 in `docs/FEATURES.md §2`.

## Three pages

| Page | What it shows |
|---|---|
| **Dashboard** (main) | Annual-max / deductible / cleanings snapshot, unused-benefit reminder, **next 3 upcoming events**, link to a coverage map (in- vs out-of-network dentists), plan PDFs, and recent dental history. |
| **Chatbot** | The personalized assistant plus a live **"What the assistant knows"** panel showing the retrieved per-profile AI context. A floating assistant button also opens it from any page. |
| **Profiles** | Family profiles with **benefit period, dependent age limit, full-time student age limit**, must-have coverage, per-service breakdown (coverage %, frequency, age limits), and add-profile. |

## The chatbot (feature F5 + "Personalized AI Context")

- **Per-user context.** Each profile is its own record (`src/lib/types.ts` →
  `Profile.aiContext`) holding plan highlights, previous procedures, previous
  questions and preferences. The assistant reads only the **active** profile's
  record — the same isolation a real backend enforces by `user_id`.
- **Tool calls + streaming.** Answers show "Calculating…" tool chips
  (`find_procedure`, `estimate_cost`, `get_benefits_status`, …) then stream in
  token by token, mirroring the planned SSE flow.
- **It learns.** Every exchange appends to that profile's `aiContext` (saved to
  `localStorage`), so switching profiles changes what the assistant knows.
- **Grounded numbers.** Every dollar figure in an answer comes from the mock
  engine, never from the chat logic — the same rule the real LLM follows.

Try: *"What will a crown cost me?"*, *"What if I wait until January?"*,
*"What do I have left this year?"*, *"Plan my year"*. Switch profiles in the
header to see the answers change.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # tsc --noEmit
npm run build      # production build
```

## Structure

```
src/
├── App.tsx                  # nav shell + floating chat drawer
├── state/UserContext.tsx    # profiles + active profile, saved to localStorage
├── lib/
│   ├── types.ts             # domain types (Profile, Plan, AiContext, …)
│   ├── seed.ts              # demo plan, procedures, family profiles
│   ├── mockApi.ts           # THE money engine (golden numbers G1–G6, S2)
│   ├── chat.ts              # the personalized assistant "agent"
│   └── format.ts            # money/date formatting only (no math)
├── components/
│   ├── ChatPanel.tsx        # streaming chat + tool chips + learning loop
│   ├── ProfileSwitcher.tsx
│   └── Disclaimer.tsx
└── pages/ (Dashboard, Chatbot, Profiles)
```
