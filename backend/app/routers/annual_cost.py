"""POST /annual-cost."""
from fastapi import APIRouter, HTTPException

from ..data import load_catalog, load_plans
from ..engine.annual_cost import annual_cost
from ..models import AnnualCostRequest, AnnualCostResponse

router = APIRouter(tags=["costs"])


@router.post("/annual-cost", response_model=AnnualCostResponse)
def post_annual_cost(req: AnnualCostRequest) -> AnnualCostResponse:
    plan = load_plans().get(req.tier_id)
    if plan is None:
        raise HTTPException(status_code=404, detail=f"Unknown plan tier '{req.tier_id}'")
    try:
        return annual_cost(req, plan, load_catalog())
    except KeyError as exc:
        raise HTTPException(status_code=422, detail=f"Unknown procedure code {exc}") from None
