"""Benefits status: what is left in the plan year."""
from __future__ import annotations

from ..models import BenefitsStatus, FrequencyStatus, Plan, Procedure, Usage
from .estimate import money


def benefits_status(plan: Plan, usage: Usage, catalog: dict[str, Procedure],
                    current_month: int) -> BenefitsStatus:
    max_remaining = round(max(plan.annual_max - usage.max_used, 0), 2)
    ded_remaining = round(max(plan.deductible - usage.deductible_met, 0), 2)
    freqs: list[FrequencyStatus] = []
    unused_value = 0.0
    preventive_left = False
    for code, limit in plan.frequency.items():
        used = usage.history.count(code)
        remaining = max(limit - used, 0)
        proc = catalog.get(code)
        freqs.append(FrequencyStatus(code=code, name=proc.name if proc else code,
                                     used=used, limit=limit, remaining=remaining))
        if proc and proc.category == "preventive" and remaining > 0:
            preventive_left = True
            unused_value += remaining * proc.fee_p50
    months_left = 12 - current_month + 1
    reminder = None
    if current_month >= 10 and (max_remaining > 0 or preventive_left):
        parts = []
        if max_remaining > 0:
            parts.append(f"you still have {money(max_remaining)} of your yearly maximum")
        if preventive_left:
            parts.append(f"about {money(unused_value)} of covered checkups and cleanings")
        reminder = (f"Your benefits reset soon: {months_left} month(s) left, and " + " and ".join(parts)
                    + " that will not carry over. Book your visits before the year ends.")
    return BenefitsStatus(
        plan_name=plan.name, annual_max=plan.annual_max, max_used=round(usage.max_used, 2),
        max_remaining=max_remaining, deductible=plan.deductible,
        deductible_met=round(usage.deductible_met, 2), deductible_remaining=ded_remaining,
        frequencies=freqs, unused_preventive_value=round(unused_value, 2),
        months_left=months_left, reminder=reminder)
