"""Suggested questions, personalized from one member's context (rules, not a model call)."""
from __future__ import annotations

from .context import MemberContext

MAX_SUGGESTIONS = 5


def suggest_questions(mc: MemberContext) -> list[str]:
    m = mc.member
    first = m["name"].split()[0]
    is_child = m["age"] < 18
    pending = m["status"] != "active"
    out: list[str] = []

    if pending:
        out.append(f"What does {first} need to do to stay covered?")
    if m["role"] == "primary":
        out.append("Who's covered on my plan?")
    if is_child:
        out += [f"What does the plan cover for {first}'s checkups and cleanings?",
                "Is orthodontia (braces) covered, and how much?",
                f"When should {first} book the next cleaning?",
                "What will a filling cost?"]
    else:
        out.append("What do I have left this year?")
        if mc.usage.max_used > 0 or mc.current_month >= 9:
            out.append("What if I wait until January?")
        out.append("What will a crown cost me?")
        if "D1110" not in mc.usage.history or mc.usage.history.count("D1110") < 2:
            out.append("Do I have a cleaning left this year?")
        if any("spread" in p.lower() for p in mc.preferences):
            out.append("How can I spread a big cost across two plan years?")
        if mc.must_haves:
            out.append("Does my plan cost more if I go out of network?")
    seen: set[str] = set()
    uniq = [q for q in out if not (q in seen or seen.add(q))]
    return uniq[:MAX_SUGGESTIONS]
