# AI

How the assistant works (2026-10-03, task T06).

## Rule
The model explains; the engine calculates. The model never makes up a dollar amount. Every figure must come from a tool that runs engine code (or from a stored record of the active member, such as plan highlights and past visits).

## Files
`backend/app/agent/`: `providers.py` (provider interface, Anthropic, Ollama, selection), `loop.py` (tool loop, number check, template), `tools.py` (engine tools), `guard.py` (number check), `context.py` (per-person context), `suggestions.py` (suggested questions). Endpoints are in `backend/app/routers/chat.py`.

## Providers (decision D3, F4)
One interface (`Provider`: `is_available()`, `complete(system, turns, tools)`), two implementations:

| Provider | Used when | Settings |
|---|---|---|
| **Anthropic** (default) | `ANTHROPIC_API_KEY` is set | `ANTHROPIC_MODEL` (default `claude-haiku-4-5`). Called over HTTPS with `httpx`; no extra package. Reads PDFs. |
| **Ollama** (local) | no key, and Ollama answers on `OLLAMA_URL` | `OLLAMA_URL`, `OLLAMA_MODEL`, `OLLAMA_TIMEOUT`. Cannot read PDFs. |
| none | neither is available | The chat says "The assistant is not available right now" and the other pages keep working. |

`ASSISTANT_PROVIDER` can force the choice: `auto` (default), `anthropic`, `ollama` or `none`.
**There is no keyword or canned-answer fallback.**

**Setting the key:** put `ANTHROPIC_API_KEY=...` in `backend/.env` (never committed; list the name in `.env.example`) and restart the backend. The key is never logged, returned or put in an error message.

## Tools (all call the engine)
`find_procedure`, `estimate_cost` (in and out of network), `plan_year_schedule` (compares doing the work now with the best timing, including "wait until January"), `get_benefits_status`, `get_member_eligibility`, `get_household_coverage`, `get_savings_tips(codes?, quoted_fees?, urgent_codes?)` (the Costs page "Ways to save", from `engine/tips.py`; general tips when no code is given; urgent codes are never moved) and `get_dentist_questions(codes?)` (the Costs page "Questions to ask your dentist", from `questions.py`; general questions when no code is given). **Deterministic pre-step (`loop.py`):** when the latest message asks for dentist questions ("what should I ask my dentist", "questions to ask") or savings tips ("save", "cheaper", "lower my bill", "tips"), the server runs `find_procedure` on the message (or, failing that, on the most recent earlier user message that names a procedure; best match needs score 0.7 or more), then `get_dentist_questions` or `get_savings_tips` with that code. Both appear as normal `tool_start`/`tool_end` events and are handed to the model as already-finished tool results, so the model only writes the answer (starting with the assumption, such as "for a molar root canal", and offering to adjust) and never asks about the tooth. With no match it falls through to the normal loop. The number check still applies. Tip savings overlap, so the assistant lists them and never adds them up; their dollar amounts count as tool results for the number check. The plan, usage and month come from the active member's database record (or the request in stateless chat), never from the model. At most `MAX_STEPS = 5` model steps per answer.

## Number check
After the model answers, every `$` amount must be within $1 of a number in a tool result or in the stored facts about the active member. If not, the model gets **one** chance to rewrite (it is told which amounts were rejected). If it fails again, the answer is a plain template built only from the tool results (done event `mode: "template"`); with no tool results it says it will not guess. Chat memory is not trusted as a source of numbers.

## Per-person assistant (D9)
- `POST /chat` with `member_id` needs a session (`Authorization: Bearer ...` from `/auth/demo-login`). The access layer decides: the primary may chat about anyone in the household; an adult only about themself; managed members have no login. Wrong person gives 403, missing session 401, unknown member 404.
- Only the **active member's** context is loaded: plan highlights, this year's usage and history, preferences, must-haves, and the last 6 chat messages. The household list holds only people the viewer may see.
- After a good answer (`anthropic`, `ollama` or `template`) the exchange is saved to that member's chat memory. Failed or unavailable answers are not saved.
- Without `member_id` the chat is stateless: plan and usage come from the request and nothing is loaded or saved.
- `GET /chat/suggestions?member_id=` returns up to 5 questions (including "How can I save on this?" and "What should I ask my dentist?") chosen by rules from that person's context (a child, a pending student and the primary each get different ones).
- `GET /members/{id}/assistant-context` returns what the assistant knows (for the "what the assistant knows" panel).
- Streaming events: `tool_start`, `tool_end`, `token`, `done` (with `mode`: `anthropic`, `ollama`, `template` or `unavailable`), `error`.

## PDF upload (D11, F5)
`POST /chat/attachments?member_id=&filename=` takes the PDF as the raw body (`Content-Type: application/pdf`, at most 5 MB, must start with `%PDF-`). It returns an `attachment_id`; send it in `attachment_ids` on `POST /chat`. Files are kept in server memory only, tied to the uploader and the person, and are passed to Anthropic as a document. Ollama says it cannot read documents. **Demo uses sample documents only**; the response carries that notice. Limitation: PDF text is not extracted on our side, so the assistant is told to describe the document in words and not to repeat its dollar amounts (they could not be checked); it estimates costs from procedure codes through the tools.

## Safety
Estimates are called estimates ("This is an estimate, not a guarantee."). The prompt forbids advising delay of urgent or painful care and tells the assistant to point to the dentist for pain, swelling or emergencies. Unclear questions get one short follow-up. Text in documents or earlier chats is treated as data, not instructions.

## Privacy
Anthropic receives chat text and the person's context, so the demo uses synthetic data and sample documents only (F5).

## Not built
Retrieval over plan documents (`backend/app/rag/` is empty; `backend/data/plan_docs/` has no files). No retrieval evaluation set exists yet, so there is no accuracy target to state.

## Tests
`backend/tests/test_agent_assistant.py` (providers, loop, member isolation, visibility, suggestions, attachments) and `backend/tests/test_chat.py` (loop and guard basics). A scripted fake provider drives the tool loop; no network, no model, no key (tests remove `ANTHROPIC_API_KEY` from the environment).

## Manual check with a real key
As Alex (November, $1,100 used): "What will a crown cost me?" should say **$800**; "What if I wait until January?" should say **$625** versus **$800**.
