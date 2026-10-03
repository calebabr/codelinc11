import os

os.environ.setdefault("OLLAMA_URL", "http://127.0.0.1:9")

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

S2_USAGE = {"max_used": 1100, "deductible_met": 50, "history": []}
S2_ITEMS = [
    {"id": "t1", "code": "D3330", "urgency": "urgent"},
    {"id": "t2", "code": "D2740", "urgency": "flexible", "after": "t1"},
    {"id": "t3", "code": "D2392", "urgency": "flexible"},
    {"id": "t4", "code": "D2392", "urgency": "flexible"},
]
CROWN = [{"id": "c1", "code": "D2740", "urgency": "flexible"}]


def post(**body):
    body.setdefault("plan_id", "preferred")
    r = client.post("/savings-tips", json=body)
    return r


def tips_by_kind(r):
    assert r.status_code == 200, r.text
    out = {}
    for t in r.json()["tips"]:
        out.setdefault(t["kind"], []).append(t)
    return out


def test_s2_timing_tip():
    r = post(usage=S2_USAGE, current_month=11, items=S2_ITEMS)
    timing = tips_by_kind(r)["timing"][0]
    assert timing["before"] == 2300
    assert timing["after"] == 1405
    assert timing["saving"] == 895
    assert timing["steps"]
    assert any("urgent" in a for a in timing["assumptions"])


def test_all_urgent_has_no_timing_tip():
    items = [{"id": "t1", "code": "D3330", "urgency": "urgent"},
             {"id": "t2", "code": "D2740", "urgency": "urgent", "after": "t1"}]
    r = post(usage=S2_USAGE, items=items)
    assert "timing" not in tips_by_kind(r)


def test_network_tip_single_crown_fresh_year():
    tip = tips_by_kind(post(items=CROWN))["network"][0]
    assert tip["before"] == 925
    assert tip["after"] == 625
    assert tip["saving"] == 300


def test_alternative_alternate_benefit_vs_normal():
    items = [{"id": "f1", "code": "D2392", "urgency": "flexible"}]
    demo = tips_by_kind(post(plan_id="preferred", items=items))["alternative"][0]
    # preferred: plan pays only what it would for the amalgam (D2150): 0.8 * (180-50) = 104
    assert demo["before"] == 200 - 104
    assert demo["after"] == 180 - 104
    assert demo["saving"] == 20
    assert "D2150" in demo["id"]
    no_alt = client.get("/plans/preferred").json() | {"alternate_benefit": False}
    basic = tips_by_kind(post(plan=no_alt, items=items))["alternative"][0]
    # plan without the alternate-benefit rule: normal estimate. composite you pay 200-120=80; amalgam you pay 180-104=76
    assert basic["before"] == 200 - 120
    assert basic["after"] == 180 - 104
    assert basic["saving"] == 4
    assert any("agrees" in a for a in basic["assumptions"])


def test_no_alternative_for_procedure_without_one():
    assert "alternative" not in tips_by_kind(post(items=CROWN))


@pytest.mark.parametrize("rate,after,saving", [(0.25, 468.75, 156.25), (0.4, 375.0, 250.0)])
def test_fsa_hsa_math(rate, after, saving):
    # fresh year in-network crown: you pay 625
    tip = tips_by_kind(post(items=CROWN, tax_rate=rate))["fsa_hsa"][0]
    assert tip["before"] == 625
    assert tip["after"] == after
    assert tip["saving"] == saving
    assert any(f"{rate * 100:g}%" in a for a in tip["assumptions"])
    assert any("not tax" in a for a in tip["assumptions"])


def test_fsa_hsa_absent_when_nothing_to_pay():
    items = [{"id": "p1", "code": "D1110", "urgency": "flexible"}]
    assert "fsa_hsa" not in tips_by_kind(post(items=items))


def test_quote_check_threshold():
    high = tips_by_kind(post(items=CROWN, quoted_fees={"c1": 1600}))["quote_check"][0]
    assert high["before"] == 1600
    assert high["after"] == 1500
    assert high["saving"] == 100
    assert "quote_check" not in tips_by_kind(post(items=CROWN, quoted_fees={"c1": 1400}))
    assert "quote_check" not in tips_by_kind(post(items=CROWN, quoted_fees={"c1": 1500}))
    assert "quote_check" not in tips_by_kind(post(items=CROWN, quoted_fees={"zzz": 5000}))


def test_preventive_tip_after_one_cleaning():
    r = post(usage={"max_used": 0, "deductible_met": 0, "history": ["D1110"]}, items=[])
    kinds = tips_by_kind(r)
    assert set(kinds) == {"preventive"}
    tip = kinds["preventive"][0]
    # one cleaning (120) + two exams (60 each) still unused on preferred
    assert tip["before"] == 240
    assert tip["after"] == 0
    assert tip["saving"] == 240
    assert "free covered care" in tip["summary"]


def test_no_items_no_preventive_left_gives_no_tips():
    usage = {"max_used": 0, "deductible_met": 0,
             "history": ["D1110", "D1110", "D0120", "D0120"]}
    r = post(usage=usage, items=[])
    assert r.status_code == 200
    assert r.json()["tips"] == []


def test_sorted_and_positive():
    r = post(usage=S2_USAGE, items=S2_ITEMS, quoted_fees={"t2": 1700})
    tips = r.json()["tips"]
    assert len(tips) >= 4
    savings = [t["saving"] for t in tips]
    assert savings == sorted(savings, reverse=True)
    for t in tips:
        assert t["saving"] > 0
        assert t["saving"] == round(t["before"] - t["after"], 2)
        assert t["steps"]
    assert len({t["id"] for t in tips}) == len(tips)
    assert r.json()["note"]


def test_unknown_code_422():
    r = post(items=[{"id": "x", "code": "D9999"}])
    assert r.status_code == 422
    assert "D9999" in r.json()["detail"]


def test_too_many_items_422():
    items = [{"id": f"t{i}", "code": "D2392"} for i in range(11)]
    r = post(items=items)
    assert r.status_code == 422
    assert "at most 10" in r.json()["detail"]


def test_unknown_plan_404_and_bad_tax_rate_422():
    assert post(plan_id="nope", items=[]).status_code == 404
    assert post(items=CROWN, tax_rate=0.9).status_code == 422


def test_bad_after_reference_422():
    r = post(items=[{"id": "a", "code": "D2740", "after": "ghost"}])
    assert r.status_code == 422


def test_golden_numbers_untouched():
    from app.data import load_catalog, load_plans
    from app.engine.estimate import estimate
    from app.models import Usage

    demo, cat = load_plans()["preferred"], load_catalog()
    r = estimate(cat["D2740"], demo, Usage(max_used=1100), True)
    assert (r.plan_pays, r.you_pay) == (400, 800)
    r = estimate(cat["D2740"], demo, Usage(), False)
    assert (r.plan_pays, r.you_pay, r.balance_bill) == (575, 925, 300)
