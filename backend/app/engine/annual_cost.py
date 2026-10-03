"""Yearly cost for a plan tier: premiums plus expected care, per person.

Each covered person has their own deductible, annual maximum and frequency
counts (nobody shares one maximum). All money math is done here, in order,
through the same estimate engine the rest of the product uses.
"""
from __future__ import annotations

from ..models import (
    AnnualCostPerson,
    AnnualCostRequest,
    AnnualCostResponse,
    Plan,
    Procedure,
    Usage,
)
from .annual import run_year
from .estimate import estimate, money


def annual_cost(req: AnnualCostRequest, plan: Plan, catalog: dict[str, Procedure]) -> AnnualCostResponse:
    procs: list[Procedure] = []
    for item in req.expected_care:
        proc = catalog.get(item.code)
        if proc is None:
            raise KeyError(item.code)
        procs.extend([proc] * item.count)

    premiums = round(plan.monthly_premium * 12 * req.covered_people, 2)
    per_person: list[AnnualCostPerson] = []
    for n in range(1, req.covered_people + 1):
        if req.in_network:
            results, end = run_year(procs, plan, Usage())
            plan_pays = round(sum(r.plan_pays for r in results), 2)
            you_pay = round(sum(r.you_pay for r in results), 2)
        else:
            u = Usage()
            plan_pays = you_pay = 0.0
            for proc in procs:
                r = estimate(proc, plan, u, in_network=False)
                u.deductible_met = round(u.deductible_met + r.deductible_applied, 2)
                u.max_used = round(u.max_used + r.plan_pays, 2)
                u.history.append(proc.code)
                plan_pays += r.plan_pays
                you_pay += r.you_pay
            plan_pays, you_pay, end = round(plan_pays, 2), round(you_pay, 2), u
        per_person.append(AnnualCostPerson(person=n, plan_pays=plan_pays, you_pay=you_pay,
                                           max_used_end=round(end.max_used, 2)))

    care_total = round(sum(p.you_pay for p in per_person), 2)
    assumptions = [
        (f"Premium is {money(plan.monthly_premium)} a month for each covered person, "
         f"{req.covered_people} person(s), 12 months."),
        "Each person has their own deductible and yearly maximum. Nothing is shared.",
        ("Expected care is the same list for every covered person, done in the order given, "
         "starting with nothing used this plan year."),
        ("Care is priced at typical in-network fees." if req.in_network else
         "Care is priced at out-of-network charges; you pay any difference above what the plan allows."),
    ]
    return AnnualCostResponse(
        tier_id=plan.id, tier_name=plan.name, covered_people=req.covered_people, premiums=premiums,
        plan_pays=round(sum(p.plan_pays for p in per_person), 2), out_of_pocket_care=care_total,
        total_cost=round(premiums + care_total, 2), per_person=per_person, assumptions=assumptions)
