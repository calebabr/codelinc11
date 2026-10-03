"""Reads a dentist's treatment plan (pasted text) into structured items.

Deterministic rules always run. An optional local Ollama model may help with lines the
rules could not match, but everything it returns is verified against the catalog and the
source text, and any failure silently keeps rule-based results. No money math here: fees
are copied from the text or from the catalog.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field

from .agent.ollama_client import OllamaClient
from .models import ParsedTreatment, Procedure, TreatmentPlanParseResponse, Urgency
from .search import mentioned_procedures, search_procedures

MAX_TEXT_CHARS = 20_000

_CODE_RE = re.compile(r"\bD(\d{4})\b", re.IGNORECASE)
_TOOTH_RE = re.compile(
    r"(?:#\s*|\b(?:tooth|teeth)\s*(?:no\.?|number|num\.?|#)?\s*)(\d{1,2})\b", re.IGNORECASE
)
_DOLLAR_RE = re.compile(r"\$\s*(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)")
_BARE_NUM_RE = re.compile(r"(?<![\w.,#$])(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d{2,}(?:\.\d{1,2})?)(?![\w,])")
_ANY_NUM_RE = re.compile(r"\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?")
_PHASE_RE = re.compile(r"\b(phase|priority|stage)\s*(\d)\b", re.IGNORECASE)
_TOTAL_RE = re.compile(r"\b(sub\s*-?total|grand total|total|balance due|patient portion|insurance est)", re.IGNORECASE)

_MONTHS = r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*"
_DATE_RE = re.compile(
    r"\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b"
    r"|\b\d{4}[/.-]\d{1,2}[/.-]\d{1,2}\b"
    rf"|\b{_MONTHS}\.?\s+\d{{1,2}}(?:st|nd|rd|th)?,?(?:\s+\d{{4}})?\b"
    r"|\b\d{3}[-.\s)]\s*\d{3}[-.\s]\d{4}\b",  # phone numbers
    re.IGNORECASE,
)
_LABEL_RE = re.compile(
    r"^(patient|name|dob|date|exam date|provider|dentist|doctor|dr\.?|insurance|estimate|estimated|"
    r"subtotal|sub-total|total|member|phone|address|account|policy|id)\b"
    r"|\b(exam date|date of birth|dob)\b",
    re.IGNORECASE,
)
_YEAR_RE = re.compile(r"(19|20)\d{2}")

_URGENT_WORDS = ("urgent", "asap", "pain", "infection", "emergency")
_SOON_WORDS = ("soon", "recommended")
_FLEX_WORDS = ("elective", "cosmetic", "when convenient", "monitor")

ROOT_CANAL = "D3330"
CROWN = "D2740"


def _urgency_from_text(text: str) -> Urgency | None:
    t = text.lower()
    if any(w in t for w in _URGENT_WORDS):
        return "urgent"
    m = _PHASE_RE.search(t)
    if m and m.group(2) == "1":
        return "urgent"
    if any(w in t for w in _SOON_WORDS):
        return "soon"
    if m and m.group(2) == "2":
        return "soon"
    if any(w in t for w in _FLEX_WORDS):
        return "flexible"
    if m and m.group(2) == "3":
        return "flexible"
    return None


def _phase_text(text: str) -> str | None:
    m = _PHASE_RE.search(text)
    return f"{m.group(1).capitalize()} {m.group(2)}" if m else None


def _tooth(text: str) -> str | None:
    m = _TOOTH_RE.search(text)
    if m and 1 <= int(m.group(1)) <= 32:
        return str(int(m.group(1)))
    return None


def _to_float(s: str) -> float:
    return float(s.replace(",", ""))


def _fee(text: str, allow_bare: bool = True) -> float | None:
    m = _DOLLAR_RE.search(text)
    if m:
        return _to_float(m.group(1))
    if not allow_bare:
        return None
    stripped = _CODE_RE.sub(" ", _TOOTH_RE.sub(" ", text))
    stripped = _PHASE_RE.sub(" ", stripped)
    nums = [
        n for n in _BARE_NUM_RE.findall(stripped)
        if "." in n or "," in n or not _YEAR_RE.fullmatch(n)  # a bare 19xx/20xx is a year, not a fee
    ]
    return _to_float(nums[-1]) if nums else None


def _numbers_in(text: str) -> set[float]:
    return {_to_float(n) for n in _ANY_NUM_RE.findall(text)}


def _clean_name(text: str) -> str:
    t = _CODE_RE.sub(" ", text)
    t = _TOOTH_RE.sub(" ", t)
    t = _DOLLAR_RE.sub(" ", t)
    t = _PHASE_RE.sub(" ", t)
    t = re.sub(r"[#$|:;()\[\]]|\s-\s", " ", t)
    t = _BARE_NUM_RE.sub(" ", t) if re.search(r"\d{3,}", t) else t
    return re.sub(r"\s+", " ", t).strip(" ,.-")


@dataclass
class _Row:
    line: str
    tooth: str | None
    fee: float | None
    urgency: Urgency
    phase: str | None
    code: str | None = None
    confidence: float = 0.0
    name: str = ""
    extra: dict = field(default_factory=dict)


def _name_match(
    text: str, catalog: dict[str, Procedure], allow_fuzzy: bool
) -> tuple[str, float] | None:
    name = _clean_name(text)
    if not name:
        return None
    found = mentioned_procedures(name, catalog)
    if found:
        code = found[0]
        low = name.lower()
        if code == "D2140" and re.search(r"\b(2|two)[\s-]*surfaces?\b", low):
            alt = "D2150" if re.search(r"amalgam|silver", low) else "D2392"
            if alt in catalog:
                code = alt
        return code, 0.9
    if allow_fuzzy and len(name.split()) <= 6:
        hits = search_procedures(name, catalog)
        if hits and hits[0].score >= 0.6:
            return hits[0].procedure.code, round(min(0.9, 0.5 + 0.4 * hits[0].score), 2)
    return None


def _parse_rows(text: str, catalog: dict[str, Procedure]) -> list[_Row]:
    rows: list[_Row] = []
    ctx_phase: str | None = None
    ctx_urgency: Urgency | None = None
    for raw in text.splitlines():
        line = raw.strip().lstrip("-*•· \t")
        if not line:
            continue
        if _TOTAL_RE.search(line) or _LABEL_RE.search(line):
            continue
        if _DATE_RE.search(line):
            line = re.sub(r"\s+", " ", _DATE_RE.sub(" ", line)).strip()
        code_m = _CODE_RE.search(line)
        tooth = _tooth(line)
        fee = _fee(line, allow_bare=bool(code_m or tooth))
        has_signal = bool(code_m or tooth or fee is not None)
        if _PHASE_RE.search(line) and not has_signal:
            ctx_phase = _phase_text(line)
            ctx_urgency = _urgency_from_text(line)
            continue

        code: str | None = None
        confidence = 0.0
        if code_m:
            c = f"D{code_m.group(1)}"
            if c in catalog:
                code, confidence = c, 1.0
        if code is None:
            nm = _name_match(line, catalog, has_signal) if has_signal else None
            if nm:
                code, confidence = nm
        if code is None and not has_signal:
            continue  # heading, prose or blank-ish line

        urgency = _urgency_from_text(line) or ctx_urgency or "flexible"
        phase = _phase_text(line) or ctx_phase
        rows.append(
            _Row(
                line=line, tooth=tooth, fee=fee, urgency=urgency, phase=phase,
                code=code, confidence=confidence, name=_clean_name(line) or line,
            )
        )
    return rows


def _row_to_item(row: _Row, idx: int, catalog: dict[str, Procedure]) -> ParsedTreatment:
    proc = catalog[row.code] if row.code else None
    return ParsedTreatment(
        id=f"q{idx}",
        code=proc.code if proc else None,
        name=proc.name if proc else row.name,
        tooth=row.tooth,
        quoted_fee=row.fee,
        typical_fee=proc.fee_p50 if proc else None,
        urgency=row.urgency,
        phase=row.phase,
        matched=proc is not None,
        confidence=row.confidence if proc else 0.0,
        source_line=row.line,
    )


def _ollama_assist(rows: list[_Row], catalog: dict[str, Procedure]) -> bool:
    """Try to fill codes for unmatched rows. Returns True only if it contributed."""
    pending = [r for r in rows if r.code is None]
    if not pending:
        return False
    try:
        client = OllamaClient()
        if not client.is_available():
            return False
        options = ", ".join(f"{p.code} = {p.name}" for p in catalog.values())
        prompt = (
            "You read lines from a dental treatment plan. For each line, pick the best matching "
            "procedure code from this list, or null if none fits. Copy the fee only if it is "
            "written in the line. Reply with ONLY a JSON list like "
            '[{"line": "<exact line>", "code": "D1234", "fee": 100}].\n'
            f"Codes: {options}\nLines:\n" + "\n".join(r.line for r in pending)
        )
        reply = client.chat([{"role": "user", "content": prompt}])
        content = str((reply.get("message") or {}).get("content", ""))
        start, end = content.find("["), content.rfind("]")
        if start < 0 or end <= start:
            return False
        proposals = json.loads(content[start : end + 1])
        if not isinstance(proposals, list):
            return False
        by_line = {r.line: r for r in pending}
        used = False
        for p in proposals:
            if not isinstance(p, dict):
                continue
            row = by_line.get(str(p.get("line", "")).strip())
            code = str(p.get("code") or "").strip().upper()
            if row is None or row.code is not None or code not in catalog:
                continue
            row.code, row.confidence = code, 0.6
            fee = p.get("fee")
            if row.fee is None and isinstance(fee, (int, float)) and not isinstance(fee, bool) \
                    and float(fee) in _numbers_in(row.line):
                row.fee = float(fee)
            used = True
        return used
    except Exception:  # noqa: BLE001 - the assist is optional; never break parsing
        return False


def parse_treatment_plan(text: str, catalog: dict[str, Procedure]) -> TreatmentPlanParseResponse:
    rows = _parse_rows(text, catalog)
    ai_used = _ollama_assist(rows, catalog)

    items: list[ParsedTreatment] = []
    unmatched: list[str] = []
    for row in rows:
        if row.code is None:
            unmatched.append(row.line)
        else:
            items.append(_row_to_item(row, len(items) + 1, catalog))

    notes: list[str] = []
    dep_notes: list[str] = []
    for crown in items:
        if crown.code != CROWN or not crown.tooth:
            continue
        rc = next((i for i in items if i.code == ROOT_CANAL and i.tooth == crown.tooth), None)
        if rc:
            crown.after = rc.id
            dep_notes.append(
                f"On tooth {crown.tooth}, the crown comes after the root canal, so we put them in that order."
            )

    total = len(items) + len(unmatched)
    if total == 0:
        notes.append("We couldn't find any treatments in that text. Try pasting one line per procedure.")
    else:
        notes.append(f"We matched {len(items)} of {total} {'line' if total == 1 else 'lines'}.")
    if unmatched:
        notes.append("Lines we couldn't read are listed below. Ask your dentist's office what they are.")
    notes.extend(dep_notes)
    if ai_used:
        notes.append("A local AI helped read some lines. We double-checked its answers against our list.")

    return TreatmentPlanParseResponse(
        items=items,
        unmatched_lines=unmatched,
        notes=notes,
        mode="ollama" if ai_used else "rules",
    )
