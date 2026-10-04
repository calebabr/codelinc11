"""Monte Carlo plan comparison (F7): engine behavior. Pricing is checked against estimate()."""
import time

import pytest

from app.data import load_catalog, load_plans
from app.engine.annual import run_year
from app.engine.estimate import estimate
from app.engine.simulate import (
    UnknownCode,
    UnknownPlan,
    bin_edges,
    largest_remainder,
    nearest_rank,
    price_person_year,
    sample_household_years,
    simulate,
)
from app.models import SimulateKnownCare, SimulateMember, SimulateRequest, Usage


def rivera(alex_known=None, level="average"):
    return [
        SimulateMember(id="m-jordan", name="Jordan Rivera", age=41, care_level=level),
        SimulateMember(id="m-alex", name="Alex Rivera", age=39, care_level=level,
                       known_care=alex_known or []),
        SimulateMember(id="m-maya", name="Maya Rivera", age=9, care_level=level),
        SimulateMember(id="m-noah", name="Noah Rivera", age=23, care_level=level),
    ]


def run(members, **kw):
    return simulate(SimulateRequest(members=members, **kw), load_plans(), load_catalog())


def by_id(res):
    return {p.plan_id: p for p in res.plans}


def test_same_seed_identical_and_different_seed_changes_numbers():
    a, b = run(rivera()), run(rivera())
    assert a == b
    c = run(rivera(), seed=7)
    assert c != a
    assert c.winner_plan_id == a.winner_plan_id  # a clear case: the winner holds
    assert by_id(c)["basic"].mean != by_id(a)["basic"].mean


def test_zero_care_basic_wins_every_year_at_twelve_premiums_per_person():
    people = rivera()
    res = simulate(SimulateRequest(members=people, n=500), load_plans(), load_catalog(), _zero_care=True)
    p = by_id(res)
    assert p["basic"].cheapest_share == 100 and p["preferred"].cheapest_share == 0
    assert res.winner_plan_id == "basic"
    for plan_id, premium in (("basic", 28), ("preferred", 44), ("premium", 61)):
        want = 12 * premium * len(people)
        r = p[plan_id]
        assert r.mean == r.median == r.p10 == r.p90 == r.min == r.max == want


def test_known_crown_raises_premium_share_and_moves_toward_better_major_coverage():
    base = by_id(run(rivera()))
    crown = by_id(run(rivera([SimulateKnownCare(code="D2740")])))
    assert crown["premium"].cheapest_share > base["premium"].cheapest_share
    assert crown["basic"].cheapest_share < base["basic"].cheapest_share


def test_simulated_years_match_estimate_directly():
    catalog, plans = load_catalog(), load_plans()
    people = rivera([SimulateKnownCare(code="D2740", count=2)])
    years = sample_household_years(people, 50, 42, catalog)
    for year in years[:10]:
        for codes in year:
            for plan in plans.values():
                got, split = price_person_year(plan, True, codes, catalog)
                results, _ = run_year([catalog[c] for c in codes], plan, Usage())
                assert got == round(sum(r.you_pay for r in results), 2)
                assert round(sum(split.values()), 2) == got
    # hand-priced: a crown with nothing used (G4 on the preferred plan), and out of network (G5)
    got, _ = price_person_year(plans["preferred"], True, ("D2740",), catalog)
    assert got == 625.0
    oon, _ = price_person_year(plans["preferred"], False, ("D2740",), catalog)
    assert oon == estimate(catalog["D2740"], plans["preferred"], Usage(), in_network=False).you_pay


def test_response_totals_equal_premiums_plus_engine_you_pay():
    catalog, plans = load_catalog(), load_plans()
    people = rivera([SimulateKnownCare(code="D3330")])
    n = 200
    res = run(people, n=n, seed=3)
    years = sample_household_years(people, n, 3, catalog)
    for plan_id, r in by_id(res).items():
        plan = plans[plan_id]
        totals = sorted(round(r.premiums_total + sum(price_person_year(plan, True, k, catalog)[0]
                                                     for k in y), 2) for y in years)
        assert (r.min, r.max) == (totals[0], totals[-1])
        assert r.median == nearest_rank(totals, 50) and r.p90 == nearest_rank(totals, 90)
        assert r.mean == round(sum(totals) / n, 2)


def test_shares_sum_to_100_and_histograms_sum_to_n():
    for n in (100, 333, 1000, 5000):
        for known in ([], [SimulateKnownCare(code="D2740")]):
            res = run(rivera(known), n=n)
            assert sum(p.cheapest_share for p in res.plans) == 100
            for p in res.plans:
                assert len(p.histogram) == len(res.bin_edges) - 1
                assert sum(p.histogram) == n
            assert 6 <= len(res.bin_edges) - 1 <= 16


def test_helpers():
    assert nearest_rank([1, 2, 3, 4], 50) == 2 and nearest_rank([1, 2, 3, 4], 90) == 4
    assert nearest_rank([5], 10) == 5
    assert largest_remainder([1, 1, 1], 3, [2, 0, 1]) == [33, 34, 33]
    assert sum(largest_remainder([5, 3, 2], 10, [0, 1, 2])) == 100
    e = bin_edges(1344.0, 6394.0)
    assert e[0] <= 1344 and e[-1] >= 6394 and all(round(x, 2) == x for x in e)
    assert bin_edges(500, 500) == [500.0, 501.0]


def test_out_of_network_costs_more_for_the_same_years():
    inn, oon = by_id(run(rivera(), n=300)), by_id(run(rivera(), n=300, in_network=False))
    assert oon["preferred"].mean > inn["preferred"].mean


def test_children_get_sealants_and_adults_get_fillings():
    catalog = load_catalog()
    kid = [SimulateMember(id="k", age=9, care_level="high")]
    flat = [c for y in sample_household_years(kid, 300, 1, catalog) for codes in y for c in codes]
    assert "D1351" in flat and "D2392" not in flat
    adult = [SimulateMember(id="a", age=30, care_level="high")]
    flat = [c for y in sample_household_years(adult, 300, 1, catalog) for codes in y for c in codes]
    assert "D2392" in flat and "D1351" not in flat


def test_canonical_order_is_preventive_basic_major():
    catalog = load_catalog()
    people = [SimulateMember(id="a", age=30, known_care=[SimulateKnownCare(code="D2740"),
                                                         SimulateKnownCare(code="D3330")])]
    codes = sample_household_years(people, 1, 1, catalog)[0][0]
    rank = {"preventive": 0, "basic": 1, "major": 2}
    ranks = [rank[catalog[c].category] for c in codes]
    assert ranks == sorted(ranks)


def test_reasons_and_assumptions_are_plain_and_built_from_numbers():
    res = run(rivera([SimulateKnownCare(code="D2740")]))
    text = " ".join(res.reasons)
    assert "%" in res.reasons[0] and res.winner_plan_id == "preferred"
    assert "premiums" in text and "major" in text
    assert any("synthetic" in a for a in res.assumptions)
    assert any("D2740" in a for a in res.assumptions)
    assert res.disclaimer.startswith("This is an estimate.")


def test_unknown_plan_and_code():
    with pytest.raises(UnknownPlan):
        run(rivera(), plan_ids=["nope"])
    with pytest.raises(UnknownCode):
        run(rivera([SimulateKnownCare(code="D9999")]))


def test_plan_ids_subset_and_single_plan():
    res = run(rivera(), plan_ids=["premium", "basic", "premium"], n=200)
    assert [p.plan_id for p in res.plans] == ["premium", "basic"]
    one = run(rivera(), plan_ids=["basic"], n=200)
    assert one.plans[0].cheapest_share == 100 and len(one.reasons) == 1


def test_rivera_household_runs_fast():
    start = time.perf_counter()
    res = run(rivera(), n=5000)
    assert time.perf_counter() - start < 5  # about 0.1 s locally; wide margin for CI
    assert res.n == 5000
