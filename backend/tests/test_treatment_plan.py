import json

import pytest
from fastapi.testclient import TestClient

from app import treatment_parser
from app.main import app

client = TestClient(app)

SAMPLE = """Treatment plan: Phase 1 (urgent)
  Tooth 19   Root canal, molar        D3330    $1,100
Phase 2
  Tooth 19   Crown, porcelain         D2740    $1,200
  Tooth 14   Filling, 2 surfaces      D2392    $200
  Tooth 15   Filling, 2 surfaces      D2392    $200
"""


class _NoOllama:
    def is_available(self) -> bool:
        return False


@pytest.fixture(autouse=True)
def no_ollama(monkeypatch):
    monkeypatch.setattr(treatment_parser, "OllamaClient", _NoOllama)


def parse(text: str):
    r = client.post("/treatment-plan/parse", json={"text": text})
    assert r.status_code == 200, r.text
    return r.json()


def test_sample_plan():
    data = parse(SAMPLE)
    assert data["mode"] == "rules"
    assert data["unmatched_lines"] == []
    items = data["items"]
    assert [i["id"] for i in items] == ["q1", "q2", "q3", "q4"]
    assert [i["code"] for i in items] == ["D3330", "D2740", "D2392", "D2392"]
    assert [i["tooth"] for i in items] == ["19", "19", "14", "15"]
    assert [i["quoted_fee"] for i in items] == [1100, 1200, 200, 200]
    assert [i["typical_fee"] for i in items] == [1100, 1200, 200, 200]
    assert [i["urgency"] for i in items] == ["urgent", "soon", "soon", "soon"]
    assert [i["phase"] for i in items] == ["Phase 1", "Phase 2", "Phase 2", "Phase 2"]
    assert all(i["matched"] and i["confidence"] == 1.0 for i in items)
    assert items[1]["after"] == "q1"
    assert items[0]["after"] is None and items[2]["after"] is None
    assert "We matched 4 of 4 lines." in data["notes"]


@pytest.mark.parametrize(
    "line,fee",
    [
        ("D2740 tooth 3 $1,250", 1250),
        ("D2740 tooth 3 $1250.00", 1250),
        ("D2740 tooth 3 1100.00", 1100),
        ("D2740 tooth 3 1,100", 1100),
        ("D2740 tooth 3 $99.5", 99.5),
    ],
)
def test_fee_formats(line, fee):
    items = parse(line)["items"]
    assert len(items) == 1 and items[0]["quoted_fee"] == fee and items[0]["tooth"] == "3"


@pytest.mark.parametrize(
    "line,tooth",
    [("D2740 #19", "19"), ("D2740 tooth no. 7", "7"), ("D2740 Tooth #12", "12"), ("D2740 #18-19", "18")],
)
def test_tooth_formats(line, tooth):
    assert parse(line)["items"][0]["tooth"] == tooth


def test_name_only_line():
    data = parse("crown on #30 $1,250")
    (item,) = data["items"]
    assert item["code"] == "D2740" and item["tooth"] == "30" and item["quoted_fee"] == 1250
    assert item["matched"] and 0.5 <= item["confidence"] <= 0.9
    assert item["typical_fee"] == 1200
    assert item["urgency"] == "flexible"


def test_two_surface_filling_name_only():
    (item,) = parse("Tooth 14 Filling, 2 surfaces $210")["items"]
    assert item["code"] == "D2392"


def test_unmatched_line_is_kept_and_headings_totals_ignored():
    text = """Treatment plan for Jane
Tooth 8   Zirconia veneer glow-up   $950
Tooth 19  Root canal  D3330  $1,100

Total: $2,050
"""
    data = parse(text)
    assert [i["code"] for i in data["items"]] == ["D3330"]
    assert len(data["unmatched_lines"]) == 1
    assert "veneer" in data["unmatched_lines"][0]
    assert "We matched 1 of 2 lines." in data["notes"]


def test_unknown_code_goes_to_unmatched():
    data = parse("D9999 tooth 5 $300")
    assert data["items"] == [] and len(data["unmatched_lines"]) == 1


def test_urgency_keywords():
    data = parse(
        "Root canal D3330 tooth 2 ASAP\n"
        "Crown D2740 tooth 3 recommended\n"
        "Cleaning D1110 when convenient\n"
        "Filling D2392 tooth 5 with pain\n"
        "Sealant D1351 tooth 6"
    )
    assert [i["urgency"] for i in data["items"]] == ["urgent", "soon", "flexible", "urgent", "flexible"]


def test_phase_three_flexible():
    items = parse("Phase 3\nBridge D6240 $1,300")["items"]
    assert items[0]["urgency"] == "flexible" and items[0]["phase"] == "Phase 3"


def test_no_dependency_on_different_teeth():
    items = parse("Root canal D3330 tooth 2\nCrown D2740 tooth 3")["items"]
    assert items[1]["after"] is None


@pytest.mark.parametrize("text", ["", "   \n\t  "])
def test_empty_text_422(text):
    r = client.post("/treatment-plan/parse", json={"text": text})
    assert r.status_code == 422
    assert "treatment plan" in r.json()["detail"].lower()


def test_too_long_422():
    r = client.post("/treatment-plan/parse", json={"text": "x" * 20_001})
    assert r.status_code == 422


def test_no_treatments_note():
    data = parse("Hello there, thanks for visiting")
    assert data["items"] == [] and data["unmatched_lines"] == []
    assert any("couldn't find" in n for n in data["notes"])


class _FakeOllama:
    def __init__(self, proposals):
        self.proposals = proposals

    def is_available(self):
        return True

    def chat(self, messages, tools=None):
        return {"message": {"content": "Sure! " + json.dumps(self.proposals)}}


def test_ollama_assist_rejects_bad_code_and_unverifiable_fee(monkeypatch):
    text = "Tooth 8 Zirconia veneer $950\nTooth 9 Mystery work\nTooth 11 Zorp"
    proposals = [
        {"line": "Tooth 8 Zirconia veneer $950", "code": "D2740", "fee": 5000},  # fee not in text
        {"line": "Tooth 9 Mystery work", "code": "D9999", "fee": 10},  # bad code
        {"line": "not a real line", "code": "D1110"},  # line not in input
    ]
    monkeypatch.setattr(treatment_parser, "OllamaClient", lambda: _FakeOllama(proposals))
    data = parse(text)
    assert data["mode"] == "ollama"
    assert len(data["items"]) == 1
    item = data["items"][0]
    assert item["code"] == "D2740" and item["quoted_fee"] == 950 and item["confidence"] == 0.6
    assert item["tooth"] == "8"
    assert data["unmatched_lines"] == ["Tooth 9 Mystery work", "Tooth 11 Zorp"]


def test_ollama_assist_nothing_verifiable_stays_rules(monkeypatch):
    proposals = [{"line": "Tooth 9 Mystery work", "code": "D9999"}]
    monkeypatch.setattr(treatment_parser, "OllamaClient", lambda: _FakeOllama(proposals))
    data = parse("Tooth 9 Mystery work")
    assert data["mode"] == "rules" and data["items"] == []


def test_ollama_failure_is_silent(monkeypatch):
    class Boom(_FakeOllama):
        def chat(self, messages, tools=None):
            raise RuntimeError("down")

    monkeypatch.setattr(treatment_parser, "OllamaClient", lambda: Boom([]))
    data = parse("Tooth 9 Mystery work")
    assert data["mode"] == "rules" and len(data["unmatched_lines"]) == 1


def test_ollama_not_called_without_unmatched(monkeypatch):
    def explode():
        raise AssertionError("should not be constructed")

    monkeypatch.setattr(treatment_parser, "OllamaClient", explode)
    assert parse(SAMPLE)["mode"] == "rules"


REALISTIC = (
    "SMILE FIRST FAMILY DENTISTRY\nPatient: AC     Exam date: 10/02/2026\n\nTREATMENT PLAN\n"
    "Phase 1 (urgent: pain, lower left)\n  #19   D3330   Root canal, molar    $1,100.00\n\nPhase 2\n"
    "  #19   D2740   Crown, porcelain/ceramic    $1,600.00\n"
    "  #14   D2392   Filling, 2 surfaces (composite)    $200.00\n"
    "  #15   D2392   Filling, 2 surfaces (composite)    $200.00\n\nPhase 3 (when convenient)\n"
    "        D1110   Cleaning (adult)    $120.00\n  #8    Zirconia veneer    $950.00\n\n"
    "Total estimate: $4,170.00\n"
)


def test_realistic_office_quote():
    data = parse(REALISTIC)
    items = data["items"]
    assert [i["id"] for i in items] == ["q1", "q2", "q3", "q4", "q5"]
    assert [i["code"] for i in items] == ["D3330", "D2740", "D2392", "D2392", "D1110"]
    assert items[1]["after"] == "q1"
    assert items[1]["quoted_fee"] == 1600 and items[1]["typical_fee"] == 1200
    assert items[0]["urgency"] == "urgent" and items[4]["urgency"] == "flexible"
    assert len(data["unmatched_lines"]) == 1 and "veneer" in data["unmatched_lines"][0]


@pytest.mark.parametrize(
    "line",
    [
        "Patient: AC     Exam date: 10/02/2026",
        "Exam 2026",
        "Exam date: 2026-10-02",
        "Periodic exam Oct 2, 2026",
        "DOB 03/14/1988",
        "Provider: Dr. Lee 555-123-4567",
        "Subtotal: $1,000",
        "Total estimate: $4,170.00",
        "Insurance estimate $500",
        "Crown",
        "Cleaning",
    ],
)
def test_header_date_total_and_nameonly_lines_make_no_items(line):
    data = parse(line)
    assert data["items"] == []


def test_year_not_a_fee_and_date_stripped():
    (item,) = parse("D0120 tooth 2 on 10/02/2026")["items"]
    assert item["quoted_fee"] is None
    (item,) = parse("D0120 2026")["items"]
    assert item["quoted_fee"] is None
    (item,) = parse("D2740 #3 1,600")["items"]
    assert item["quoted_fee"] == 1600
