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

- **Account keyed by `user_id`.** The top-level record is an `Account`
  (`src/lib/types.ts` → `Account`) holding the subscriber, **plan tier**,
  **coverage type**, and all **covered people** (dependents). The chatbot is
  handed the `user_id` and retrieves the account through
  `getAccountByUserId(userId)` in `src/lib/accountApi.ts` — which returns records
  for **exactly that id and nothing else** (the data-isolation boundary a real
  backend enforces with `WHERE user_id = :authenticated_user`). An unknown or
  empty id returns no data.
- **Know-your-profile / eligibility.** `eligibilitySummary(account)` gives the
  snapshot the bot reads: plan tier, coverage type, who's covered, **dental
  visits used/remaining per person per year**, **major work done this year**, and
  **per-dependent eligibility** (age limit, full-time-student rule). The Chatbot
  page shows this as a table; ask *"who's covered on my plan?"* to see it in chat.
- **Per-user context.** Each covered person is its own record
  (`Profile.aiContext`) holding plan highlights, previous procedures, previous
  questions and preferences. The assistant reads only the **active** person's
  record.
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
│   ├── types.ts             # domain types (Account, Profile, Plan, AiContext, …)
│   ├── seed.ts              # demo plan, procedures, account + covered people
│   ├── mockApi.ts           # THE money engine (golden numbers G1–G6, S2)
│   ├── accountApi.ts        # getAccountByUserId (isolation) + eligibility engine
│   ├── chat.ts              # the personalized assistant "agent" (user_id driven)
│   └── format.ts            # money/date formatting only (no math)
├── components/
│   ├── ChatPanel.tsx        # streaming chat + tool chips + learning loop
│   ├── ProfileSwitcher.tsx
│   └── Disclaimer.tsx
└── pages/ (Dashboard, Chatbot, Profiles)
```
