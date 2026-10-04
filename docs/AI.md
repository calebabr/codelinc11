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
`find_procedure`, `estimate_cost` (in and out of network), `plan_year_schedule` (compares doing the work now with the best timing, including "wait until January"), `get_benefits_status`, `get_member_eligibility`, `get_household_coverage`, `get_savings_tips(codes?, quoted_fees?, urgent_codes?)` (the Costs page "Ways to save", from `engine/tips.py`; general tips when no code is given; urgent codes are never moved) and `get_dentist_questions(codes?)` (the Costs page "Questions to ask your dentist", from `questions.py`; general questions when no code is given) and `compare_plans(care_levels?, known_codes?, known_care_by_member?, in_network?)` (the Plans page "Which plan fits us?", from `engine/simulate.py`: covers the household members the signed-in person may see, everyone on average care unless an override by member id or name is given, `known_codes` added to the active member's years, `known_care_by_member` ({member id or name: [codes]}) adds known care to the named people only (everyone else unchanged), `in_network` false prices out of network, n 5,000 and seed 42 like the page; returns the same fields as `POST /simulate` plus the people used. The assistant must quote percentages and totals only from the result and say the odds are synthetic. The template fallback also covers it). **Deterministic pre-step (`loop.py`):** when the latest message asks for dentist questions ("what should I ask my dentist", "questions to ask") or savings tips ("save", "cheaper", "lower my bill", "tips"), the server runs `find_procedure` on the message (or, failing that, on the most recent earlier user message that names a procedure; best match needs score 0.7 or more), then `get_dentist_questions` or `get_savings_tips` with that code. Both appear as normal `tool_start`/`tool_end` events and are handed to the model as already-finished tool results, so the model only writes the answer (starting with the assumption, such as "for a molar root canal", and offering to adjust) and never asks about the tooth. With no match it falls through to the normal loop. The number check still applies. Tip savings overlap, so the assistant lists them and never adds them up; their dollar amounts count as tool results for the number check. The plan, usage and month come from the active member's database record (or the request in stateless chat), never from the model. At most `MAX_STEPS = 5` model steps per answer.

**Plan-comparison follow-ups (`loop.py`, T31).** The chat counts as being about the plan comparison when the latest user message uses comparison words (simulation, which plan, cheapest plan, bad/typical year, odds, worth it, upgrade/downgrade plan) or one of the last 2 assistant messages mentions 'simulated years', 'Cheapest in' or 'synthetic odds'. Then, unless the tips/questions pre-step already ran, the server pre-runs `compare_plans` with the page defaults (5,000 years, seed 42, everyone average care, in network) and hands it to the model as a finished tool turn (normal `tool_start`/`tool_end` events), with a system note: answer from the results, never ask a clarifying question first when a reasonable default exists, call `compare_plans` again for what-ifs (`care_levels`, `known_care_by_member`, `in_network` false), and say plainly when something is not modeled (braces/orthodontia, implants, dentures) and offer a single-procedure estimate. For 'improve / lower / save / what can we do' follow-ups it also pre-runs general `get_savings_tips` and adds a note listing the levers (best-winning plan, timing care across plan years, free preventive visits, staying in network, a pre-treatment estimate); dollar figures only from tool results, never suggest delaying urgent care. A method question ('how does this simulation work') skips the pre-step: the system prompt carries the method text (5,000 simulated years, same years priced under every plan with the real engine, own deductible and yearly maximum per person, each year fresh, premiums = monthly premium x 12 per person, synthetic odds, no waiting periods or switching costs). The number guard applies as before.

**SSE `done` event.** `{"mode": ...}` plus, when `compare_plans` ran during the turn (pre-step or model call), `followups`: up to 4 short strings built in code from the result, for example `["Why is Basic cheapest?", "What if Alex needs a crown?", "What can I do to lower our costs?", "How does this simulation work?"]` (winner name; first covered adult). Omitted otherwise. Tests: `backend/tests/test_agent_sim_followups.py`.

**Plan terms and the percentage guard.** The `compare_plans` result carries `plan_terms` per plan (monthly premium, deductible, deductible-waived categories, annual max, `plan_pays_percent` by category, frequency limits) so the model cites real coverage terms and never guesses them. `guard.check_percents` runs next to the dollar check: every `NN%` must match a percentage in the tool results (shares, coinsurance, text) within 1 point, and when one sentence names a single plan and a single kind of care (fillings, crowns, cleanings) the number must equal that plan's own term (or the matching 'you pay' side). A violation gets one rewrite, then the template fallback. The prompt also forbids opening with agreement, an apology or 'let me correct that' unless the person actually corrected something.

## Number check
After the model answers, every `$` amount must be within $1 of a number in a tool result or in the stored facts about the active member. If not, the model gets **one** chance to rewrite (it is told which amounts were rejected). If it fails again, the answer is a plain template built only from the tool results (done event `mode: "template"`); with no tool results it says it will not guess. Chat memory is not trusted as a source of numbers.

## Per-person assistant (D9)
- `POST /chat` with `member_id` needs a session (`Authorization: Bearer ...` from `/auth/demo-login`). The access layer decides: the primary may chat about anyone in the household; an adult only about themself; managed members have no login. Wrong person gives 403, missing session 401, unknown member 404.
- Only the **active member's** context is loaded: plan highlights, this year's usage and history, preferences, must-haves, and the last 6 chat messages. The household list holds only people the viewer may see.
- After a good answer (`anthropic`, `ollama` or `template`) the exchange is saved to that member's chat memory. Failed or unavailable answers are not saved.
- Without `member_id` the chat is stateless: plan and usage come from the request and nothing is loaded or saved.
- `GET /chat/suggestions?member_id=` returns up to 7 questions (including "How can I save on this?", "What should I ask my dentist?", "Summarize the plan simulations" and "How are the simulations calculated?") chosen by rules from that person's context (a child, a pending student and the primary each get different ones).
- `DELETE /members/{id}/chat` clears that person's saved chat memory (same access rules).
- `GET /members/{id}/assistant-context` returns what the assistant knows (for the "what the assistant knows" panel).
- Streaming events: `tool_start`, `tool_end`, `token`, `done` (with `mode`: `anthropic`, `ollama`, `template` or `unavailable`), `error`.

## PDF upload (D11, F5)
`POST /chat/attachments?member_id=&filename=` takes the PDF as the raw body (`Content-Type: application/pdf`, at most 5 MB, must start with `%PDF-`). It returns an `attachment_id`; send it in `attachment_ids` on `POST /chat`. Files are kept in server memory only, tied to the uploader and the person, and are passed to Anthropic as a document. Ollama says it cannot read documents. **Demo uses sample documents only**; the response carries that notice. Limitation: PDF text is not extracted on our side, so the assistant is told to describe the document in words and not to repeat its dollar amounts (they could not be checked); it estimates costs from procedure codes through the tools.

## Safety
Estimates are called estimates ("This is an estimate, not a guarantee."). The prompt forbids advising delay of urgent or painful care and tells the assistant to point to the dentist for pain, swelling or emergencies. Unclear questions get one short follow-up. Text in documents or earlier chats is treated as data, not instructions.

## Privacy
Anthropic receives chat text and the person's context, so the demo uses synthetic data and sample documents only (F5).

## Cost protection (rate limits, T37)
`backend/app/ratelimit.py` limits requests with in-memory sliding windows (one server process). `POST /chat` is capped per household (`RATE_CHAT_PER_MINUTE`, default 12; `RATE_CHAT_PER_DAY`, default 200) and for everyone together (`CHAT_GLOBAL_DAILY_CAP`, default 3000 a day), so an open sign-in cannot spend the Anthropic key without limit. `POST /chat/attachments` allows `RATE_ATTACH_PER_MINUTE` (5). Over a limit the server answers 429 with a `Retry-After` header and `{"detail": "<plain sentence>", "retry_after": <seconds>}`. The key is the household in the token, else the client IP (first `X-Forwarded-For` hop only when `TRUST_PROXY=1`). Limits restart when the server restarts. Tests: `backend/tests/test_ratelimit.py`.

## Not built
Retrieval over plan documents (`backend/app/rag/` is empty; `backend/data/plan_docs/` has no files). No retrieval evaluation set exists yet, so there is no accuracy target to state.

## Tests
`backend/tests/test_agent_assistant.py` (providers, loop, member isolation, visibility, suggestions, attachments) and `backend/tests/test_chat.py` (loop and guard basics) and `backend/tests/test_agent_compare_plans.py` (the `compare_plans` tool). A scripted fake provider drives the tool loop; no network, no model, no key (tests remove `ANTHROPIC_API_KEY` from the environment).

## Manual check with a real key
As Alex (November, $1,100 used): "What will a crown cost me?" should say **$800**; "What if I wait until January?" should say **$625** versus **$800**.
