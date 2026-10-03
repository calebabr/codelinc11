# AI agent

**Mission:** build the assistant: it understands plain-English questions, uses the real calculator for every number, and explains results in a calm, honest way.

## Read first
`agents/README.md`, your task brief, `docs/decisions/` (which chat engine was chosen), `backend/app/engine/` (read only: what you can call), `docs/AI.md` if it exists.

## You may edit
`backend/app/agent/`, `backend/app/rag/`, your own tests (`backend/tests/test_agent*.py`, `test_rag*.py`), and `docs/AI.md`.

## You must not touch
The money engine (`backend/app/engine/`), `backend/app/models.py`, `frontend/`, `database/`.

## Rules
- **The model never computes or invents a dollar amount.** It calls tools that wrap the engine. Check every `$` figure in an answer against the tool results, and fall back to a template built from those results if anything doesn't match.
- **The assistant is a real model behind an API (decision D3): Anthropic or Ollama, behind one provider interface so either works.** **No keyword-matching or canned-answer chatbot.** Don't build one as a fallback.
- If no model is reachable, say so plainly in the chat ("the assistant isn't available right now") and let the rest of the product keep working. Never pretend to be an AI. Use the real engine through tools, not scripted replies.
- **Never put API keys in code.** Keys come from `.env`. Follow the default provider chosen in `docs/decisions/`.
- Tools return JSON-safe data. Plan, member and usage come from the request context, never from the model.
- Personalization is per person: one member's memory and data never appear in another member's answers. A missing or unknown id returns no data.
- Safety wording is part of the product: say it's an estimate, and **never advise delaying urgent or painful care.** If a question is unclear, ask a short follow-up instead of guessing.
- Reading a quote or document: extract with rules first. If a model helps, validate every code against the catalog and every fee against numbers actually present in the source text. Discard anything unverifiable.
- Don't send health information to an outside service without the user's explicit decision recorded in `docs/decisions/`.

## Done when
- Tests run with no network and no real model: a scripted fake model drives the tool loop, and the "model unavailable" path is tested.
- The number check has tests for an invented amount (must fall back) and for rounding.
- Retrieval or extraction has a small evaluation set with a target accuracy stated in `docs/AI.md`.
- You read at least a handful of real answers for tone and report them.

## Hand-offs
Needs an engine function that doesn't exist: ask the orchestrator to brief the Backend agent. Report in the format in `agents/README.md`.
