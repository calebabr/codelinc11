import json
from pathlib import Path

from app.data import load_catalog, load_plans
from app.models import Plan, Procedure

DATA = Path(__file__).resolve().parents[1] / "data"


def test_plans_load():
    plans = load_plans()
    assert {"demo_ppo", "basic_ppo"} <= set(plans)
    for pid, p in plans.items():
        assert isinstance(p, Plan)
        assert p.id == pid


def test_demo_plan_values():
    p = load_plans()["demo_ppo"]
    assert p.deductible == 50
    assert p.annual_max == 1500
    assert p.coinsurance == {"preventive": 1.0, "basic": 0.8, "major": 0.5}
    assert p.frequency.get("D1110") == 2
    assert "preventive" in p.deductible_waived_for


def test_catalog_loads_all_16():
    cat = load_catalog()
    assert len(cat) == 16
    raw = json.loads((DATA / "cdt_codes.json").read_text(encoding="utf-8"))
    assert set(cat) == {r["code"] for r in raw}
    for code, proc in cat.items():
        assert isinstance(proc, Procedure)
        assert proc.code == code


def test_every_procedure_has_synonyms_and_sane_fees():
    for proc in load_catalog().values():
        assert len(proc.synonyms) >= 2, proc.code
        assert proc.fee_p80 >= proc.fee_p50 > 0, proc.code


def test_golden_codes_present():
    cat = load_catalog()
    for code in ["D1110", "D2392", "D3330", "D2740"]:
        assert code in cat
    assert cat["D2740"].fee_p50 == 1200 and cat["D2740"].fee_p80 == 1500
