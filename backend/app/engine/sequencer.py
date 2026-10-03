"""Plan My Year: exhaustive search over this-year / next-year assignments."""
from __future__ import annotations

from ..models import (
    EstimateResult,
    Plan,
    Procedure,
    ScheduledItem,
    ScheduleRequest,
    ScheduleResponse,
    TreatmentItem,
    Usage,
    YearSummary,
)
from .annual import run_year
from .estimate import money

MAX_ITEMS = 10
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August",
          "September", "October", "November", "December"]


def _order(items: list[TreatmentItem], plan: Plan, catalog: dict[str, Procedure],
           prior: set[str]) -> list[TreatmentItem] | None:
    """Order one year's items: urgent first, then `after` respected, plan share asc, fee desc.

    `prior` = ids already done in earlier years. Returns None if prerequisites can't be met.
    """
    remaining = list(items)
    done = set(prior)
    ordered: list[TreatmentItem] = []

    def key(i: TreatmentItem):
        p = catalog[i.code]
        return (i.urgency != "urgent", plan.coinsurance.get(p.category, 0.0), -p.fee_p50, i.id)

    while remaining:
        ready = [i for i in remaining if i.after is None or i.after in done]
        if not ready:
            return None
        pick = min(ready, key=key)
        ordered.append(pick)
        done.add(pick.id)
        remaining.remove(pick)
    return ordered


def _months(ordered: list[TreatmentItem], start: int) -> list[int]:
    months: list[int] = []
    m = start
    for it in ordered:
        month = start if it.urgency == "urgent" else min(m, 12)
        months.append(month)
        m = max(m, month + 1)
    return months


def _eval_year(items: list[TreatmentItem], plan: Plan, catalog: dict[str, Procedure],
               usage: Usage, prior: set[str]):
    ordered = _order(items, plan, catalog, prior)
    if ordered is None:
        return None
    results, final = run_year([catalog[i.code] for i in ordered], plan, usage)
    return ordered, results, final


def _build_items(ordered: list[TreatmentItem], results: list[EstimateResult], months: list[int],
                 year: int, notes: dict[str, str]) -> list[ScheduledItem]:
    return [ScheduledItem(id=i.id, code=r.code, name=r.name, category=r.category, year_offset=year,
                          month=m, plan_pays=r.plan_pays, you_pay=r.you_pay,
                          note=notes.get(i.id, ""))
            for i, r, m in zip(ordered, results, months, strict=True)]


def best_schedule(req: ScheduleRequest, plan: Plan, catalog: dict[str, Procedure]) -> ScheduleResponse:
    items = req.items
    n = len(items)
    if n > MAX_ITEMS:
        raise ValueError(f"Please schedule at most {MAX_ITEMS} treatments at a time (got {n}).")
    ids = [i.id for i in items]
    if len(set(ids)) != n:
        raise ValueError("Treatment ids must be unique.")
    for it in items:
        if it.code not in catalog:
            raise KeyError(it.code)
        if it.after is not None and it.after not in ids:
            raise ValueError(f"Treatment '{it.id}' comes after unknown treatment '{it.after}'.")
        if it.after == it.id:
            raise ValueError(f"Treatment '{it.id}' cannot come after itself.")
    by_id = {i.id: i for i in items}
    # An urgent item's prerequisites (transitively) are treated as urgent too.
    propagated: list[str] = []
    for it in list(items):
        if it.urgency != "urgent":
            continue
        cur = it
        seen = {cur.id}
        while cur.after is not None and cur.after not in seen:
            pre = by_id[cur.after]
            if pre.urgency != "urgent":
                by_id[pre.id] = pre = pre.model_copy(update={"urgency": "urgent"})
                propagated.append(
                    f"{catalog[pre.code].name} must happen first because "
                    f"{catalog[cur.code].name.lower()} is urgent.")
            seen.add(pre.id)
            cur = pre
    items = [by_id[i.id] for i in items]
    cm = req.current_month
    fresh = Usage()

    best = None  # (score, e0, e1)
    for mask in range(1 << n):
        year_of = {items[k].id: (mask >> k) & 1 for k in range(n)}
        if any(it.urgency == "urgent" and year_of[it.id] == 1 for it in items):
            continue
        if any(it.after is not None and year_of[it.after] > year_of[it.id] for it in items):
            continue
        y0_items = [it for it in items if year_of[it.id] == 0]
        y1_items = [it for it in items if year_of[it.id] == 1]
        e0 = _eval_year(y0_items, plan, catalog, req.usage, set())
        e1 = _eval_year(y1_items, plan, catalog, fresh, {i.id for i in y0_items})
        if e0 is None or e1 is None:
            continue
        score = round(sum(r.you_pay for r in e0[1]) + sum(r.you_pay for r in e1[1])
                      + 0.01 * len(y1_items), 4)
        if best is None or score < best[0]:
            best = (score, e0, e1)
    if best is None:
        raise ValueError("These treatments can't be scheduled (check the 'after' order for loops).")
    _, e0, e1 = best
    ordered0, res0, final0 = e0
    ordered1, res1, final1 = e1
    months0 = _months(ordered0, cm)
    months1 = _months(ordered1, 1)

    base = _eval_year(list(items), plan, catalog, req.usage, set())
    if base is None:
        # "everything now" is impossible only with an `after` loop, which was rejected above
        raise ValueError("These treatments can't be scheduled (check the 'after' order for loops).")
    base_ordered, base_res, _ = base
    base_months = _months(base_ordered, cm)

    start_rem = round(max(plan.annual_max - req.usage.max_used, 0), 2)
    notes: dict[str, str] = {}
    reasons: list[str] = []
    for it, r in zip(ordered0, res0, strict=True):
        if it.urgency == "urgent":
            notes[it.id] = "Urgent care stays in this plan year so you are treated right away."
            reasons.append(f"{r.name} stays this year because it's urgent.")
        else:
            notes[it.id] = "Done this plan year because moving it would not save you money."
    for it, r, m in zip(ordered1, res1, months1, strict=True):
        notes[it.id] = (f"Moved to {MONTHS[m - 1]} of next plan year: your yearly maximum resets "
                        f"to {money(plan.annual_max)}, so the plan pays more.")
        if it.after is not None and by_id[it.after] in ordered1:
            notes[it.id] += f" It follows {catalog[by_id[it.after].code].name.lower()}."
        reasons.append(f"{r.name} moves to {MONTHS[m - 1]}: your plan year resets and you get a "
                       f"fresh {money(plan.annual_max)} maximum.")
    reasons.extend(propagated)
    if ordered1 and start_rem < plan.annual_max:
        reasons.insert(0, f"Only {money(start_rem)} of your maximum is left this year.")
    for r in res1:
        if r.deductible_applied > 0:
            reasons.append(f"Your new {money(plan.deductible)} deductible lands on {r.name.lower()}, "
                           "where the plan pays the smallest share, which keeps your cost lowest.")
            break

    total0 = round(sum(r.you_pay for r in res0), 2)
    total1 = round(sum(r.you_pay for r in res1), 2)
    total = round(total0 + total1, 2)
    baseline_total = round(sum(r.you_pay for r in base_res), 2)
    savings = round(max(baseline_total - total, 0), 2)
    if not ordered1:
        reasons.append("Doing everything this plan year is already the lowest-cost option for you.")
    else:
        reasons.append(f"Doing everything now would cost you {money(baseline_total)}; "
                       f"this schedule costs {money(total)}, so you save {money(savings)}.")

    items0 = _build_items(ordered0, res0, months0, 0, notes)
    items1 = _build_items(ordered1, res1, months1, 1, notes)
    base_notes = {i.id: "Done now, using whatever is left of this year's maximum." for i in base_ordered}
    baseline_items = _build_items(base_ordered, base_res, base_months, 0, base_notes)

    years = [
        YearSummary(year_offset=0, label="This plan year",
                    plan_pays=round(sum(r.plan_pays for r in res0), 2), you_pay=total0,
                    max_used_end=final0.max_used,
                    max_remaining_end=round(max(plan.annual_max - final0.max_used, 0), 2)),
        YearSummary(year_offset=1, label="Next plan year",
                    plan_pays=round(sum(r.plan_pays for r in res1), 2), you_pay=total1,
                    max_used_end=final1.max_used,
                    max_remaining_end=round(max(plan.annual_max - final1.max_used, 0), 2)),
    ]
    return ScheduleResponse(items=items0 + items1, years=years, total_you_pay=total,
                            baseline_you_pay=baseline_total, savings=savings,
                            baseline_items=baseline_items, reasons=reasons)
