"""Single-procedure cost estimate. All money math lives in app/engine/."""
from __future__ import annotations

from ..models import EstimateResult, Plan, Procedure, TraceStep, Usage


def money(x: float) -> str:
    """Format dollars for plain-English notes: $1,200 or $12.50."""
    x = round(x, 2)
    return f"${x:,.0f}" if x == int(x) else f"${x:,.2f}"


def estimate(proc: Procedure, plan: Plan, usage: Usage, in_network: bool = True) -> EstimateResult:
    allowed = round(proc.fee_p50, 2)
    billed = allowed if in_network else round(proc.fee_p80, 2)
    balance_bill = round(billed - allowed, 2)
    trace: list[TraceStep] = []

    if in_network:
        trace.append(TraceStep(
            label="Typical cost", amount=billed,
            note=f"A {proc.name.lower()} typically costs {money(billed)} at a dentist in your plan's network."))
    else:
        trace.append(TraceStep(
            label="Dentist's charge", amount=billed,
            note=f"An out-of-network dentist typically charges about {money(billed)} for a {proc.name.lower()}."))
        trace.append(TraceStep(
            label="Amount your plan bases its payment on", amount=allowed,
            note=f"Your plan only counts {money(allowed)} of that, the amount it approves for this care."))

    limit = plan.frequency.get(proc.code)
    if limit is not None and usage.history.count(proc.code) >= limit:
        trace.append(TraceStep(
            label="Frequency limit reached", amount=0,
            note=(f"Your plan covers {proc.name.lower()} up to {limit} time(s) per plan year, "
                  "and you have already used that, so the plan pays nothing for this visit.")))
        trace.append(TraceStep(label="You pay", amount=billed,
                               note=f"You would pay the full {money(billed)}."))
        return EstimateResult(
            code=proc.code, name=proc.name, category=proc.category, in_network=in_network,
            covered=False, billed=billed, allowed=allowed, deductible_applied=0.0, plan_pays=0.0,
            you_pay=billed, balance_bill=balance_bill, max_used_after=round(usage.max_used, 2),
            trace=trace)

    if proc.category in plan.deductible_waived_for:
        deductible = 0.0
        trace.append(TraceStep(
            label="Deductible", amount=0,
            note="No deductible for this type of care. (A deductible is what you pay first, before the plan pays.)"))
    else:
        deductible = round(min(max(plan.deductible - usage.deductible_met, 0), allowed), 2)
        if deductible > 0:
            note = (f"You pay the first {money(deductible)} of your {money(plan.deductible)} deductible "
                    "(the amount you pay before the plan starts paying).")
        else:
            note = "You have already met your deductible, so nothing is taken off here."
        trace.append(TraceStep(label="Deductible", amount=deductible, note=note))

    rate = plan.coinsurance.get(proc.category, 0.0)
    covered_amt = round((allowed - deductible) * rate, 2)
    pct = f"{rate * 100:g}%"
    trace.append(TraceStep(
        label=f"Plan share ({pct})", amount=covered_amt,
        note=(f"Your plan pays {pct} of the remaining {money(allowed - deductible)} "
              f"for {proc.category} care, which is {money(covered_amt)}.")))

    remaining = round(max(plan.annual_max - usage.max_used, 0), 2)
    plan_pays = round(min(covered_amt, remaining), 2)
    if plan_pays < covered_amt:
        trace.append(TraceStep(
            label="Yearly maximum limit", amount=plan_pays,
            note=(f"Your plan only has {money(remaining)} left of its {money(plan.annual_max)} yearly "
                  f"maximum, so it pays {money(plan_pays)} instead of {money(covered_amt)}.")))

    you_pay = round(billed - plan_pays, 2)
    if balance_bill > 0:
        trace.append(TraceStep(
            label="Balance billing", amount=balance_bill,
            note=(f"Out-of-network dentists can bill the {money(balance_bill)} difference "
                  "between their charge and the amount your plan approves.")))
    trace.append(TraceStep(
        label="You pay", amount=you_pay,
        note=f"{money(billed)} minus the plan's {money(plan_pays)} leaves {money(you_pay)} for you."))

    return EstimateResult(
        code=proc.code, name=proc.name, category=proc.category, in_network=in_network,
        covered=True, billed=billed, allowed=allowed, deductible_applied=deductible,
        plan_pays=plan_pays, you_pay=you_pay, balance_bill=balance_bill,
        max_used_after=round(usage.max_used + plan_pays, 2), trace=trace)
