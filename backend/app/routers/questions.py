"""Routes for the questions feature. Owned by the questions agent."""
from fastapi import APIRouter, HTTPException

from ..data import load_catalog, resolve_plan
from ..models import QuestionsRequest, QuestionsResponse
from ..questions import build_questions

router = APIRouter()


@router.post("/questions", response_model=QuestionsResponse)
def questions(req: QuestionsRequest) -> QuestionsResponse:
    try:
        plan = resolve_plan(req.plan, req.plan_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Unknown plan '{req.plan_id}'") from None
    return build_questions(plan, req.usage, req.codes, req.current_month, load_catalog())
