"""Procedure search: exact/substring/fuzzy, no external services."""
from __future__ import annotations

import re
from difflib import SequenceMatcher

from .models import Procedure, ProcedureMatch

_STOP = {"a", "an", "the", "my", "on", "of", "for", "to", "i", "need", "get", "want", "tooth",
         "teeth", "dental", "and", "in", "with", "me", "do", "what", "will", "cost"}


def _tokens(text: str) -> list[str]:
    return [t for t in re.findall(r"[a-z0-9]+", text.lower()) if t not in _STOP]


def _whole_word_in(needle: str, haystack: str) -> bool:
    return re.search(rf"(?<![a-z0-9]){re.escape(needle)}(?![a-z0-9])", haystack) is not None


def _score(query: str, proc: Procedure) -> float:
    names = [proc.name.lower(), proc.code.lower(), *[s.lower() for s in proc.synonyms]]
    if query in names:
        return 1.0
    best = 0.0
    for n in names:
        if (len(query) >= 2 and query in n) or (len(n) >= 3 and _whole_word_in(n, query)):
            best = max(best, 0.8)
    if best:
        return best
    qt = set(_tokens(query))
    if qt:
        for n in names:
            overlap = qt & set(_tokens(n))
            if overlap:
                best = max(best, 0.5 + 0.25 * len(overlap) / len(qt))
    for n in names:
        ratio = SequenceMatcher(None, query, n).ratio()
        if ratio >= 0.72:
            best = max(best, round(ratio * 0.7, 3))
    return best if best >= 0.5 else 0.0


def search_procedures(query: str, catalog: dict[str, Procedure]) -> list[ProcedureMatch]:
    q = (query or "").strip().lower()
    if not q:
        return [ProcedureMatch(procedure=p, score=1.0) for p in catalog.values()]
    out = []
    for p in catalog.values():
        s = _score(q, p)
        if s >= 0.5:
            out.append(ProcedureMatch(procedure=p, score=round(min(s, 1.0), 3)))
    out.sort(key=lambda m: (-m.score, m.procedure.code))
    return out


def mentioned_procedures(text: str, catalog: dict[str, Procedure]) -> list[str]:
    """CDT codes whose name/synonym/code appears as whole words in text, in order of appearance.

    Longest matches win; overlapping shorter matches are dropped.
    """
    t = text.lower()
    spans: list[tuple[int, int, str]] = []  # (start, end, code)
    for p in catalog.values():
        for n in [p.name.lower(), p.code.lower(), *[s.lower() for s in p.synonyms]]:
            for m in re.finditer(rf"(?<![a-z0-9]){re.escape(n)}s?(?![a-z0-9])", t):
                spans.append((m.start(), m.end(), p.code))
    spans.sort(key=lambda x: (-(x[1] - x[0]), x[0]))
    taken: list[tuple[int, int, str]] = []
    for st, en, code in spans:
        if all(en <= a or st >= b for a, b, _ in taken):
            taken.append((st, en, code))
    taken.sort()
    out: list[str] = []
    for _, _, code in taken:
        if code not in out:
            out.append(code)
    return out
