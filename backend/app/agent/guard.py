"""Number guard: every dollar amount in an answer must come from a tool result."""
from __future__ import annotations

import re
from typing import Any

_DOLLAR = re.compile(r"\$\s?(\d[\d,]*(?:\.\d+)?)")


def _collect_numbers(obj: Any, out: list[float]) -> None:
    if isinstance(obj, bool):
        return
    if isinstance(obj, (int, float)):
        out.append(float(obj))
    elif isinstance(obj, dict):
        for v in obj.values():
            _collect_numbers(v, out)
    elif isinstance(obj, (list, tuple)):
        for v in obj:
            _collect_numbers(v, out)
    elif isinstance(obj, str):
        for m in _DOLLAR.finditer(obj):
            out.append(float(m.group(1).replace(",", "")))


def check_numbers(answer: str, tool_results: list) -> list[str]:
    """Return every `$` amount in `answer` not within $1 of a number in the tool results."""
    allowed: list[float] = []
    _collect_numbers(tool_results, allowed)
    bad: list[str] = []
    for m in _DOLLAR.finditer(answer):
        raw = m.group(1)
        value = float(raw.replace(",", ""))
        if not any(abs(value - a) <= 1.0 for a in allowed):
            bad.append("$" + raw)
    return bad


_PERCENT = re.compile(r"(\d+(?:\.\d+)?)\s?%")
_CATEGORY_WORDS = {
    "preventive": re.compile(r"cleaning|check-?up|\bexams?\b|preventive", re.IGNORECASE),
    "basic": re.compile(r"filling|basic (?:care|work|services?)|\bbasic\b(?! plan)", re.IGNORECASE),
    "major": re.compile(r"crown|major", re.IGNORECASE),
}


def _percent_values(obj: Any, out: list[float], plan_pct: bool = False) -> None:
    if isinstance(obj, bool):
        return
    if isinstance(obj, (int, float)):
        v = float(obj)
        if 0 <= v <= 100:
            out.append(v)
        if 0 < v < 1:
            out.append(round(v * 100, 2))
        if plan_pct and 0 <= v <= 100:
            out.append(100 - v)           # "you pay" is the other side of "the plan pays"
    elif isinstance(obj, dict):
        for k, v in obj.items():
            _percent_values(v, out, plan_pct or k == "plan_pays_percent")
    elif isinstance(obj, (list, tuple)):
        for v in obj:
            _percent_values(v, out, plan_pct)
    elif isinstance(obj, str):
        out.extend(float(m.group(1)) for m in _PERCENT.finditer(obj))


def _plan_terms(obj: Any, out: list[dict]) -> None:
    if isinstance(obj, dict):
        if isinstance(obj.get("plan_terms"), list):
            out.extend(t for t in obj["plan_terms"] if isinstance(t, dict))
        for v in obj.values():
            if isinstance(v, (dict, list)):
                _plan_terms(v, out)
    elif isinstance(obj, list):
        for v in obj:
            _plan_terms(v, out)


def check_percents(answer: str, tool_results: list) -> list[str]:
    """Return every `NN%` in `answer` that no tool result supports.

    A percentage must match a percentage-like number in the results (shares, coinsurance, text),
    within 1 point. When a sentence names exactly one plan and one kind of care, a coverage
    percentage must equal that plan's own term for that care (the plan pays it or you pay the rest).
    """
    allowed: list[float] = []
    _percent_values(tool_results, allowed)
    terms: list[dict] = []
    _plan_terms(tool_results, terms)
    bad: list[str] = []
    for sentence in re.split(r"(?<=[.!?])\s+|\n+", answer):
        found = list(_PERCENT.finditer(sentence))
        if not found:
            continue
        plans = [t for t in terms if re.search(rf"\b{re.escape(str(t.get('name', '')))}\b",
                                              sentence, re.IGNORECASE) and t.get("name")]
        cats = [c for c, rx in _CATEGORY_WORDS.items() if rx.search(sentence)]
        own = None
        if len(plans) == 1 and len(cats) == 1:
            pct = (plans[0].get("plan_pays_percent") or {}).get(cats[0])
            if pct is not None:
                own = {float(pct), 100.0 - float(pct)}
        for m in found:
            value = float(m.group(1))
            ok = any(abs(value - a) <= 1.0 for a in allowed)
            if ok and own is not None and not any(abs(value - o) < 0.5 for o in own):
                # a coverage claim about one plan and one kind of care: must be that plan's term
                # (a quoted share of years is not a coverage term)
                shares = [p.get("cheapest_share") for r in tool_results if isinstance(r, dict)
                          for p in r.get("plans", []) if isinstance(p, dict)]
                if not re.search(r"year|cheapest|often|chance|odds", sentence, re.IGNORECASE) or not any(
                        s is not None and abs(value - s) <= 1.0 for s in shares):
                    ok = False
            if not ok:
                bad.append(m.group(0).replace(" ", ""))
    return bad
