import pytest

from app.engine.annual import run_year
from app.engine.estimate import estimate
from app.engine.sequencer import best_schedule
from app.engine.status import benefits_status
from app.models import ScheduleRequest, TreatmentItem, Usage


def test_g1_cleaning(catalog, demo):
    r = estimate(catalog["D1110"], demo, Usage())
    assert r.covered
    assert r.plan_pays == 120
    assert r.you_pay == 0
    assert r.deductible_applied == 0


def test_g2_filling(catalog, demo):
    r = estimate(catalog["D2392"], demo, Usage())
    assert r.deductible_applied == 50
    assert r.plan_pays == 120
    assert r.you_pay == 80


def test_g3_crown_capped_by_max(catalog, demo):
    r = estimate(catalog["D2740"], demo, Usage(max_used=1100, deductible_met=0))
    assert r.plan_pays == 400
    assert r.you_pay == 800


def test_g4_crown_fresh(catalog, demo):
    r = estimate(catalog["D2740"], demo, Usage())
    assert r.plan_pays == 575
    assert r.you_pay == 625


def test_g5_crown_out_of_network(catalog, demo):
    r = estimate(catalog["D2740"], demo, Usage(), in_network=False)
    assert r.in_network is False
    assert r.plan_pays == 575
    assert r.you_pay == 925
    assert r.balance_bill == 300
    assert r.billed == 1500
    assert r.allowed == 1200


def test_g6_frequency_limit(catalog, demo):
    r = estimate(catalog["D1110"], demo, Usage(history=["D1110", "D1110"]))
    assert r.covered is False
    assert r.plan_pays == 0
    assert r.you_pay == 120
    assert r.deductible_applied == 0
    assert len(r.trace) >= 1


def test_trace_present_and_in_network_defaults(catalog, demo):
    r = estimate(catalog["D2392"], demo, Usage())
    assert r.in_network is True
    assert r.balance_bill == 0
    assert len(r.trace) >= 3
    assert all(t.label and t.note for t in r.trace)
    assert r.max_used_after == 120


def test_max_used_after_accumulates(catalog, demo):
    r = estimate(catalog["D2740"], demo, Usage(max_used=1100))
    assert r.max_used_after == 1500


def test_deductible_partially_met(catalog, demo):
    r = estimate(catalog["D2392"], demo, Usage(deductible_met=30))
    assert r.deductible_applied == 20
    assert r.plan_pays == pytest.approx(0.8 * 180)


def test_run_year_updates_usage(catalog, demo):
    procs = [catalog["D2392"], catalog["D2392"], catalog["D1110"]]
    u0 = Usage()
    results, final = run_year(procs, demo, u0)
    assert [r.plan_pays for r in results] == [120, 160, 120]
    assert final.deductible_met == 50
    assert final.max_used == 400
    assert final.history == ["D2392", "D2392", "D1110"]
    assert u0 == Usage()  # input not mutated


def test_run_year_frequency_across_visits(catalog, demo):
    results, _ = run_year([catalog["D1110"]] * 3, demo, Usage())
    assert [r.covered for r in results] == [True, True, False]


def _s2_request():
    return ScheduleRequest(
        plan_id="preferred",
        items=[
            TreatmentItem(id="t1", code="D3330", urgency="urgent"),
            TreatmentItem(id="t2", code="D2740", urgency="flexible", after="t1"),
            TreatmentItem(id="t3", code="D2392"),
            TreatmentItem(id="t4", code="D2392"),
        ],
        usage=Usage(max_used=1100, deductible_met=50),
        current_month=11,
    )


def test_s2_sequencer(catalog, demo):
    resp = best_schedule(_s2_request(), demo, catalog)
    assert resp.baseline_you_pay == 2300
    assert resp.total_you_pay == 1405
    assert resp.savings == 895
    by_id = {i.id: i for i in resp.items}
    assert by_id["t1"].year_offset == 0
    assert by_id["t1"].month == 11
    assert by_id["t1"].plan_pays == 400
    assert by_id["t1"].you_pay == 700
    for tid in ("t2", "t3", "t4"):
        assert by_id[tid].year_offset == 1
    assert by_id["t2"].month == 1  # crown first
    assert sorted(by_id[t].month for t in ("t2", "t3", "t4")) == [1, 2, 3]
    assert by_id["t2"].you_pay == 625
    assert by_id["t3"].you_pay == 40 and by_id["t4"].you_pay == 40
    keys = [(i.year_offset, i.month) for i in resp.items]
    assert keys == sorted(keys)
    assert len(resp.years) == 2
    assert resp.years[0].you_pay == 700 and resp.years[1].you_pay == 705
    assert resp.years[0].plan_pays == 400 and resp.years[1].plan_pays == 895
    assert len(resp.baseline_items) == 4
    assert all(i.year_offset == 0 for i in resp.baseline_items)
    assert resp.reasons and all(isinstance(r, str) and r for r in resp.reasons)
    assert all(i.note for i in resp.items)


def test_sequencer_rejects_more_than_ten_items(catalog, demo):
    req = ScheduleRequest(
        plan_id="preferred",
        items=[TreatmentItem(id=f"t{i}", code="D2392") for i in range(11)],
    )
    with pytest.raises(ValueError):
        best_schedule(req, demo, catalog)


def test_benefits_example(catalog, demo):
    s = benefits_status(demo, Usage(max_used=1100, history=["D1110"]), catalog, 11)
    assert s.max_remaining == 400
    assert s.max_used == 1100
    assert s.annual_max == 1500
    assert s.deductible_remaining == 50
    assert s.months_left == 2
    freq = {f.code: f for f in s.frequencies}
    assert freq["D1110"].used == 1
    assert freq["D1110"].limit == 2
    assert freq["D1110"].remaining == 1
    assert s.reminder
    assert s.unused_preventive_value > 0


def test_benefits_no_reminder_early_in_year(catalog, demo):
    s = benefits_status(demo, Usage(), catalog, 3)
    assert s.reminder is None
    assert s.months_left == 10


def test_benefits_no_reminder_when_everything_used(catalog, demo):
    u = Usage(max_used=1500, deductible_met=50, history=["D1110", "D1110", "D0120", "D0120"])
    s = benefits_status(demo, u, catalog, 11)
    assert s.max_remaining == 0
    assert s.reminder is None
