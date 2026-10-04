"""GET /households/{id} and POST /households/{id}/invites."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..models import (
    Household,
    HouseholdNamesRequest,
    InviteRequest,
    InviteResponse,
    Member,
    PlanTierSummary,
)
from .session import StoreDep, Viewer, guarded

router = APIRouter(tags=["households"])


def member_model(m: dict[str, Any]) -> Member:
    return Member(id=m["id"], household_id=m["household_id"], name=m["name"],
                  relationship=m["relationship"], age=m["age"], role=m["role"],
                  has_login=bool(m["has_login"]), status=m.get("status") or "active",
                  status_note=m.get("status_note"), dob=m.get("dob"), email=m.get("email"),
                  phone=m.get("phone"), zip=m.get("zip"), notes=m.get("notes"),
                  primary_dentist_id=m.get("primary_dentist_id"))


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


class PlanChange(BaseModel):
    tier_id: str  # "basic" | "preferred" | "premium"


@router.put("/households/{household_id}/plan", response_model=Household)
def set_household_plan(household_id: str, req: PlanChange, viewer: Viewer, store: StoreDep) -> Household:
    """Primary switches the household plan tier. 403 non-primary, 404 unknown tier."""
    return household_model(guarded(lambda: store.set_household_plan(viewer, household_id, req.tier_id)))


NAME_EXTRA = set(" '’-.")


def clean_name(raw: str, what: str, max_len: int) -> str:
    """Trim and check a display name. Names go into the assistant's prompt, so only letters,
    spaces, apostrophes, hyphens and periods are allowed (no digits, markup or other symbols)."""
    if any(c.isspace() and c != " " for c in raw):
        raise HTTPException(status_code=422, detail=f"{what} can only use letters, spaces, apostrophes, "
                                                    "hyphens and periods.")
    name = " ".join(raw.split())
    if not name or len(name) > max_len:
        raise HTTPException(status_code=422, detail=f"{what} must be 1 to {max_len} characters.")
    if not any(c.isalpha() for c in name) or any(not (c.isalpha() or c in NAME_EXTRA) for c in name):
        raise HTTPException(status_code=422, detail=f"{what} can only use letters, spaces, apostrophes, "
                                                    "hyphens and periods.")
    return name


@router.put("/households/{household_id}/names", response_model=Household)
def set_household_names(household_id: str, req: HouseholdNamesRequest, viewer: Viewer,
                        store: StoreDep) -> Household:
    """Primary renames the people in their own demo family (and optionally the family surname).
    403 for non-primary or for the shared template household; 422 for invalid names."""
    names: dict[str, str] = {}
    for m in req.members:
        if m.member_id in names:
            raise HTTPException(status_code=422, detail="Each person can be renamed only once per request.")
        names[m.member_id] = clean_name(m.name, "A name", 24)
    surname = clean_name(req.household_name, "The family name", 30) if req.household_name is not None else None
    if not names and surname is None:
        raise HTTPException(status_code=422, detail="Send at least one name to change.")
    return household_model(guarded(lambda: store.rename_household(viewer, household_id, surname, names)))
