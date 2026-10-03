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
