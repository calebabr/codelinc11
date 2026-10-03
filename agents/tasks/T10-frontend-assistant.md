# Task T10: Assistant page and global chat button

**Role:** frontend
**Read first:** agents/README.md, agents/frontend-agent.md, agents/tasks/PLAN.md, `docs/design/portal-look.md`, T06's report (chat, suggestions, context and attachment endpoints)

## Goal
Demo priority 3: a chat that talks to the active family member, with recommended questions, a view of what the assistant knows about them, and PDF upload.

## Scope
Kept features: **personalized chatbot with separate context per person** and **recommended questions** (Wrigley), **PDF upload** (Sai).
Reference, read-only: Wrigley's `ChatPanel.tsx`, `Chatbot.tsx`, `ProfileSwitcher.tsx` (on `main`), Sai's `assistant.html` and `chat.js`, Caleb's `ChatDrawer.tsx` and `lib/chat.ts` (the streaming client).

## You may edit
`frontend/src/pages/Assistant/`, `frontend/src/features/assistant/` (the chat panel used by both the page and the global button), `frontend/src/lib/api/assistant.ts`, `frontend/src/lib/types/assistant.ts`, and tests next to them.

## You must not touch
The router, shell and shared context (T02; you supply the panel component it mounts), other pages, `backend/`.

## Interfaces
- Chat: `POST /chat` (streamed events `tool_start`, `tool_end`, `token`, `done`, `error`), `GET /chat/suggestions?member_id=`, the assistant-context endpoint, `POST /chat/attachments`. All for the **active member**.
- **Layout (Assistant page):** a "Talking about: <name>" header with the member switcher; the chat in the middle; a side panel **"What the assistant knows"** (plan highlights, history, preferences and must-haves, recent questions) for that person. The same chat panel opens from the floating button on every other page.
- **Recommended questions** as tappable chips above the input; they change with the active member.
- Show streamed text and tool-status chips ("Calculating…"). Switching the member starts that person's own thread and context. Never mix threads.
- **Attach a PDF** (PDF only, size limit shown) with a note that sample documents only should be used in the demo; show the file as a removable chip.
- Handle "assistant unavailable" plainly (message plus retry); the rest of the app is unaffected.
- No dropdowns; 375 px layout.

## Acceptance checks
- Asking "What will a crown cost me?" as Alex (November, $1,100 used) shows **$800**; the answer comes from the stream and every dollar figure is displayed as the API returned it.
- Switching to Jordan shows a different thread, different chips and a different "knows" panel.
- Tests with a mocked stream cover: chips per member, thread separation, the unavailable state, attaching and removing a PDF. `npm run typecheck`, `npm run test`, `npm run build` pass.

## Docs to update
`frontend/README.md` (Assistant section).

## Report
Format in agents/README.md.
