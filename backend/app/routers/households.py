"""GET /households/{id} and POST /households/{id}/invites."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from ..models import Household, InviteRequest, InviteResponse, Member, PlanTierSummary
from .session import StoreDep, Viewer, guarded

router = APIRouter(tags=["households"])


def member_model(m: dict[str, Any]) -> Member:
    return Member(id=m["id"], household_id=m["household_id"], name=m["name"],
                  relationship=m["relationship"], age=m["age"], role=m["role"],
                  has_login=bool(m["has_login"]), status=m.get("status") or "active",
                  status_note=m.get("status_note"))


def tier_model(t: dict[str, Any]) -> PlanTierSummary:
    return PlanTierSummary(
        id=t["id"], name=t["name"], monthly_premium=t["monthly_cents"] / 100,
        annual_max=t["annual_max_cents"] / 100, deductible=t["deductible_cents"] / 100,
        preventive_pct=t["preventive_pct"], basic_pct=t["basic_pct"], major_pct=t["major_pct"],
        ortho_pct=t["ortho_pct"])


def household_model(h: dict[str, Any]) -> Household:
    return Household(id=h["id"], name=h["name"], plan_tier=tier_model(h["plan_tier"]),
                     members=[member_model(m) for m in h["members"]])


@router.get("/households/{household_id}", response_model=Household)
def get_household(household_id: str, viewer: Viewer,
                  store: StoreDep) -> Household:
    """The household and the members the signed-in person may see (primary: all; adult: self)."""
    return household_model(guarded(lambda: store.get_household(viewer, household_id)))


@router.post("/households/{household_id}/invites", response_model=InviteResponse, status_code=201)
def create_invite(household_id: str, req: InviteRequest, viewer: Viewer,
                  store: StoreDep) -> InviteResponse:
    """Primary invites an adult (demo level: creates a pending record, sends nothing)."""
    me = guarded(lambda: store.get_member(viewer, viewer))
    if me["household_id"] != household_id:
        guarded(lambda: store.get_household(viewer, household_id))  # 403/404 as appropriate
    inv = guarded(lambda: store.create_invite(viewer, req.email, req.member_id))
    return InviteResponse(**{k: inv[k] for k in InviteResponse.model_fields})
