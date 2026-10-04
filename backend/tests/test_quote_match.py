"""Quote to dentist matching (sprint 2, B4, story 7): GET /treatment-plan/samples and the
provider_match object on POST /treatment-plan/parse. Temporary database, no network, no model."""
import pytest
from fastapi.testclient import TestClient

from app.data import load_catalog, load_plans
from app.db import Store
from app.db.core import reset
from app.engine.estimate import estimate
from app.main import app
from app.models import Usage
from app.quote_match import UNMATCHED_NOTE, find_provider, match_provider
from app.routers.session import get_store


@pytest.fixture()
def store(tmp_path):
    path = tmp_path / "quote.db"
    reset(path)
    return Store(path)


@pytest.fixture()
def client(store):
    app.dependency_overrides[get_store] = lambda: store
    yield TestClient(app)
    app.dependency_overrides.clear()


def samples(client):
    r = client.get("/treatment-plan/samples")
    assert r.status_code == 200
    return {s["id"]: s for s in r.json()}


def parse(client, text, plan_id=None):
    body = {"text": text}
    if plan_id:
        body["plan_id"] = plan_id
    r = client.post("/treatment-plan/parse", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def test_three_samples_with_directory_headers(client, store):
    s = samples(client)
    assert list(s) == ["sample-quote-in-network", "sample-quote-out-of-network", "sample-quote-unknown"]
    assert [x["expected_network"] for x in s.values()] == ["in", "out", "unknown"]
    for x in s.values():
        assert set(x) == {"id", "title", "description", "expected_network", "text"}
    names = {p["practice_name"]: p for p in store.list_providers()}
    a, b = s["sample-quote-in-network"]["text"], s["sample-quote-out-of-network"]["text"]
    for text, name in ((a, "Plainsman Family Dental"), (b, "Magnolia Row Oral Surgery")):
        p = names[name]
        assert name in text and p["phone"] in text and p["zip"] in text and p["dentist_name"] in text
    unknown = s["sample-quote-unknown"]["text"]
    assert not any(n in unknown for n in names)
    assert all(p["phone"] not in unknown for p in names.values())


def test_in_network_sample_matches(client):
    text = samples(client)["sample-quote-in-network"]["text"]
    r = parse(client, text, "preferred")
    pm = r["provider_match"]
    assert pm["matched"] is True and pm["provider_id"] == "prv-001" and pm["in_network"] is True
    assert pm["name"] == "Plainsman Family Dental" and pm["dentist"] == "Dr. Priya Nair"
    assert pm["address"] == "1204 Heartwood Lane, Auburn, AL 36830" and pm["source"] == "insurer directory"
    assert "in your plan's network" in pm["network_note"]
    # The quote itself is still read as before: three treatments, nothing left over.
    assert [i["code"] for i in r["items"]] == ["D3330", "D2740", "D2392"]
    assert r["unmatched_lines"] == [] and r["mode"] == "rules"
    assert r["items"][0]["urgency"] == "urgent"


def test_out_of_network_sample_matches_but_is_out_of_network(client):
    text = samples(client)["sample-quote-out-of-network"]["text"]
    r = parse(client, text, "preferred")
    pm = r["provider_match"]
    assert pm["matched"] is True and pm["provider_id"] == "prv-005" and pm["in_network"] is False
    assert "out of network" in pm["network_note"] and "balance billing" in pm["network_note"]
    assert [i["code"] for i in r["items"]] == ["D3330", "D2740"] and r["unmatched_lines"] == []
    # Out of network for every tier.
    for tier in ("basic", "preferred", "premium"):
        assert parse(client, text, tier)["provider_match"]["in_network"] is False


def test_unknown_practice_is_unmatched_and_priced_out_of_network(client):
    text = samples(client)["sample-quote-unknown"]["text"]
    for plan_id in (None, "preferred"):
        r = parse(client, text, plan_id)
        pm = r["provider_match"]
        assert pm["matched"] is False and pm["in_network"] is False
        assert pm["provider_id"] is None and pm["name"] is None and pm["address"] is None
        assert pm["network_note"] == UNMATCHED_NOTE and "out of network" in pm["network_note"]
        assert pm["source"] == "insurer directory"
        assert len(r["items"]) == 2 and r["unmatched_lines"] == []


def test_network_depends_on_the_plan_tier(client):
    # Loblolly Smiles is in network for Preferred and Premium but not Basic.
    text = "Loblolly Smiles\nD2392 Filling, 2 surfaces, tooth 14 - $210\n"
    assert parse(client, text, "preferred")["provider_match"]["in_network"] is True
    assert parse(client, text, "premium")["provider_match"]["in_network"] is True
    basic = parse(client, text, "basic")["provider_match"]
    assert basic["matched"] is True and basic["in_network"] is False
    # No plan, or a plan that is not a tier: matched, but in or out of network is not known.
    for plan_id in (None, "demo_ppo"):
        pm = parse(client, text, plan_id)["provider_match"]
        assert pm["matched"] is True and pm["in_network"] is None and "Choose your plan" in pm["network_note"]


def test_how_a_practice_is_found(store):
    ps = store.list_providers()
    # By phone alone, written in different styles.
    for phone in ("334-555-0101", "(334) 555-0101", "334.555.0101", "3345550101"):
        assert find_provider(f"Office of Dentistry\nPhone: {phone}\nD1110 Cleaning $120", ps)["id"] == "prv-001"
    # By practice name alone, in any case or punctuation.
    assert find_provider("LOBLOLLY SMILES, Auburn\nD1110 Cleaning", ps)["id"] == "prv-002"
    # By dentist name together with the ZIP.
    assert find_provider("Dr. Priya Nair\nAuburn, AL 36830\nD1110 Cleaning", ps)["id"] == "prv-001"
    # A ZIP alone, or a dentist name alone, is not enough.
    assert find_provider("Some Practice\nAuburn, AL 36830\nD1110 Cleaning", ps) is None
    assert find_provider("Dr. Priya Nair\nD1110 Cleaning", ps) is None
    assert find_provider("", ps) is None
    assert find_provider("Magnolia Row Oral Surgery\n334-555-0105", ps)["id"] == "prv-005"
    # Only the top of the quote is read.
    far = "\n".join(["line"] * 25 + ["Plainsman Family Dental"])
    assert find_provider(far, ps) is None


def test_match_provider_function_directly(store):
    ps = store.list_providers()
    pm = match_provider("Plainsman Family Dental", ps, "premium")
    assert pm.matched and pm.in_network is True
    assert not match_provider("nothing here", ps, "premium").matched


@pytest.mark.parametrize("sample_id", ["sample-quote-in-network", "sample-quote-out-of-network",
                                       "sample-quote-unknown"])
def test_pricing_follows_the_match_and_equals_the_engine(client, sample_id):
    """Priced the way the match says (in network, or out of network), the numbers equal the engine's."""
    text = samples(client)[sample_id]["text"]
    pm = parse(client, text, "preferred")["provider_match"]
    plan = load_plans()["preferred"]
    http = client.post("/estimate", json={"code": "D2392", "plan_id": "preferred"}).json()
    branch = "in_network" if pm["in_network"] else "out_of_network"
    direct = estimate(load_catalog()["D2392"], plan, Usage(), pm["in_network"])
    assert http[branch]["you_pay"] == direct.you_pay and http[branch]["plan_pays"] == direct.plan_pays
    # Fresh-year crown: in network $625 (G4), out of network $925 with $300 balance billing (G5).
    g = estimate(load_catalog()["D2740"], plan, Usage(), pm["in_network"])
    assert (g.you_pay, g.balance_bill) == ((625, 0) if pm["in_network"] else (925, 300))


def test_existing_parse_behaviour_is_unchanged(client):
    assert client.post("/treatment-plan/parse", json={"text": "   "}).status_code == 422
    assert client.post("/treatment-plan/parse", json={"text": "x" * 20_001}).status_code == 422
    r = parse(client, "D2740 Crown tooth 19 $1,200 urgent")
    assert [i["code"] for i in r["items"]] == ["D2740"] and r["items"][0]["quoted_fee"] == 1200
    assert r["provider_match"]["matched"] is False and r["provider_match"]["in_network"] is False


def test_a_directory_failure_never_breaks_the_parse(client, store, monkeypatch):
    def boom():
        raise RuntimeError("directory down")
    monkeypatch.setattr(store, "list_providers", boom)
    r = parse(client, "D2740 Crown tooth 19 $1,200")
    assert len(r["items"]) == 1 and r["provider_match"]["matched"] is False
