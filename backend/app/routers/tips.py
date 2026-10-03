"""POST /savings-tips."""
from fastapi import APIRouter, HTTPException

from ..data import load_catalog, resolve_plan
from ..engine.tips import savings_tips
from ..models import SavingsTipsRequest, SavingsTipsResponse

router = APIRouter()


@router.post("/savings-tips", response_model=SavingsTipsResponse)
def post_savings_tips(req: SavingsTipsRequest) -> SavingsTipsResponse:
    try:
        plan = resolve_plan(req.plan, req.plan_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Unknown plan '{req.plan_id}'") from None
    try:
        return savings_tips(req, plan, load_catalog())
    except KeyError as exc:
        raise HTTPException(status_code=422, detail=f"Unknown procedure code {exc}") from None
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None
