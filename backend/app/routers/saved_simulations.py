"""Saved "Which plan fits us?" comparisons, per member (T34).

The client sends only its choices. The server runs simulate() itself and stores the headline
it computed, so a saved result can never be forged or drift into browser math.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Response

from ..data import load_catalog, load_plans
from ..engine.simulate import UnknownCode, UnknownPlan, simulate
from ..models import (
    SavedSimulation,
    SavedSimulationCreate,
    SavedSimulationUpdate,
    SimulateRequest,
)
from .session import StoreDep, Viewer, guarded

router = APIRouter(tags=["saved-simulations"])

MAX_PER_MEMBER = 20


def _summary(req: SimulateRequest, current_plan_id: str | None) -> dict:
    try:
        res = simulate(req, load_plans(), load_catalog())
    except UnknownPlan as exc:
        raise HTTPException(status_code=422, detail=f"Unknown plan {exc}") from None
    except UnknownCode as exc:
        raise HTTPException(status_code=422, detail=f"Unknown procedure code {exc}") from None
    by_id = {p.plan_id: p for p in res.plans}
    winner = by_id[res.winner_plan_id]
    return {
        "winner_plan_id": winner.plan_id,
        "winner_name": winner.name,
        "winner_share": winner.cheapest_share,
        "plans": [
            {"plan_id": p.plan_id, "name": p.name, "cheapest_share": p.cheapest_share,
             "median": p.median, "p90": p.p90}
            for p in res.plans
        ],
        "current_plan_id": current_plan_id,
    }


@router.get("/members/{member_id}/saved-simulations", response_model=list[SavedSimulation])
def list_saved_simulations(member_id: str, viewer: Viewer, store: StoreDep):
    return guarded(lambda: store.list_saved_simulations(viewer, member_id))


@router.post("/members/{member_id}/saved-simulations", response_model=SavedSimulation, status_code=201)
def create_saved_simulation(member_id: str, body: SavedSimulationCreate, viewer: Viewer, store: StoreDep):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Name cannot be blank")
    current = guarded(lambda: store.household_plan_id(viewer, member_id))  # 403/404 before any work
    summary = _summary(body.request, current)
    return guarded(lambda: store.create_saved_simulation(
        viewer, member_id, name, body.request.model_dump(), summary, MAX_PER_MEMBER))


@router.put("/members/{member_id}/saved-simulations/{sim_id}", response_model=SavedSimulation)
def update_saved_simulation(
    member_id: str, sim_id: str, body: SavedSimulationUpdate, viewer: Viewer, store: StoreDep
):
    name = body.name.strip() if body.name is not None else None
    if name == "":
        raise HTTPException(status_code=422, detail="Name cannot be blank")
    guarded(lambda: store.get_saved_simulation(viewer, member_id, sim_id))  # 403/404 first
    request = summary = None
    if body.request is not None:
        current = guarded(lambda: store.household_plan_id(viewer, member_id))
        request = body.request.model_dump()
        summary = _summary(body.request, current)
    return guarded(lambda: store.update_saved_simulation(viewer, member_id, sim_id, name, request, summary))


@router.delete("/members/{member_id}/saved-simulations/{sim_id}", status_code=204)
def delete_saved_simulation(member_id: str, sim_id: str, viewer: Viewer, store: StoreDep):
    guarded(lambda: store.delete_saved_simulation(viewer, member_id, sim_id))
    return Response(status_code=204)
