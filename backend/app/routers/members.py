"""GET /members/{id}/overview and GET /members/{id}/schedule (all per person)."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from .. import ratelimit
from ..data import load_catalog, load_plans
from ..db import DEMO_TODAY
from ..engine.estimate import estimate
from ..engine.status import benefits_status
from ..notifications import sync_notifications
from ..models import (
    MemberOverview,
    MemberUsageDollars,
    Plan,
    ScheduleEntry,
    ServiceEligibility,
    Usage,
    VisitRequest,
    VisitResponse,
)
from .households import member_model, tier_model
from .session import StoreDep, Viewer, guarded

router = APIRouter(tags=["members"])

_SERVICES = [("preventive", "Checkups and cleanings"), ("basic", "Fillings and simple treatment"),
             ("major", "Crowns and major work")]


def _eligibility(plan: Plan, member: dict[str, Any]) -> list[ServiceEligibility]:
    pending = member.get("status") == "pending"
    hold = "Coverage is pending until enrollment is verified. " if pending else ""
    out: list[ServiceEligibility] = []
    for key, label in _SERVICES:
        share = plan.coinsurance.get(key, 0.0)  # type: ignore[arg-type]
        waived = key in plan.deductible_waived_for
        covered = share > 0 and not pending
        if share == 0:
            note = "Your plan does not cover this."
        else:
            note = f"The plan pays {round(share * 100)}%." + (
                " No deductible." if waived else " The deductible applies first.")
        out.append(ServiceEligibility(service=key, label=label, covered=covered, plan_share=share,
                                      deductible_applies=not waived, note=hold + note))  # type: ignore[arg-type]
    ortho_ok = member["age"] < 19 and plan.orthodontia_child > 0
    if member["age"] >= 19:
        ortho_note = "Braces are covered for children under 19 only."
    elif plan.orthodontia_child == 0:
        ortho_note = "Your plan does not cover braces."
    else:
        ortho_note = f"The plan pays {round(plan.orthodontia_child * 100)}% of braces for children."
    out.append(ServiceEligibility(service="orthodontia", label="Braces (children)",
                                  covered=ortho_ok and not pending, plan_share=plan.orthodontia_child,
                                  deductible_applies=False, note=hold + ortho_note))
    return out


@router.get("/members/{member_id}/overview", response_model=MemberOverview)
def member_overview(member_id: str, viewer: Viewer,
                    store: StoreDep) -> MemberOverview:
    member = guarded(lambda: store.get_member(viewer, member_id))
    household = guarded(lambda: store.get_household(viewer, member["household_id"]))
    tier = household["plan_tier"]
    plan = load_plans().get(tier["id"])
    if plan is None:
        raise HTTPException(status_code=404, detail=f"No plan data for tier '{tier['id']}'")
    u = guarded(lambda: store.get_member_usage(viewer, member_id))
    usage = Usage(max_used=u["max_used_cents"] / 100, deductible_met=u["deductible_met_cents"] / 100,
                  history=["D1110"] * u["cleanings_used"])
    status = benefits_status(plan, usage, load_catalog(), DEMO_TODAY.month)
    guarded(lambda: sync_notifications(store, viewer, member_id))
    unread = (guarded(lambda: store.count_unread_notifications(viewer, member_id))
              if guarded(lambda: store.get_notification_prefs(viewer, member_id))["app"] else 0)
    return MemberOverview(
        member=member_model(member), plan_tier=tier_model(tier),
        usage=MemberUsageDollars(plan_year=u["plan_year"], max_used=usage.max_used,
                                 deductible_met=usage.deductible_met, visits=u["visits"],
                                 cleanings_used=u["cleanings_used"]),
        benefits=status, reminder=status.reminder, eligibility=_eligibility(plan, member),
        as_of=DEMO_TODAY.isoformat(), notifications_unread=unread)


@router.get("/members/{member_id}/schedule", response_model=list[ScheduleEntry])
def member_schedule(member_id: str, viewer: Viewer,
                    store: StoreDep) -> list[ScheduleEntry]:
    """Upcoming appointments and reminders for one person, soonest first."""
    rows = guarded(lambda: store.list_upcoming_schedule(viewer, member_id))
    return [ScheduleEntry(**r) for r in rows]


def _cents(dollars: float) -> int:
    return round(dollars * 100)


def _usage_models(u: dict[str, Any]) -> tuple[Usage, MemberUsageDollars]:
    usage = Usage(max_used=u["max_used_cents"] / 100, deductible_met=u["deductible_met_cents"] / 100,
                  history=["D1110"] * u["cleanings_used"])
    return usage, MemberUsageDollars(plan_year=u["plan_year"], max_used=usage.max_used,
                                     deductible_met=usage.deductible_met, visits=u["visits"],
                                     cleanings_used=u["cleanings_used"])


@router.post("/members/{member_id}/visits", response_model=VisitResponse, status_code=201,
             dependencies=[Depends(ratelimit.limit_compute)])
def log_visit(member_id: str, req: VisitRequest, viewer: Viewer, store: StoreDep) -> VisitResponse:
    """Log a visit: the engine estimates it with this person's usage and the household's current
    plan, then the amounts are saved to this person's usage. Same visibility rules as the overview."""
    member = guarded(lambda: store.get_member(viewer, member_id))
    proc = load_catalog().get(req.code)
    if proc is None:
        raise HTTPException(status_code=404, detail=f"Unknown procedure code '{req.code}'")
    household = guarded(lambda: store.get_household(viewer, member["household_id"]))
    plan = load_plans().get(household["plan_tier"]["id"])
    if plan is None:
        raise HTTPException(status_code=404, detail=f"No plan data for tier '{household['plan_tier']['id']}'")
    visit_date = req.visit_date or DEMO_TODAY
    u = guarded(lambda: store.get_member_usage(viewer, member_id, visit_date.year))
    usage, _ = _usage_models(u)
    est = estimate(proc, plan, usage, req.in_network)
    after = guarded(lambda: store.record_visit(
        viewer, member_id, visit_date.isoformat(), est.name,
        billed_cents=_cents(est.billed), plan_paid_cents=_cents(est.plan_pays),
        patient_paid_cents=_cents(est.you_pay), procedure_code=est.code,
        deductible_applied_cents=_cents(est.deductible_applied)))
    new_usage, dollars = _usage_models(after)
    status = benefits_status(plan, new_usage, load_catalog(), DEMO_TODAY.month)
    return VisitResponse(estimate=est, usage=dollars, benefits=status)


@router.post("/demo/reset", dependencies=[Depends(ratelimit.limit_reset)])
def demo_reset(viewer: Viewer, store: StoreDep) -> dict[str, bool]:
    """Primary only: put the caller's own demo family back to its original state (names, plan,
    usage, visits, saved plans; chat memory is cleared). Member ids stay the same, so signed-in
    sessions stay valid. Other families are not touched."""
    me = guarded(lambda: store.get_member(viewer, viewer))
    if me["role"] != "primary":
        raise HTTPException(status_code=403, detail="Only the primary account holder can reset the demo.")
    guarded(lambda: store.reset_household(viewer))
    return {"ok": True}
