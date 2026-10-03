"""Chat loop: Ollama tool-calling when available, deterministic fallback otherwise."""
from __future__ import annotations

import json
import re
from collections.abc import Iterator
from typing import Any

from ..data import load_catalog
from ..engine.estimate import money
from ..models import ChatRequest
from ..search import mentioned_procedures, search_procedures
from .guard import check_numbers
from .ollama_client import OllamaClient
from .tools import TOOL_SCHEMAS, ToolContext, run_tool

MAX_STEPS = 5
DISCLAIMER = "This is an estimate, not a guarantee."

SYSTEM_PROMPT = (
    "You are a friendly dental benefits assistant. Use plain, calm language (about an 8th-grade "
    "reading level). Rules: (1) Never state a dollar amount that did not come from a tool result. "
    "(2) Use the tools for every number: estimate_cost for one procedure, plan_year_schedule for "
    "timing questions like 'what if I wait until January', get_benefits_status for what is left. "
    "(3) If the procedure is unclear, call find_procedure and ask the user one short question. "
    "(4) Never advise delaying urgent or painful care. "
    f"(5) End every estimate with: \"{DISCLAIMER}\" "
    "Keep answers short. Plan name: {plan}. Current month number: {month}."
)

SCHEDULE_WORDS = ("january", "wait", "schedule", "plan my year", "next year", "later", "when should",
                  "timing", "postpone", "delay")
BENEFIT_WORDS = ("left", "remaining", "max", "benefits", "how much do i have", "deductible", "used")
URGENT_WORDS = ("urgent", "pain", "hurts", "hurt", "emergency", "infected", "infection", "swelling")


def _ev(name: str, data: dict) -> dict:
    return {"event": name, "data": data}


def _tokens(text: str) -> Iterator[dict]:
    for chunk in re.findall(r"\S+\s*", text):
        yield _ev("token", {"text": chunk})


def _parse_args(raw: Any) -> dict:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            val = json.loads(raw)
            return val if isinstance(val, dict) else {}
        except ValueError:
            return {}
    return {}


# ---------------------------------------------------------------- Ollama path

def _try_ollama(req: ChatRequest, client: Any, ctx: ToolContext) -> Iterator[dict]:
    """Yields events; the final item is {"event": "_answer", ...} on success.

    Raises OllamaUnavailable/ValueError when the caller should fall back.
    """
    system = SYSTEM_PROMPT.format(plan=ctx.plan.name, month=ctx.current_month)
    messages: list[dict] = [{"role": "system", "content": system}]
    messages += [{"role": m.role, "content": m.content} for m in req.messages]
    results: list[dict] = []
    for _ in range(MAX_STEPS):
        resp = client.chat(messages, TOOL_SCHEMAS)
        msg = resp.get("message") or {}
        calls = msg.get("tool_calls") or []
        if calls:
            messages.append({"role": "assistant", "content": msg.get("content") or "",
                             "tool_calls": calls})
            for call in calls:
                fn = call.get("function", {})
                name = fn.get("name", "")
                args = _parse_args(fn.get("arguments"))
                yield _ev("tool_start", {"name": name, "args": args})
                result = run_tool(name, args, ctx)
                results.append(result)
                yield _ev("tool_end", {"name": name, "result": result})
                messages.append({"role": "tool", "name": name,
                                 "content": json.dumps(result)})
            continue
        answer = (msg.get("content") or "").strip()
        if not answer:
            raise ValueError("empty answer")
        if check_numbers(answer, results):
            raise ValueError("answer contains numbers that did not come from tools")
        yield {"event": "_answer", "data": {"text": answer}}
        return
    raise ValueError("too many tool steps")


# ---------------------------------------------------------------- fallback path

def _estimate_answer(res: dict) -> str:
    if "error" in res:
        return res["error"]
    i, o = res["in_network"], res["out_of_network"]
    name = res["name"]
    if not i["covered"]:
        return (f"{name}: your plan's frequency limit for this has already been reached this plan year, "
                f"so the plan would pay {money(i['plan_pays'])} and you would pay about "
                f"{money(i['you_pay'])}. {DISCLAIMER}")
    parts = [(f"{name} typically costs about {money(i['billed'])} at an in-network dentist. "
              f"Your plan would pay about {money(i['plan_pays'])}, so you would pay about "
              f"{money(i['you_pay'])}.")]
    if i["deductible_applied"] > 0:
        parts.append(f"That includes {money(i['deductible_applied'])} toward your deductible "
                     "(what you pay before the plan starts paying).")
    if any(s["label"] == "Yearly maximum limit" for s in i["trace"]):
        parts.append("Your plan's yearly maximum is limiting what it can pay.")
    parts.append(f"Out of network you would pay about {money(o['you_pay'])}"
                 + (f", including {money(o['balance_bill'])} of balance billing "
                    "(the difference between the dentist's charge and what your plan approves)."
                    if o["balance_bill"] > 0 else "."))
    parts.append(DISCLAIMER)
    return " ".join(parts)


def _schedule_answer(res: dict, urgent: bool) -> str:
    if "error" in res:
        return res["error"]
    items = res["items"]
    lines = []
    for it in items:
        when = "this plan year" if it["year_offset"] == 0 else "next plan year"
        month = ["January", "February", "March", "April", "May", "June", "July", "August",
                 "September", "October", "November", "December"][it["month"] - 1]
        lines.append(f"{it['name']}: {month} ({when}), you pay about {money(it['you_pay'])}")
    out = []
    if len(items) == 1 and res["savings"] > 0 and items[0]["year_offset"] == 1:
        it = items[0]
        out.append(f"If you do it now, you would pay about {money(res['baseline_you_pay'])}. "
                   f"If you wait until next plan year, your yearly maximum resets and you would pay "
                   f"about {money(res['total_you_pay'])}, which saves about {money(res['savings'])}.")
    else:
        out.append("Here is the lowest-cost timing I found: " + "; ".join(lines) + ".")
        out.append(f"Total you pay: about {money(res['total_you_pay'])}. Doing everything now would be "
                   f"about {money(res['baseline_you_pay'])}"
                   + (f", so you save about {money(res['savings'])}." if res["savings"] > 0 else "."))
    if res["reasons"]:
        out.append(res["reasons"][0])
    out.append("If a tooth is painful or urgent, please do not wait for savings." if urgent
               else "If anything starts to hurt, do not delay care to save money.")
    out.append(DISCLAIMER)
    return " ".join(out)


def _benefits_answer(res: dict) -> str:
    parts = [(f"On {res['plan_name']}, you have {money(res['max_remaining'])} left of your "
              f"{money(res['annual_max'])} yearly maximum, and {money(res['deductible_remaining'])} "
              "left on your deductible.")]
    for f in res["frequencies"]:
        parts.append(f"{f['name']}: {f['used']} of {f['limit']} used this year.")
    parts.append(f"There are {res['months_left']} month(s) left in the plan year.")
    if res.get("reminder"):
        parts.append(res["reminder"])
    return " ".join(parts)


MENU = ("I can help with three things: (1) what a procedure will cost you, like \"What will a crown "
        "cost me?\"; (2) the best timing for care, like \"What if I wait until January?\"; and (3) what "
        "you have left, like \"How much do I have left?\". Which would you like?")


def _procedures_in(req: ChatRequest, last_only: bool) -> list[str]:
    catalog = load_catalog()
    user_msgs = [m.content for m in req.messages if m.role == "user"]
    if not user_msgs:
        return []
    found = mentioned_procedures(user_msgs[-1], catalog)
    if found or last_only:
        return found
    for text in reversed(user_msgs[:-1]):
        found = mentioned_procedures(text, catalog)
        if found:
            return found
    return []


def _fallback(req: ChatRequest, ctx: ToolContext) -> Iterator[dict]:
    """Deterministic intent handler. Answers use only tool results."""
    user_msgs = [m.content for m in req.messages if m.role == "user"]
    text = (user_msgs[-1] if user_msgs else "").lower()
    answer = MENU

    def call(name: str, args: dict) -> Iterator[dict]:
        yield _ev("tool_start", {"name": name, "args": args})
        result = run_tool(name, args, ctx)
        yield _ev("tool_end", {"name": name, "result": result})
        holder.append(result)

    holder: list[dict] = []
    wants_schedule = any(w in text for w in SCHEDULE_WORDS)
    wants_benefits = any(w in text for w in BENEFIT_WORDS)
    urgent = any(w in text for w in URGENT_WORDS)

    if wants_schedule:
        codes = _procedures_in(req, last_only=False)
        if codes:
            items = [{"code": c, "urgency": "urgent" if urgent else "flexible"} for c in codes]
            yield from call("plan_year_schedule", {"items": items})
            answer = _schedule_answer(holder[-1], urgent)
        else:
            answer = ("Which procedure are you thinking about timing? For example, a crown, a filling "
                      "or a root canal. Then I can compare doing it now with waiting until next plan year.")
    else:
        codes = _procedures_in(req, last_only=True)
        if codes and not (wants_benefits and not any(w in text for w in ("cost", "pay", "price"))):
            for code in codes[:3]:
                yield from call("estimate_cost", {"code": code})
            answer = " ".join(_estimate_answer(r) for r in holder[:1]) if len(holder) == 1 else \
                " ".join(_estimate_answer(r).replace(" " + DISCLAIMER, "") for r in holder) + " " + DISCLAIMER
        elif wants_benefits:
            yield from call("get_benefits_status", {})
            answer = _benefits_answer(holder[-1])
        else:
            hits = [m for m in search_procedures(text, load_catalog()) if m.score >= 0.8] if len(text) >= 4 else []
            if hits:
                yield from call("find_procedure", {"query": text})
                yield from call("estimate_cost", {"code": hits[0].procedure.code})
                answer = _estimate_answer(holder[-1])
    yield from _tokens(answer)
    yield _ev("done", {"mode": "fallback"})


# ---------------------------------------------------------------- entry point

def run_chat(req: ChatRequest, client: Any = None) -> Iterator[dict]:
    """Yield event dicts {"event": name, "data": {...}} for one chat turn."""
    try:
        ctx = ToolContext.from_request(req)
    except KeyError as exc:
        yield _ev("error", {"message": f"Unknown plan {exc}."})
        yield _ev("done", {"mode": "fallback"})
        return

    client = client if client is not None else OllamaClient()
    answer: str | None = None
    try:
        if client.is_available():
            for ev in _try_ollama(req, client, ctx):
                if ev["event"] == "_answer":
                    answer = ev["data"]["text"]
                else:
                    yield ev
    except Exception:  # noqa: BLE001  any failure means: use the offline answer
        answer = None

    if answer is not None:
        yield from _tokens(answer)
        yield _ev("done", {"mode": "ollama"})
        return
    yield from _fallback(req, ctx)
