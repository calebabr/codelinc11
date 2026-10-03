"""Routes for the treatment_plan feature: read a dentist's treatment plan."""
from fastapi import APIRouter, HTTPException

from ..data import load_catalog
from ..models import TreatmentPlanParseRequest, TreatmentPlanParseResponse
from ..treatment_parser import MAX_TEXT_CHARS, parse_treatment_plan

router = APIRouter()


@router.post("/treatment-plan/parse", response_model=TreatmentPlanParseResponse)
def parse_plan(req: TreatmentPlanParseRequest) -> TreatmentPlanParseResponse:
    if not req.text.strip():
        raise HTTPException(status_code=422, detail="Paste your dentist's treatment plan text first.")
    if len(req.text) > MAX_TEXT_CHARS:
        raise HTTPException(
            status_code=422,
            detail=f"That text is too long (limit {MAX_TEXT_CHARS:,} characters). Paste a shorter section.",
        )
    return parse_treatment_plan(req.text, load_catalog())
