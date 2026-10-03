from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def ask(**body):
    r = client.post("/questions", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def sec(data, sid):
    return next((s for s in data["sections"] if s["id"] == sid), None)


def ids(data):
    return [q["id"] for s in data["sections"] for q in s["questions"]]


def test_safety_note_and_urgency_first():
    for body in ({}, {"codes": ["D2740"]}, {"codes": ["D2740", "D2392"], "plan_id": "basic"}):
        d = ask(**body)
        assert "don't wait" in d["safety_note"]
        assert d["sections"][0]["id"] == "urgency"
        assert d["sections"][0]["title"] == "Is it urgent?"


def test_empty_codes_general_sections():
    d = ask(codes=[], current_month=3)
    assert [s["id"] for s in d["sections"]] == ["urgency", "billing", "coverage", "alternatives"]


def test_crown_and_filling_specific():
    d = ask(codes=["D2740", "D2392"])
    p = sec(d, "procedure")
    assert p and p["title"].startswith("About ")
    got = {q["id"] for q in p["questions"]}
    assert "crown_buildup" in got and "fill_material" in got


def test_other_procedure_kinds():
    d = ask(codes=["D3330", "D7140", "D4341", "D6010", "D0120"])
    got = {q["id"] for q in sec(d, "procedure")["questions"]}
    assert {"rc_crown_after", "ext_replace", "deep_quads", "pros_healing", "prev_freq"} <= got


def test_timing_rules():
    assert sec(ask(codes=["D2740"], current_month=3), "timing") is None
    assert sec(ask(codes=["D2740", "D2392"], current_month=3), "timing") is not None
    assert sec(ask(codes=["D2740"], current_month=11), "timing") is not None
    low = {"max_used": 1300, "deductible_met": 50, "history": []}
    assert sec(ask(codes=["D2740"], current_month=3, usage=low), "timing") is not None


def test_alternate_benefit_toggles_with_plan():
    assert "coverage_alternate_benefit" in ids(ask(codes=["D2392"], plan_id="preferred"))
    no_alt = client.get("/plans/preferred").json() | {"alternate_benefit": False}
    assert "coverage_alternate_benefit" not in ids(ask(codes=["D2392"], plan=no_alt))


def test_frequency_question_toggles_with_plan():
    assert "coverage_freq_D1110" in ids(ask(codes=["D1110"]))
    assert "coverage_freq_D2740" not in ids(ask(codes=["D2740"]))
    inline = {"id": "x", "name": "X", "deductible": 0, "annual_max": 1000,
              "coinsurance": {"preventive": 1, "basic": 0.8, "major": 0.5}}
    assert "coverage_freq_D1110" not in ids(ask(codes=["D1110"], plan=inline))


def test_remaining_max_uses_engine_value():
    d = ask(codes=[], usage={"max_used": 1100, "deductible_met": 50, "history": []})
    text = " ".join(q["text"] for q in sec(d, "coverage")["questions"])
    assert "$400" in text


def test_unknown_code_ignored_and_ids_unique():
    d = ask(codes=["D9999", "D2740", "D2740", "d2392", "D2392"], current_month=3)
    assert sec(d, "procedure") is not None
    assert "D9999" not in str(d)
    all_ids = ids(d)
    assert len(all_ids) == len(set(all_ids))
    assert sec(ask(codes=["D9999"], current_month=3), "procedure") is None


def test_unknown_plan_404():
    assert client.post("/questions", json={"plan_id": "nope"}).status_code == 404
