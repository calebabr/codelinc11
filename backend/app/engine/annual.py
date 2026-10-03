"""Apply a list of procedures in order through one plan year."""
from __future__ import annotations

from ..models import EstimateResult, Plan, Procedure, Usage
from .estimate import estimate


def run_year(procs: list[Procedure], plan: Plan, usage: Usage) -> tuple[list[EstimateResult], Usage]:
    u = usage.model_copy(deep=True)
    results: list[EstimateResult] = []
    for proc in procs:
        r = estimate(proc, plan, u, in_network=True)
        results.append(r)
        u.deductible_met = round(u.deductible_met + r.deductible_applied, 2)
        u.max_used = round(u.max_used + r.plan_pays, 2)
        u.history.append(proc.code)
    return results, u
