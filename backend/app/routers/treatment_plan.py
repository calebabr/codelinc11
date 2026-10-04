"""Routes for the treatment_plan feature: read a dentist's treatment plan, and try synthetic quotes."""
from fastapi import APIRouter, HTTPException

from ..data import load_catalog
from ..models import (
    ProviderMatch,
    TreatmentPlanParseRequest,
    TreatmentPlanParseResponse,
    TreatmentPlanSample,
)
from ..quote_match import UNMATCHED_NOTE, list_quote_samples, match_provider
from ..treatment_parser import MAX_TEXT_CHARS, parse_treatment_plan
from .session import StoreDep

router = APIRouter()


@router.get("/treatment-plan/samples", response_model=list[TreatmentPlanSample])
def treatment_plan_samples() -> list[TreatmentPlanSample]:
    """Three synthetic dentist quotes to try: an in-network practice, an out-of-network practice and one
    practice that is not in the directory. Their headers use real directory names, phones and ZIPs."""
    return list_quote_samples()


@router.post("/treatment-plan/parse", response_model=TreatmentPlanParseResponse)
def parse_plan(req: TreatmentPlanParseRequest, store: StoreDep) -> TreatmentPlanParseResponse:
    if not req.text.strip():
        raise HTTPException(status_code=422, detail="Paste your dentist's treatment plan text first.")
    if len(req.text) > MAX_TEXT_CHARS:
        raise HTTPException(
            status_code=422,
            detail=f"That text is too long (limit {MAX_TEXT_CHARS:,} characters). Paste a shorter section.",
        )
    result = parse_treatment_plan(req.text, load_catalog())
    # Which directory practice is this quote from? `plan_id` (a plan tier) decides in or out of network.
    # Never let a directory problem break reading the quote.
    try:
        result.provider_match = match_provider(req.text, store.list_providers(), req.plan_id)
    except Exception:  # noqa: BLE001
        result.provider_match = ProviderMatch(matched=False, in_network=False, network_note=UNMATCHED_NOTE)
    return result
