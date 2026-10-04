"""Money helpers for the Reports page (claims, EOBs and copay-style visits).

The documents are SYNTHETIC. Their amounts are stored exactly as the document gave them, as
integer cents. Nothing here recomputes what a plan "should" have paid. The only arithmetic is:
  * parsing a written amount ("1,200.50") into integer cents,
  * adding up stored values for the totals,
  * checking that the stored lines of one document add up (so a made-up document that
    contradicts itself is caught before it is saved or explained).
Pure functions: no files, no network, no web code.
"""
from __future__ import annotations

import re
from collections.abc import Iterable, Mapping
from decimal import Decimal, InvalidOperation
from typing import Any

# Keys in a stored document's data, all integer cents.
CENT_FIELDS = ("billed_cents", "allowed_cents", "deductible_applied_cents", "coinsurance_cents",
               "copay_cents", "plan_paid_cents", "you_owe_cents", "balance_billing_cents")

MAX_CENTS = 99_999_999  # $999,999.99
_AMOUNT_RE = re.compile(r"^\$?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$")


def parse_amount_cents(text: str) -> int | None:
    """"$1,200.5" -> 120050. None when the text is not a plain non-negative amount (or is too big)."""
    m = _AMOUNT_RE.match(text.strip())
    if m is None:
        return None
    try:
        cents = int((Decimal(m.group(1).replace(",", "")) * 100).to_integral_value())
        cents += int((m.group(2) or "0").ljust(2, "0"))
    except InvalidOperation:
        return None
    return cents if cents <= MAX_CENTS else None


def to_dollars(cents: int | None) -> float | None:
    return None if cents is None else round(cents / 100, 2)


def _c(data: Mapping[str, Any], key: str) -> int:
    v = data.get(key)
    return int(v) if isinstance(v, int) and not isinstance(v, bool) else 0


def lines_problems(kind: str, data: Mapping[str, Any]) -> list[str]:
    """Plain descriptions of lines that do not add up (empty list when the document is consistent).

    EOB:   allowed - deductible - coinsurance = plan paid
           deductible + coinsurance + balance billing = you owe
           balance billing is billed - allowed for an out-of-network dentist and 0 in network
    Copay: plan paid + you owe = allowed, and you owe = the copay
    Claims and 'other' documents carry no breakdown to check.
    """
    out: list[str] = []
    if kind == "eob":
        if _c(data, "allowed_cents") - _c(data, "deductible_applied_cents") - _c(data, "coinsurance_cents") \
                != _c(data, "plan_paid_cents"):
            out.append("allowed amount, deductible and coinsurance do not add up to what the plan paid")
        if _c(data, "deductible_applied_cents") + _c(data, "coinsurance_cents") \
                + _c(data, "balance_billing_cents") != _c(data, "you_owe_cents"):
            out.append("deductible, coinsurance and balance billing do not add up to what you owe")
        bb = _c(data, "balance_billing_cents")
        if bb and _c(data, "billed_cents") - _c(data, "allowed_cents") != bb:
            out.append("balance billing is not the difference between billed and allowed")
        if not bb and _c(data, "billed_cents") < _c(data, "allowed_cents"):
            out.append("the allowed amount is more than the billed amount")
    elif kind == "copay":
        if _c(data, "plan_paid_cents") + _c(data, "you_owe_cents") != _c(data, "allowed_cents"):
            out.append("plan paid and you owe do not add up to the allowed amount")
        if _c(data, "you_owe_cents") != _c(data, "copay_cents"):
            out.append("what you owe is not the copay")
    return out


def lines_add_up(kind: str, data: Mapping[str, Any]) -> bool:
    return not lines_problems(kind, data)


def totals(items: Iterable[Mapping[str, Any]]) -> dict[str, int]:
    """Totals in cents over the given report items (dicts with kind, paid_status and data in cents).

      billed         what dentists charged. A claim counts only when no EOB in the list has the same
                     claim number, so one visit is not counted twice.
      allowed        sum of the allowed amounts on EOBs and copay visits
      plan_paid      sum of what the plan paid on EOBs and copay visits
      you_paid       what you owe on documents already marked paid
      you_owe_open   what you owe on documents not yet marked paid
    """
    rows = list(items)
    eob_claims = {r["data"].get("claim_number") for r in rows
                  if r["kind"] == "eob" and r["data"].get("claim_number")}
    out = {"billed": 0, "allowed": 0, "plan_paid": 0, "you_paid": 0, "you_owe_open": 0}
    for r in rows:
        d = r["data"]
        if r["kind"] == "claim" and d.get("claim_number") in eob_claims:
            continue
        out["billed"] += _c(d, "billed_cents")
        out["allowed"] += _c(d, "allowed_cents")
        out["plan_paid"] += _c(d, "plan_paid_cents")
        if r["paid_status"] == "paid":
            out["you_paid"] += _c(d, "you_owe_cents")
        elif r["paid_status"] == "unpaid":
            out["you_owe_open"] += _c(d, "you_owe_cents")
    return out
