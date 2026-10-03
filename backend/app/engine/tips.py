"""Savings tips. All money math for the tips feature lives here.

Each tip carries `before` (cost without following it), `after` (cost if followed),
`saving = round(before - after, 2)`, plain-English `steps` and `assumptions`.
Tips with saving <= 0 are dropped; the rest are sorted by saving, largest first.
"""
from __future__ import annotations

from ..models import (
    EstimateResult,
    Plan,
    Procedure,
    SavingsTip,
    SavingsTipsRequest,
    SavingsTipsResponse,
    ScheduleRequest,
    TraceStep,
    TreatmentItem,
    Usage,
)
from .estimate import estimate, money
from .sequencer import best_schedule
from .status import benefits_status

MAX_ITEMS = 10
NOT_TAX_ADVICE = "This is an estimate, not tax or medical advice."


def _run(procs: list[Procedure], plan: Plan, usage: Usage, in_network: bool) -> list[EstimateResult]:
    """Apply procedures in order from `usage`, in or out of network (run_year is in-network only)."""
    u = usage.model_copy(deep=True)
    results: list[EstimateResult] = []
    for proc in procs:
        r = estimate(proc, plan, u, in_network=in_network)
        results.append(r)
        u.deductible_met = round(u.deductible_met + r.deductible_applied, 2)
        u.max_used = round(u.max_used + r.plan_pays, 2)
        u.history.append(proc.code)
    return results


def _tip(id_: str, kind: str, title: str, summary: str, before: float, after: float,
         steps: list[TraceStep], assumptions: list[str]) -> SavingsTip:
    before = round(before, 2)
    after = round(after, 2)
    return SavingsTip(id=id_, kind=kind, title=title, summary=summary,  # type: ignore[arg-type]
                      saving=round(before - after, 2), before=before, after=after,
                      steps=steps, assumptions=assumptions)


def _timing_tip(req: SavingsTipsRequest, plan: Plan, catalog: dict[str, Procedure]) -> SavingsTip | None:
    if not req.items or all(i.urgency == "urgent" for i in req.items):
        return None
    sched = best_schedule(
        ScheduleRequest(plan=plan, items=req.items, usage=req.usage, current_month=req.current_month),
        plan, catalog)
    if sched.savings <= 0:
        return None
    steps = [
        TraceStep(label="Doing everything now", amount=sched.baseline_you_pay,
                  note=f"If all your treatments happen this plan year you would pay {money(sched.baseline_you_pay)}."),
        TraceStep(label="Following the suggested timing", amount=sched.total_you_pay,
                  note=f"With the suggested timing you would pay {money(sched.total_you_pay)}."),
    ]
    steps += [TraceStep(label="Why", amount=0, note=reason) for reason in sched.reasons]
    steps.append(TraceStep(label="You save", amount=sched.savings,
                           note=f"{money(sched.baseline_you_pay)} minus {money(sched.total_you_pay)} "
                                f"is {money(sched.savings)}."))
    return _tip(
        "timing", "timing", "Time your care around your plan year",
        (f"Moving care that can safely wait into your next plan year lowers what you pay "
         f"from {money(sched.baseline_you_pay)} to {money(sched.total_you_pay)}."),
        sched.baseline_you_pay, sched.total_you_pay, steps,
        ["Only treatments your dentist says can safely wait are moved; urgent care stays in this plan year.",
         "Your plan year is assumed to reset in January with a fresh deductible and yearly maximum."])


def _network_tip(procs: list[Procedure], plan: Plan, usage: Usage) -> SavingsTip | None:
    if not procs:
        return None
    inn = _run(procs, plan, usage, True)
    oon = _run(procs, plan, usage, False)
    before = round(sum(r.you_pay for r in oon), 2)
    after = round(sum(r.you_pay for r in inn), 2)
    balance = round(sum(r.balance_bill for r in oon), 2)
    steps = [
        TraceStep(label="Out-of-network total you pay", amount=before,
                  note=f"Out-of-network dentists typically charge more, so you would pay about {money(before)}."),
        TraceStep(label="Balance billing", amount=balance,
                  note=(f"{money(balance)} of that is balance billing: the difference between the dentist's "
                        "charge and the amount your plan approves.")),
        TraceStep(label="In-network total you pay", amount=after,
                  note=f"In network, the same care would cost you about {money(after)}."),
        TraceStep(label="You save", amount=round(before - after, 2),
                  note=f"{money(before)} minus {money(after)} is {money(round(before - after, 2))}."),
    ]
    return _tip(
        "network", "network", "Choose a dentist in your plan's network",
        f"An in-network dentist could lower your cost from {money(before)} to {money(after)}.",
        before, after, steps,
        ["Out-of-network dentists are assumed to charge the typical higher (80th percentile) fee.",
         "Treatments are done in the order listed, starting from what you have already used this year.",
         "Check that your dentist is in network before you book."])


def _preventive_tip(plan: Plan, usage: Usage, catalog: dict[str, Procedure],
                    month: int) -> SavingsTip | None:
    status = benefits_status(plan, usage, catalog, month)
    value = status.unused_preventive_value
    if value <= 0:
        return None
    parts = [f"{f.remaining} x {f.name.lower()}" for f in status.frequencies
             if f.remaining > 0 and catalog.get(f.code) and catalog[f.code].category == "preventive"]
    steps = [
        TraceStep(label="Covered visits left", amount=value,
                  note=("Your plan still covers " + ", ".join(parts)
                        + f" this plan year, worth about {money(value)}.")),
        TraceStep(label="What you pay", amount=0,
                  note="Preventive care has no deductible and your plan pays it in full, so these visits cost you $0."),
        TraceStep(label="You save", amount=value,
                  note=f"Using them gets you {money(value)} of free covered care that expires at year end."),
    ]
    return _tip(
        "preventive", "preventive", "Use your free checkups and cleanings",
        f"You have about {money(value)} of free covered care left this plan year. Unused visits don't carry over.",
        value, 0.0, steps,
        ["Assumes the plan pays preventive visits in full, as the plan's coverage rate says.",
         "Value is the typical in-network fee of each remaining covered visit."])


def _alternative_tips(items: list[TreatmentItem], procs: list[Procedure], plan: Plan,
                      usage: Usage, catalog: dict[str, Procedure]) -> list[SavingsTip]:
    tips: list[SavingsTip] = []
    for item, proc in zip(items, procs, strict=True):
        for alt_code in proc.alternative_codes:
            alt = catalog.get(alt_code)
            if alt is None:
                continue
            chosen = estimate(proc, plan, usage, True)
            other = estimate(alt, plan, usage, True)
            after = other.you_pay
            if plan.alternate_benefit:
                before = round(chosen.billed - other.plan_pays, 2)
                before_note = (f"Your plan only pays what it would pay for the {alt.name.lower()} "
                               f"({money(other.plan_pays)}), so you pay {money(chosen.billed)} minus that, "
                               f"which is {money(before)}.")
            else:
                before = chosen.you_pay
                before_note = (f"Your plan pays {money(chosen.plan_pays)} toward the {proc.name.lower()}, "
                               f"so you pay {money(before)}.")
            steps = [
                TraceStep(label=f"{proc.name}: you pay", amount=before, note=before_note),
                TraceStep(label=f"{alt.name}: you pay", amount=after,
                          note=(f"The {alt.name.lower()} costs {money(other.billed)} and your plan pays "
                                f"{money(other.plan_pays)}, so you pay {money(after)}.")),
                TraceStep(label="You save", amount=round(before - after, 2),
                          note=f"{money(before)} minus {money(after)} is {money(round(before - after, 2))}."),
            ]
            tips.append(_tip(
                f"alternative-{item.id}-{alt_code}", "alternative",
                f"Ask about a {alt.name.lower()} instead of a {proc.name.lower()}",
                f"If a {alt.name.lower()} is right for the tooth, you would pay {money(after)} instead of {money(before)}.",
                before, after, steps,
                ["Only if your dentist agrees the less expensive option is right for the tooth.",
                 ("Your plan has an 'alternate benefit' rule: it pays only what it would for the cheaper option."
                  if plan.alternate_benefit else
                  "Your plan pays its normal share of whichever option you choose."),
                 "Estimated in network, starting from what you have used so far this year."]))
    return tips


def _fsa_tip(procs: list[Procedure], plan: Plan, usage: Usage, tax_rate: float) -> SavingsTip | None:
    if not procs:
        return None
    results = _run(procs, plan, usage, True)
    before = round(sum(r.you_pay for r in results), 2)
    if before <= 0:
        return None
    after = round(before * (1 - tax_rate), 2)
    pct = f"{tax_rate * 100:g}%"
    steps = [
        TraceStep(label="Your cost in network", amount=before,
                  note=f"Your share of these treatments in network is about {money(before)}."),
        TraceStep(label=f"Tax rate ({pct})", amount=round(before * tax_rate, 2),
                  note=f"Money you put into an FSA or HSA is set aside before tax, so at {pct} you avoid "
                       f"about {money(round(before * tax_rate, 2))} of tax."),
        TraceStep(label="Effective cost", amount=after,
                  note=f"{money(before)} times (1 minus {pct}) is {money(after)}."),
    ]
    return _tip(
        "fsa_hsa", "fsa_hsa", "Pay with FSA or HSA money",
        f"Paying your share with pre-tax FSA or HSA money could make it feel like {money(after)} instead of {money(before)}.",
        before, after, steps,
        [f"Uses an assumed tax rate of {pct} (adjust it).",
         "Rules and deadlines for your FSA/HSA vary, so check with your plan administrator.",
         NOT_TAX_ADVICE])


def _quote_tips(items: list[TreatmentItem], procs: list[Procedure],
                quoted: dict[str, float]) -> list[SavingsTip]:
    tips: list[SavingsTip] = []
    for item, proc in zip(items, procs, strict=True):
        fee = quoted.get(item.id)
        if fee is None or fee <= proc.fee_p80:
            continue
        steps = [
            TraceStep(label="Your quote", amount=round(fee, 2),
                      note=f"Your dentist quoted {money(fee)} for the {proc.name.lower()}."),
            TraceStep(label="High end of typical range", amount=proc.fee_p80,
                      note=f"Most offices charge up to about {money(proc.fee_p80)} for this."),
            TraceStep(label="Possible saving", amount=round(fee - proc.fee_p80, 2),
                      note=f"If the office came down to {money(proc.fee_p80)} you would save "
                           f"{money(round(fee - proc.fee_p80, 2))} on the price."),
        ]
        tips.append(_tip(
            f"quote_check-{item.id}", "quote_check", f"Your {proc.name.lower()} quote looks high",
            (f"Your quote of {money(fee)} is above the typical range. "
             "Ask the office to explain the price; a lower fee is possible, not guaranteed."),
            fee, proc.fee_p80, steps,
            [("This compares the price, before insurance, with the typical high-end fee; "
              "your plan's share would change too."),
             "Savings are potential, not guaranteed. The quote may include extras like X-rays or a build-up."]))
    return tips


def savings_tips(req: SavingsTipsRequest, plan: Plan, catalog: dict[str, Procedure]) -> SavingsTipsResponse:
    """Raises ValueError (bad request) or KeyError(code) (unknown procedure)."""
    if len(req.items) > MAX_ITEMS:
        raise ValueError(f"Please include at most {MAX_ITEMS} treatments (got {len(req.items)}).")
    procs: list[Procedure] = []
    for it in req.items:
        if it.code not in catalog:
            raise KeyError(it.code)
        procs.append(catalog[it.code])

    tips: list[SavingsTip | None] = [
        _timing_tip(req, plan, catalog),
        _network_tip(procs, plan, req.usage),
        _preventive_tip(plan, req.usage, catalog, req.current_month),
        _fsa_tip(procs, plan, req.usage, req.tax_rate),
    ]
    out = [t for t in tips if t is not None]
    out += _alternative_tips(req.items, procs, plan, req.usage, catalog)
    out += _quote_tips(req.items, procs, req.quoted_fees)
    out = [t for t in out if t.saving > 0]
    out.sort(key=lambda t: t.saving, reverse=True)
    return SavingsTipsResponse(tips=out)
