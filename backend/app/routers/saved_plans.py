"""Saved Plan My Year plans, per member: list, create, update, delete (T20).

Only the treatment list is saved (id, code, urgency, after). No dollar amounts are stored;
the schedule is recalculated by the engine each time a saved plan is opened.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field

from ..data import load_catalog
from ..models import TreatmentItem
from .session import StoreDep, Viewer, guarded

router = APIRouter(tags=["saved-plans"])

MAX_ITEMS = 20


class SavedPlanCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    items: list[TreatmentItem] = Field(max_length=MAX_ITEMS)


class SavedPlanUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    items: list[TreatmentItem] | None = Field(default=None, max_length=MAX_ITEMS)


class SavedPlan(BaseModel):
    id: str
    member_id: str
    name: str
    items: list[TreatmentItem]
    created_at: str
    updated_at: str


def _check_items(items: list[TreatmentItem]) -> list[dict]:
    catalog = load_catalog()
    ids = [i.id for i in items]
    if len(set(ids)) != len(ids):
        raise HTTPException(status_code=422, detail="Item ids must be unique")
    for item in items:
        if item.code not in catalog:
            raise HTTPException(status_code=422, detail=f"Unknown procedure code '{item.code}'")
        if item.after is not None and item.after not in ids:
            raise HTTPException(status_code=422, detail=f"Item '{item.id}' comes after an unknown item")
    return [i.model_dump() for i in items]


@router.get("/members/{member_id}/saved-plans", response_model=list[SavedPlan])
def list_saved_plans(member_id: str, viewer: Viewer, store: StoreDep):
    return guarded(lambda: store.list_saved_plans(viewer, member_id))


@router.post("/members/{member_id}/saved-plans", response_model=SavedPlan, status_code=201)
def create_saved_plan(member_id: str, body: SavedPlanCreate, viewer: Viewer, store: StoreDep):
    items = _check_items(body.items)
    return guarded(lambda: store.create_saved_plan(viewer, member_id, body.name.strip(), items))


@router.put("/members/{member_id}/saved-plans/{plan_id}", response_model=SavedPlan)
def update_saved_plan(member_id: str, plan_id: str, body: SavedPlanUpdate, viewer: Viewer, store: StoreDep):
    items = _check_items(body.items) if body.items is not None else None
    name = body.name.strip() if body.name is not None else None
    if name == "":
        raise HTTPException(status_code=422, detail="Name cannot be blank")
    return guarded(lambda: store.update_saved_plan(viewer, member_id, plan_id, name, items))


@router.delete("/members/{member_id}/saved-plans/{plan_id}", status_code=204)
def delete_saved_plan(member_id: str, plan_id: str, viewer: Viewer, store: StoreDep):
    guarded(lambda: store.delete_saved_plan(viewer, member_id, plan_id))
    return Response(status_code=204)
