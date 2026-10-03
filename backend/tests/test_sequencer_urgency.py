"""An urgent item's prerequisites become urgent too (docs/PROTOTYPE-SPEC.md section 2)."""
from app.data import load_catalog, load_plans
from app.engine.sequencer import best_schedule
from app.models import ScheduleRequest, TreatmentItem, Usage


def _schedule(items):
    req = ScheduleRequest(
        plan_id="preferred",
        items=items,
        usage=Usage(max_used=1100, deductible_met=50),
        current_month=11,
    )
    return best_schedule(req, load_plans()["preferred"], load_catalog())


def test_urgent_item_pulls_its_prerequisite_into_this_year():
    result = _schedule([
        TreatmentItem(id="rc", code="D3330", urgency="flexible"),
        TreatmentItem(id="cr", code="D2740", urgency="urgent", after="rc"),
    ])
    by_id = {item.id: item for item in result.items}
    assert by_id["rc"].year_offset == 0
    assert by_id["cr"].year_offset == 0
    order = [item.id for item in result.items]
    assert order.index("rc") < order.index("cr")
    assert any("must happen first" in reason for reason in result.reasons)


def test_flexible_chain_may_still_move_to_next_year():
    result = _schedule([
        TreatmentItem(id="rc", code="D3330", urgency="flexible"),
        TreatmentItem(id="cr", code="D2740", urgency="flexible", after="rc"),
    ])
    assert result.savings >= 0
    order = [(item.year_offset, item.month) for item in result.items]
    assert order == sorted(order)
