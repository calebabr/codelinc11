"""Monte Carlo plan comparison: which plan costs a household the least across many possible years.

Method (full write-up in docs/MATH.md):
- Each simulated year, every person gets a list of procedure codes: two exams and two cleanings,
  Poisson counts of fillings, root canals, crowns and extractions (rates by care level), and any
  "known care" the family told us about. Rates are synthetic placeholders, not claims data.
- Common random numbers: every person's year is drawn once (fixed person order, one seeded
  generator) and then priced under every plan. Nothing is reseeded per plan.
- Pricing uses the existing engine only (`run_year()` in network, `estimate(..., in_network=False)`
  out of network), one person at a time, because each person has their own deductible, yearly
  maximum and frequency limits. No new money formulas live here. A household total is
  12 x monthly premium x people plus what the people pay.
- A person's year is a list of codes in a canonical order (preventive, basic, major, then by code),
  so the cost under a plan depends only on (plan, in_network, codes) and is cached per request.
"""
from __future__ import annotations

import math
import random
from bisect import bisect_right
from collections.abc import Sequence

from ..models import (
    Plan,
    Procedure,
    SimulateMember,
    SimulatePlanResult,
    SimulateRequest,
    SimulateResponse,
    Usage,
)
from .annual import run_year
from .estimate import estimate, money

CATEGORY_RANK = {"preventive": 0, "basic": 1, "major": 2}
LEVEL_RANK = {"low": 0, "average": 1, "high": 2}
LEVELS = ("low", "average", "high")
CHILD_AGE = 13                       # under this age: sealants instead of fillings

EXAM, CLEANING, SEALANT = "D0120", "D1110", "D1351"
FILLING, ROOT_CANAL, CROWN, EXTRACTION = "D2392", "D3330", "D2740", "D7140"

# Yearly Poisson rates per person (synthetic placeholders; M to review). Exams and cleanings are
# two a year at every level. Order of the tuple = the order the numbers are drawn in.
RATES: dict[str, dict[str, float]] = {
    "low":     {FILLING: 0.2, ROOT_CANAL: 0.02, CROWN: 0.03, EXTRACTION: 0.02},
    "average": {FILLING: 0.6, ROOT_CANAL: 0.05, CROWN: 0.10, EXTRACTION: 0.05},
    "high":    {FILLING: 1.5, ROOT_CANAL: 0.15, CROWN: 0.40, EXTRACTION: 0.10},
}
PREVENTIVE_VISITS = 2
PERCENTILES = (10, 50, 90)

DISCLAIMER = "This is an estimate. Your actual cost depends on your dentist's charges and claim review."
CATEGORY_WORDS = {"preventive": "checkups and cleanings", "basic": "fillings and other basic care",
                  "major": "crowns and other major work"}


class UnknownPlan(KeyError):
    """A plan id that is not in the catalog."""


class UnknownCode(KeyError):
    """A procedure code that is not in the catalog."""


# ---------------------------------------------------------------- sampling

def poisson(rng: random.Random, lam: float) -> int:
    """Knuth's method. Fine for the small rates used here."""
    if lam <= 0:
        return 0
    limit, k, p = math.exp(-lam), 0, 1.0
    while True:
        p *= rng.random()
        if p <= limit:
            return k
        k += 1


def rates_for(member: SimulateMember) -> dict[str, float]:
    """Poisson rates for one person. Children under 13 get sealants at the low restorative rate
    instead of fillings, and never use the 'high' level for root canals, crowns or extractions."""
    level = member.care_level
    if member.age < CHILD_AGE:
        capped = RATES[min(level, "average", key=LEVEL_RANK.__getitem__)]
        return {SEALANT: RATES["low"][FILLING], ROOT_CANAL: capped[ROOT_CANAL],
                CROWN: capped[CROWN], EXTRACTION: capped[EXTRACTION]}
    return dict(RATES[level])


def canonical(counts: dict[str, int], catalog: dict[str, Procedure]) -> tuple[str, ...]:
    """Codes in canonical order: preventive, basic, major, ties by code."""
    codes = sorted(counts, key=lambda c: (CATEGORY_RANK[catalog[c].category], c))
    return tuple(c for c in codes for _ in range(counts[c]))


def sample_household_years(members: Sequence[SimulateMember], n: int, seed: int,
                           catalog: dict[str, Procedure], *,
                           _zero_care: bool = False) -> list[list[tuple[str, ...]]]:
    """n simulated years; each is one tuple of codes per person (same order as `members`).

    `_zero_care` is for tests only: a household that needs no care at all.
    """
    rng = random.Random(seed)
    known: list[dict[str, int]] = []
    for m in members:
        k: dict[str, int] = {}
        for item in m.known_care:
            code = item.code.strip().upper()
            if code not in catalog:
                raise UnknownCode(code)
            k[code] = k.get(code, 0) + item.count
        known.append(k)
    rate_table = [rates_for(m) for m in members]

    years: list[list[tuple[str, ...]]] = []
    for _ in range(n):
        year: list[tuple[str, ...]] = []
        for i in range(len(members)):
            counts = dict(known[i])
            if not _zero_care:
                for code in (EXAM, CLEANING):
                    counts[code] = counts.get(code, 0) + PREVENTIVE_VISITS
                for code, lam in rate_table[i].items():
                    got = poisson(rng, lam)
                    if got:
                        counts[code] = counts.get(code, 0) + got
            year.append(canonical(counts, catalog))
        years.append(year)
    return years


# ---------------------------------------------------------------- pricing (engine only)

def price_person_year(plan: Plan, in_network: bool, codes: tuple[str, ...],
                      catalog: dict[str, Procedure]) -> tuple[float, dict[str, float]]:
    """What one person pays in one plan year for these codes, in order: (you_pay, you_pay by
    category). Starts with nothing used. Goes through run_year()/estimate() only."""
    procs = [catalog[c] for c in codes]
    by_cat = {"preventive": 0.0, "basic": 0.0, "major": 0.0}
    if in_network:
        results, _ = run_year(procs, plan, Usage())
    else:
        u, results = Usage(), []
        for proc in procs:
            r = estimate(proc, plan, u, in_network=False)
            u.deductible_met = round(u.deductible_met + r.deductible_applied, 2)
            u.max_used = round(u.max_used + r.plan_pays, 2)
            u.history.append(proc.code)
            results.append(r)
    for r in results:
        by_cat[r.category] += r.you_pay
    return round(sum(by_cat.values()), 2), {k: round(v, 2) for k, v in by_cat.items()}


# ---------------------------------------------------------------- statistics

def nearest_rank(sorted_values: Sequence[float], pct: float) -> float:
    """Nearest-rank percentile: the value at rank ceil(pct/100 x n) of the sorted list."""
    k = max(1, math.ceil(pct / 100 * len(sorted_values)))
    return sorted_values[k - 1]


def largest_remainder(counts: Sequence[int], total: int, tie_order: Sequence[int]) -> list[int]:
    """Whole-percent shares that add up to exactly 100. `tie_order` ranks equal remainders
    (earlier = first to get the extra point)."""
    exact = [c * 100 / total for c in counts]
    shares = [math.floor(x) for x in exact]
    left = 100 - sum(shares)
    order = sorted(range(len(counts)), key=lambda i: (-(exact[i] - shares[i]), tie_order[i]))
    for i in order[:left]:
        shares[i] += 1
    return shares


def bin_edges(lo: float, hi: float, target: int = 12) -> list[float]:
    """Rounded shared bin edges covering [lo, hi], about `target` bins."""
    if hi - lo <= 0:
        base = float(math.floor(lo))
        return [base, base + 1.0]
    raw = (hi - lo) / target
    mag = 10 ** math.floor(math.log10(raw))
    step = next(m * mag for m in (1, 2, 2.5, 5, 10) if m * mag >= raw - 1e-12)
    edges = [round(math.floor(lo / step) * step, 2)]
    while edges[-1] < hi:
        edges.append(round(edges[-1] + step, 2))
    return edges


def histogram(values: Sequence[float], edges: Sequence[float]) -> list[int]:
    counts = [0] * (len(edges) - 1)
    for v in values:
        counts[min(max(bisect_right(edges, v) - 1, 0), len(counts) - 1)] += 1
    return counts


# ---------------------------------------------------------------- the simulation

def simulate(req: SimulateRequest, plans: dict[str, Plan], catalog: dict[str, Procedure], *,
             _zero_care: bool = False) -> SimulateResponse:
    """Compare plans over `req.n` simulated years for the whole household.

    Raises UnknownPlan / UnknownCode (both KeyError) for ids not in the catalog.
    """
    plan_ids = list(dict.fromkeys(req.plan_ids)) if req.plan_ids else list(plans)
    if not plan_ids:
        raise UnknownPlan("(none)")
    for pid in plan_ids:
        if pid not in plans:
            raise UnknownPlan(pid)
    chosen = [plans[p] for p in plan_ids]
    people = len(req.members)
    n = req.n

    years = sample_household_years(req.members, n, req.seed, catalog, _zero_care=_zero_care)

    # Intern each distinct person-year, then price each distinct one once per plan.
    key_ids: dict[tuple[str, ...], int] = {}
    year_ids: list[list[int]] = []
    for year in years:
        year_ids.append([key_ids.setdefault(k, len(key_ids)) for k in year])
    keys = list(key_ids)

    premiums = [round(p.monthly_premium * 12 * people, 2) for p in chosen]
    totals: list[list[float]] = []                     # per plan, per simulated year
    by_cat: list[list[list[float]]] = []               # per plan, per distinct key: [pre, basic, major]
    for plan, prem in zip(chosen, premiums, strict=True):
        cost, cats = [], []
        for k in keys:
            you_pay, split = price_person_year(plan, req.in_network, k, catalog)
            cost.append(you_pay)
            cats.append([split["preventive"], split["basic"], split["major"]])
        by_cat.append(cats)
        totals.append([round(prem + sum(cost[i] for i in ids), 2) for ids in year_ids])

    # Winner of each year: lowest total; exact ties go to the lower premium, then the plan id.
    rank = sorted(range(len(chosen)), key=lambda j: (premiums[j], chosen[j].id))
    tie_pos = {j: r for r, j in enumerate(rank)}
    wins = [0] * len(chosen)
    for y in range(n):
        best = min(range(len(chosen)), key=lambda j: (totals[j][y], tie_pos[j]))
        wins[best] += 1
    shares = largest_remainder(wins, n, [tie_pos[j] for j in range(len(chosen))])

    lo = min(min(t) for t in totals)
    hi = max(max(t) for t in totals)
    edges = bin_edges(lo, hi)

    results: list[SimulatePlanResult] = []
    for j, plan in enumerate(chosen):
        s = sorted(totals[j])
        p10, p50, p90 = (nearest_rank(s, p) for p in PERCENTILES)
        results.append(SimulatePlanResult(
            plan_id=plan.id, name=plan.name, monthly_premium=plan.monthly_premium,
            premiums_total=premiums[j], mean=round(sum(s) / n, 2), median=p50, p10=p10, p90=p90,
            min=s[0], max=s[-1], cheapest_share=shares[j], histogram=histogram(s, edges)))

    best_j = min(range(len(chosen)), key=lambda j: (-wins[j], tie_pos[j]))
    return SimulateResponse(
        n=n, seed=req.seed, in_network=req.in_network, plans=results, bin_edges=edges,
        winner_plan_id=chosen[best_j].id,
        reasons=_reasons(chosen, results, totals, year_ids, by_cat, best_j),
        assumptions=_assumptions(req, people))


# ---------------------------------------------------------------- plain-language text

def _assumptions(req: SimulateRequest, people: int) -> list[str]:
    who = ", ".join(f"{(m.name or m.id).split()[0]}: {m.care_level}" for m in req.members)
    out = [
        "Odds are synthetic placeholders, not claims data. This is not a prediction for your family.",
        f"We simulated {req.n:,} possible years (seed {req.seed}) and priced the same years under every plan.",
        f"Care level for each person: {who}.",
        ("Everyone gets two exams and two cleanings a year. Fillings, root canals, crowns and "
         "extractions are random, more often at a higher care level."),
        f"Premiums are the monthly premium x 12 for each of the {people} covered person(s).",
        "Each person has their own deductible, yearly maximum and cleaning limits. Nothing is shared.",
        ("Care is priced at typical in-network fees." if req.in_network else
         "Care is priced at out-of-network charges; you pay any difference above what the plan allows."),
        "Results cover one plan year and ignore waiting periods and switching costs.",
    ]
    known = [f"{i.count} x {i.code.strip().upper()}" + (f" for {(m.name or m.id).split()[0]}" if len(req.members) > 1 else "")
             for m in req.members for i in m.known_care]
    if known:
        out.append("Known care is added to every simulated year: " + ", ".join(known) + ".")
    return out


def _reasons(chosen: list[Plan], results: list[SimulatePlanResult], totals: list[list[float]],
             year_ids: list[list[int]], by_cat: list[list[list[float]]], best_j: int) -> list[str]:
    reasons: list[str] = []
    winner = results[best_j]
    reasons.append(f"{winner.name} costs the least in {winner.cheapest_share}% of the simulated years. "
                   f"A typical year costs {money(winner.median)} in total, premiums included.")
    if len(chosen) < 2:
        return reasons

    cheap_prem = min(range(len(chosen)), key=lambda j: (results[j].premiums_total, chosen[j].id))
    rich_prem = max(range(len(chosen)), key=lambda j: (results[j].premiums_total, chosen[j].id))
    if results[rich_prem].premiums_total > results[cheap_prem].premiums_total:
        diff = round(results[rich_prem].premiums_total - results[cheap_prem].premiums_total, 2)
        reasons.append(f"{results[rich_prem].name} costs {money(diff)} more a year in premiums "
                       f"than {results[cheap_prem].name}.")

    # Bad year: compare the lowest-premium plan with whichever plan has the lowest 90th percentile.
    safest = min(range(len(chosen)), key=lambda j: (results[j].p90, chosen[j].id))
    if safest == cheap_prem:
        reasons.append(f"{results[safest].name} also has the lowest cost in a bad year "
                       f"(about 1 year in 10): {money(results[safest].p90)}.")
        return reasons
    gap = round(results[cheap_prem].p90 - results[safest].p90, 2)
    if gap > 0:
        reasons.append(f"In a bad year (about 1 year in 10) {results[cheap_prem].name} costs "
                       f"{money(results[cheap_prem].p90)} and {results[safest].name} costs "
                       f"{money(results[safest].p90)}.")
    # Which kind of care explains the difference in those bad years (average care spending
    # under each plan, over the years that are bad for the lowest-premium plan).
    bad = [y for y in range(len(year_ids)) if totals[cheap_prem][y] >= results[cheap_prem].p90]
    if bad:
        def avg(j: int, c: int) -> float:
            return sum(by_cat[j][i][c] for y in bad for i in year_ids[y]) / len(bad)
        diffs = {cat: avg(cheap_prem, c) - avg(safest, c) for c, cat in enumerate(CATEGORY_WORDS)}
        driver = max(diffs, key=lambda c: diffs[c])
        if diffs[driver] > 0:
            a, b = chosen[cheap_prem].coinsurance[driver], chosen[safest].coinsurance[driver]
            reasons.append(
                f"In those years the biggest difference is {CATEGORY_WORDS[driver]}: "
                f"{results[safest].name} pays {round(b * 100)}% of the allowed amount, "
                f"{results[cheap_prem].name} pays {round(a * 100)}%.")
    return reasons
