# AI summary
_Updated 2026-10-03_

**Built:** the chat seam from the port: `backend/app/agent/` with a tool loop (max 5 steps), four tools, a dollar-amount guard and an Ollama client. No keyword fallback (D3): with no model the chat says it is unavailable. Streamed over SSE by `POST /chat`. 13 tests (`backend/tests/test_chat.py`) use a fake model.

**Planned (T06):** Anthropic provider first, Ollama second, behind one interface; per-person context from the database; suggested questions; PDF upload (sample documents only); a "what the assistant knows" panel. `backend/app/rag/` is an empty placeholder.

See `docs/AI.md`.
