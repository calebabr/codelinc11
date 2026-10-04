"""Provider directory (sprint 2, B3): synthetic dentists, in or out of network for the household's
current plan, with distance from a ZIP code and an optional engine estimate.

GET /providers           search near a ZIP (sorted by distance, at most 50)
GET /providers/{id}      one provider (same fields; distance only when a ZIP is known)

Providers and ZIP centres are global reference data (migration 008). Distances are straight-line
haversine miles between approximate ZIP centres, so they are demo grade. Estimates use the
engine with the member's current usage and the household's current plan; the engine prices a
procedure with the plan's typical in-network fee or typical out-of-network charge, so
provider specific fees are not modeled.
"""
from __future__ import annotations

import math
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query

from .. import ratelimit
from ..data import load_catalog, load_plans
from ..engine.estimate import estimate
from ..models import ProviderEstimate, ProviderOut, Usage
from .session import StoreDep, Viewer, guarded

router = APIRouter(tags=["providers"])

MAX_RESULTS = 50
EARTH_RADIUS_MI = 3958.8
SPECIALTIES = ("general", "pediatric", "orthodontics", "oral_surgery", "endodontics", "periodontics")
UNKNOWN_ZIP = "We do not have that ZIP code in the demo. Try 36830, 30303, 19087, 46802 or 27401."
NOTE_IN = ("Estimate uses your plan's typical in-network fee. Provider specific fees are not modeled. "
           "This is an estimate. Your actual cost depends on your dentist's charges and claim review.")
NOTE_OUT = ("Estimate uses a typical out-of-network charge, and the plan pays on its in-network allowed "
            "amount, so you may owe the difference (balance billing). Provider specific fees are not "
            "modeled. This is an estimate. Your actual cost depends on your dentist's charges and claim review.")


def haversine_mi(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = (math.sin((p2 - p1) / 2) ** 2
         + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2)
    return 2 * EARTH_RADIUS_MI * math.asin(math.sqrt(a))


def _origin(store, zip_code: str | None, member: dict[str, Any]) -> dict[str, Any] | None:
    z = (zip_code or "").strip() or member.get("zip")
    if not z:
        raise HTTPException(status_code=422, detail=UNKNOWN_ZIP)
    c = store.zip_centroid(z) if len(z) == 5 and z.isascii() and z.isdigit() else None
    if c is None:
        raise HTTPException(status_code=422, detail=UNKNOWN_ZIP)
    return c


def _context(store, viewer: str, member_id: str | None, code: str | None):
    """The member, the household's current plan tier id and (with a code) the engine inputs."""
    mid = member_id or viewer
    member = guarded(lambda: store.get_member(viewer, mid))
    tier = guarded(lambda: store.household_plan_id(viewer, mid))
    ctx = None
    if code:
        proc = load_catalog().get(code)
        if proc is None:
            raise HTTPException(status_code=404, detail=f"Unknown procedure code '{code}'")
        plan = load_plans().get(tier)
        if plan is None:
            raise HTTPException(status_code=404, detail=f"No plan data for tier '{tier}'")
        u = guarded(lambda: store.get_member_usage(viewer, mid))
        usage = Usage(max_used=u["max_used_cents"] / 100, deductible_met=u["deductible_met_cents"] / 100,
                      history=["D1110"] * u["cleanings_used"])
        ctx = (proc, plan, usage)
    return member, tier, ctx


def _out(p: dict[str, Any], tier: str, origin: dict[str, Any] | None, ctx) -> ProviderOut:
    in_net = tier in p["network_plan_ids"]
    dist = None
    if origin is not None:
        dist = round(haversine_mi(origin["lat"], origin["lon"], p["lat"], p["lon"]), 1)
    est = None
    if ctx is not None:
        proc, plan, usage = ctx
        r = estimate(proc, plan, usage, in_net)
        note = NOTE_IN if in_net else NOTE_OUT
        if not r.covered:
            note = "A plan limit means this is not covered right now. " + note
        est = ProviderEstimate(you_pay=r.you_pay, plan_pays=r.plan_pays, in_network=in_net,
                               balance_bill=r.balance_bill, note=note)
    return ProviderOut(**{k: p[k] for k in (
        "id", "practice_name", "dentist_name", "specialty", "address", "city", "state", "zip",
        "lat", "lon", "phone", "accepting_new", "languages", "network_plan_ids")},
        distance_mi=dist, in_network=in_net, estimate=est)


@router.get("/providers", response_model=list[ProviderOut], dependencies=[Depends(ratelimit.limit_compute)])
def search_providers(
    viewer: Viewer, store: StoreDep,
    zip: Annotated[str | None, Query(max_length=10)] = None,
    radius_mi: Annotated[float, Query(ge=1, le=100)] = 25,
    network: Literal["all", "in", "out"] = "all",
    specialty: Annotated[str | None, Query(max_length=20)] = None,
    accepting: bool = False,
    q: Annotated[str | None, Query(max_length=80)] = None,
    code: Annotated[str | None, Query(max_length=10)] = None,
    member_id: Annotated[str | None, Query(max_length=80)] = None,
) -> list[ProviderOut]:
    """Providers near a ZIP, nearest first (at most 50). `network` is relative to the household's
    CURRENT plan. `accepting=true` keeps only practices taking new patients. `q` matches the
    practice or dentist name. With `code`, each result carries the engine's estimate for this
    member. 401 without a token, 403 for a member you may not see, 422 for an unknown ZIP."""
    if specialty and specialty not in SPECIALTIES:
        raise HTTPException(status_code=422, detail="Specialty must be one of: " + ", ".join(SPECIALTIES) + ".")
    member, tier, ctx = _context(store, viewer, member_id, code)
    origin = _origin(store, zip, member)
    needle = (q or "").strip().lower()
    found: list[tuple[float, str, ProviderOut]] = []
    for p in store.list_providers():
        if specialty and p["specialty"] != specialty:
            continue
        if accepting and not p["accepting_new"]:
            continue
        if needle and needle not in p["practice_name"].lower() and needle not in p["dentist_name"].lower():
            continue
        in_net = tier in p["network_plan_ids"]
        if (network == "in" and not in_net) or (network == "out" and in_net):
            continue
        d = haversine_mi(origin["lat"], origin["lon"], p["lat"], p["lon"])
        if round(d, 1) > radius_mi:
            continue
        found.append((d, p["id"], _out(p, tier, origin, ctx)))
    found.sort(key=lambda t: (t[0], t[1]))
    return [t[2] for t in found[:MAX_RESULTS]]


@router.get("/providers/{provider_id}", response_model=ProviderOut,
            dependencies=[Depends(ratelimit.limit_compute)])
def get_provider(
    provider_id: str, viewer: Viewer, store: StoreDep,
    zip: Annotated[str | None, Query(max_length=10)] = None,
    code: Annotated[str | None, Query(max_length=10)] = None,
    member_id: Annotated[str | None, Query(max_length=80)] = None,
) -> ProviderOut:
    """One provider. `distance_mi` is filled when a ZIP is given (or the member has a known profile
    ZIP); `estimate` when `code` is given. 404 for an unknown id."""
    p = guarded(lambda: store.get_provider(provider_id))
    member, tier, ctx = _context(store, viewer, member_id, code)
    origin = None
    if (zip or "").strip():
        origin = _origin(store, zip, member)
    elif member.get("zip"):
        origin = store.zip_centroid(member["zip"])
    return _out(p, tier, origin, ctx)
