"""Which dentist is a quote from? (sprint 2, B4, story 7)

Matches the header of a pasted dentist quote against the synthetic provider directory (the "insurer
directory"): by phone number, by practice name, or by dentist name together with the ZIP code. A ZIP
code alone is never enough. A quote from a practice we cannot find is said to be unmatched and is
priced as out of network. Also holds the three synthetic sample quotes. No money math here.
"""
from __future__ import annotations

import re
from typing import Any

from .models import ProviderMatch, TreatmentPlanSample

HEADER_LINES = 20                       # only the top of the quote is read for the practice
_PHONE_RE = re.compile(r"(?<!\d)\(?(\d{3})\)?[-.\s]*(\d{3})[-.\s]*(\d{4})(?!\d)")
_ZIP_RE = re.compile(r"(?<!\d)(\d{5})(?!\d)")
_TIERS = {"basic", "preferred", "premium"}

UNMATCHED_NOTE = ("We could not find this practice in the insurer directory, so we priced this quote as "
                  "out of network to be safe. Call your plan to check if the dentist is in network.")


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def _header(text: str) -> str:
    return "\n".join([ln for ln in text.splitlines() if ln.strip()][:HEADER_LINES])


def find_provider(text: str, providers: list[dict[str, Any]]) -> dict[str, Any] | None:
    head = _header(text)
    padded = f" {_norm(head)} "
    phones = {"".join(m.groups()) for m in _PHONE_RE.finditer(head)}
    zips = set(_ZIP_RE.findall(head))
    by_phone = [p for p in providers if re.sub(r"\D", "", p["phone"]) in phones]
    by_name = [p for p in providers if f" {_norm(p['practice_name'])} " in padded]
    both = [p for p in by_phone if p in by_name]
    if both:
        return both[0]
    if by_phone:
        return by_phone[0]
    if by_name:
        return max(by_name, key=lambda p: len(p["practice_name"]))
    for p in providers:
        dentist = _norm(re.sub(r"^dr\.?\s+", "", p["dentist_name"], flags=re.IGNORECASE))
        if dentist and f" {dentist} " in padded and p["zip"] in zips:
            return p
    return None


def match_provider(text: str, providers: list[dict[str, Any]], plan_id: str | None) -> ProviderMatch:
    """`plan_id` is a plan tier id (basic, preferred, premium) when the caller knows the plan."""
    p = find_provider(text, providers)
    if p is None:
        return ProviderMatch(matched=False, in_network=False, network_note=UNMATCHED_NOTE)
    address = f"{p['address']}, {p['city']}, {p['state']} {p['zip']}"
    in_net: bool | None = None
    if plan_id in p["network_plan_ids"]:
        in_net = True
    elif plan_id in _TIERS:
        in_net = False
    if in_net is True:
        note = f"{p['practice_name']} is in your plan's network (insurer directory). Estimates use in-network prices."
    elif in_net is False:
        note = (f"{p['practice_name']} is out of network for your plan (insurer directory). Estimates use "
                "out-of-network prices, and you may owe the difference between the dentist's charge and "
                "what your plan allows (balance billing).")
    else:
        note = (f"{p['practice_name']} is in the insurer directory. Choose your plan to see if it is in your "
                "plan's network.")
    return ProviderMatch(matched=True, provider_id=p["id"], name=p["practice_name"], dentist=p["dentist_name"],
                         address=address, in_network=in_net, network_note=note)


def _quote(practice: str, dentist: str, address: str, phone: str, items: list[str]) -> str:
    head = [practice, f"Dentist: {dentist}", f"Address: {address}", f"Phone: {phone}",
            "Treatment plan for: AC (made-up sample)", ""]
    return "\n".join(head + items) + "\n"


_SAMPLES = [
    TreatmentPlanSample(
        id="sample-quote-in-network", title="Quote from an in-network practice", expected_network="in",
        description="A quote from a practice in your plan's network, so estimates use in-network prices.",
        text=_quote("Plainsman Family Dental", "Dr. Priya Nair", "1204 Heartwood Lane, Auburn, AL 36830",
                    "334-555-0101",
                    ["Phase 1 - urgent", "D3330 Root canal, molar, tooth 30 - $1,150",
                     "Phase 2", "D2740 Crown, porcelain, tooth 30 - $1,250",
                     "D2392 Filling, 2 surfaces, tooth 14 - $210"])),
    TreatmentPlanSample(
        id="sample-quote-out-of-network", title="Quote from an out-of-network practice", expected_network="out",
        description="A quote from a practice that is not in your plan's network, so you may owe more.",
        text=_quote("Magnolia Row Oral Surgery", "Dr. Lena Whitfield", "73 Fenwick Street, Opelika, AL 36804",
                    "334-555-0105",
                    ["Phase 1 - urgent", "D3330 Root canal, molar, tooth 19 - $1,400",
                     "Phase 2", "D2740 Crown, porcelain, tooth 19 - $1,500"])),
    TreatmentPlanSample(
        id="sample-quote-unknown", title="Quote from a practice we can't find", expected_network="unknown",
        description="A quote from a practice that is not in the directory, so we price it as out of network.",
        text=_quote("Brightwater Dental Studio", "Dr. Casey Hollis", "9 Rivermist Road, Auburn, AL 36832",
                    "334-555-0199",
                    ["D2392 Filling, 2 surfaces, tooth 3 - $240", "D1110 Cleaning (adult) - $130"])),
]


def list_quote_samples() -> list[TreatmentPlanSample]:
    return [s.model_copy() for s in _SAMPLES]
