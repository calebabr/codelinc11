import os

# Make sure no real Ollama is contacted by accident (must be set before app import).
os.environ.setdefault("OLLAMA_URL", "http://127.0.0.1:9")

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

G3_USAGE = {"max_used": 1100, "deductible_met": 0}


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["chat_mode"] in ("anthropic", "ollama", "unavailable")
    assert isinstance(body["ollama_available"], bool)
    assert body["ollama_model"]


def test_plans_list():
    r = client.get("/plans")
    assert r.status_code == 200
    ids = {p["id"] for p in r.json()}
    assert ids == {"basic", "preferred", "premium"}


def test_plan_by_id_and_404():
    r = client.get("/plans/preferred")
    assert r.status_code == 200
    assert r.json()["annual_max"] == 1500
    assert client.get("/plans/nope").status_code == 404


def test_procedures_all_and_search():
    r = client.get("/procedures")
    assert r.status_code == 200
    assert len(r.json()) == 16
    assert all(m["score"] == 1 for m in r.json())
    r = client.get("/procedures", params={"q": "root canal"})
    assert r.status_code == 200
    assert r.json()[0]["procedure"]["code"] == "D3330"
    assert r.json()[0]["score"] == 1.0


def test_estimate_g3_over_http():
    r = client.post("/estimate", json={"plan_id": "preferred", "code": "D2740", "usage": G3_USAGE})
    assert r.status_code == 200
    body = r.json()
    assert body["in_network"]["plan_pays"] == 400
    assert body["in_network"]["you_pay"] == 800


def test_estimate_g1_g2_g4_g5_g6_over_http():
    def est(code, usage=None):
        payload = {"plan_id": "preferred", "code": code}
        if usage:
            payload["usage"] = usage
        r = client.post("/estimate", json=payload)
        assert r.status_code == 200
        return r.json()

    g1 = est("D1110")["in_network"]
    assert (g1["plan_pays"], g1["you_pay"], g1["deductible_applied"]) == (120, 0, 0)
    g2 = est("D2392")["in_network"]
    assert (g2["deductible_applied"], g2["plan_pays"], g2["you_pay"]) == (50, 120, 80)
    g4 = est("D2740")
    assert (g4["in_network"]["plan_pays"], g4["in_network"]["you_pay"]) == (575, 625)
    assert g4["out_of_network"]["you_pay"] == 925
    assert g4["out_of_network"]["balance_bill"] == 300
    assert g4["out_of_network"]["in_network"] is False
    g6 = est("D1110", {"history": ["D1110", "D1110"]})["in_network"]
    assert g6["covered"] is False
    assert (g6["plan_pays"], g6["you_pay"]) == (0, 120)


def test_estimate_defaults_to_demo_plan():
    r = client.post("/estimate", json={"code": "D2740"})
    assert r.status_code == 200
    assert r.json()["in_network"]["you_pay"] == 625


def test_estimate_inline_plan_wins_over_plan_id():
    plan = client.get("/plans/preferred").json()
    plan["annual_max"] = 100
    r = client.post("/estimate", json={"plan_id": "basic", "plan": plan, "code": "D2740"})
    assert r.status_code == 200
    assert r.json()["in_network"]["plan_pays"] == 100


def test_estimate_basic_plan_does_not_cover_major():
    r = client.post("/estimate", json={"plan_id": "basic", "code": "D2740"})
    assert r.status_code == 200
    assert r.json()["in_network"]["plan_pays"] == 0
    assert r.json()["in_network"]["you_pay"] == 1200


def test_estimate_premium_plan():
    r = client.post("/estimate", json={"plan_id": "premium", "code": "D2740"})
    assert r.status_code == 200
    assert r.json()["in_network"]["plan_pays"] == 805  # (1200 - 50 deductible) * 70%


def test_three_tiers_match_decision_d6():
    tiers = {p["id"]: p for p in client.get("/plans").json()}
    assert [tiers[k]["annual_max"] for k in ("basic", "preferred", "premium")] == [1000, 1500, 2500]
    assert [tiers[k]["deductible"] for k in ("basic", "preferred", "premium")] == [100, 50, 50]
    assert [tiers[k]["monthly_premium"] for k in ("basic", "preferred", "premium")] == [28, 44, 61]
    assert [tiers[k]["orthodontia_child"] for k in ("basic", "preferred", "premium")] == [0, 0.5, 0.6]
    for p in tiers.values():
        assert p["frequency"]["D1110"] == 2 and p["alternate_benefit"] is True


def test_estimate_404s_and_422():
    assert client.post("/estimate", json={"plan_id": "preferred", "code": "D9999"}).status_code == 404
    assert client.post("/estimate", json={"plan_id": "nope", "code": "D2740"}).status_code == 404
    assert client.post("/estimate", json={"plan_id": "preferred"}).status_code == 422


def _s2_body():
    return {
        "plan_id": "preferred",
        "items": [
            {"id": "t1", "code": "D3330", "urgency": "urgent"},
            {"id": "t2", "code": "D2740", "urgency": "flexible", "after": "t1"},
            {"id": "t3", "code": "D2392"},
            {"id": "t4", "code": "D2392"},
        ],
        "usage": {"max_used": 1100, "deductible_met": 50},
        "current_month": 11,
    }


def test_schedule_s2_over_http():
    r = client.post("/schedule", json=_s2_body())
    assert r.status_code == 200
    b = r.json()
    assert b["baseline_you_pay"] == 2300
    assert b["total_you_pay"] == 1405
    assert b["savings"] == 895
    by_id = {i["id"]: i for i in b["items"]}
    assert by_id["t1"]["year_offset"] == 0
    assert all(by_id[t]["year_offset"] == 1 for t in ("t2", "t3", "t4"))
    assert len(b["baseline_items"]) == 4
    assert b["reasons"]


def test_schedule_validation_and_errors():
    assert client.post("/schedule", json={"plan_id": "preferred"}).status_code == 422
    body = _s2_body()
    body["current_month"] = 13
    assert client.post("/schedule", json=body).status_code == 422
    body = _s2_body()
    body["items"][0]["code"] = "D9999"
    assert client.post("/schedule", json=body).status_code in (404, 422)
    body = _s2_body()
    body["plan_id"] = "nope"
    assert client.post("/schedule", json=body).status_code == 404
    body = _s2_body()
    body["items"] = [{"id": f"t{i}", "code": "D2392"} for i in range(11)]
    assert client.post("/schedule", json=body).status_code in (400, 422)


def test_benefits_status():
    r = client.post("/benefits-status", json={
        "plan_id": "preferred", "usage": {"max_used": 1100, "history": ["D1110"]}, "current_month": 11})
    assert r.status_code == 200
    b = r.json()
    assert b["max_remaining"] == 400
    freq = {f["code"]: f for f in b["frequencies"]}
    assert freq["D1110"]["used"] == 1 and freq["D1110"]["limit"] == 2
    assert b["reminder"]
    assert client.post("/benefits-status", json={"plan_id": "nope"}).status_code == 404
    assert client.post("/benefits-status", json={"plan_id": "preferred", "current_month": 0}).status_code == 422


def test_reminders_ics():
    r = client.get("/reminders.ics", params={"plan_name": "Preferred", "max_remaining": 400, "month": 11})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/calendar")
    text = r.text
    assert "BEGIN:VCALENDAR" in text and "END:VCALENDAR" in text
    assert text.count("BEGIN:VEVENT") == 2
    assert "Use your dental benefits before they reset" in text
    assert "1201" in text and "1215" in text


def test_cors_allows_vite_origin():
    r = client.get("/health", headers={"Origin": "http://localhost:5173"})
    assert r.headers.get("access-control-allow-origin") in ("http://localhost:5173", "*")


def test_chat_endpoint_streams_sse():
    body = {"messages": [{"role": "user", "content": "What will a crown cost me?"}],
            "plan_id": "preferred", "usage": G3_USAGE}
    r = client.post("/chat", json=body)
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/event-stream")
    assert "event: done" in r.text
    assert "event: token" in r.text


def test_chat_422():
    assert client.post("/chat", json={}).status_code == 422
