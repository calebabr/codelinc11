"""POST /simulate: Monte Carlo plan comparison for a household."""
from fastapi import APIRouter, Depends, HTTPException

from .. import ratelimit
from ..data import load_catalog, load_plans
from ..engine.simulate import UnknownCode, UnknownPlan, simulate
from ..models import SimulateRequest, SimulateResponse
from .session import Viewer

router = APIRouter(tags=["costs"])


@router.post("/simulate", response_model=SimulateResponse, dependencies=[Depends(ratelimit.limit_compute)])
def post_simulate(req: SimulateRequest, viewer: Viewer) -> SimulateResponse:
    """The request carries the people and care levels, so no household data is read here."""
    try:
        return simulate(req, load_plans(), load_catalog())
    except UnknownPlan as exc:
        raise HTTPException(status_code=404, detail=f"Unknown plan {exc}") from None
    except UnknownCode as exc:
        raise HTTPException(status_code=422, detail=f"Unknown procedure code {exc}") from None
