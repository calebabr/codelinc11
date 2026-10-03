import random

from app.engine.annual import run_year
from app.engine.estimate import estimate
from app.engine.sequencer import best_schedule
from app.models import Plan, ScheduleRequest, TreatmentItem, Usage

CODES = ["D0120", "D0274", "D1110", "D1206", "D1351", "D2140", "D2391", "D2392",
         "D3330", "D4341", "D7140", "D2740", "D6240", "D5110", "D6010"]


def _rand_plan(rng):
    return Plan(
        id="rand", name="Random", deductible=rng.choice([0, 25, 50, 100]),
        annual_max=rng.choice([500, 1000, 1500, 2000]),
        coinsurance={"preventive": 1.0, "basic": rng.choice([0.5, 0.7, 0.8]),
                     "major": rng.choice([0.3, 0.4, 0.5])},
        frequency={"D1110": 2},
    )


def test_estimate_properties(catalog):
    rng = random.Random(1234)
    for _ in range(400):
        plan = _rand_plan(rng)
        usage = Usage(max_used=rng.uniform(0, plan.annual_max * 1.2),
                      deductible_met=rng.uniform(0, plan.deductible),
                      history=[rng.choice(CODES) for _ in range(rng.randint(0, 3))])
        proc = catalog[rng.choice(CODES)]
        for net in (True, False):
            r = estimate(proc, plan, usage, in_network=net)
            remaining = max(plan.annual_max - usage.max_used, 0)
            assert abs(r.plan_pays + r.you_pay - r.billed) < 0.011
            assert -1e-9 <= r.plan_pays <= remaining + 0.011
            assert r.you_pay >= -1e-9
            assert r.balance_bill >= -1e-9
            assert abs(r.balance_bill - (r.billed - r.allowed)) < 0.011
            if net:
                assert r.balance_bill == 0
            assert abs(r.max_used_after - (usage.max_used + r.plan_pays)) < 0.011


def test_run_year_never_exceeds_max(catalog):
    rng = random.Random(99)
    for _ in range(100):
        plan = _rand_plan(rng)
        procs = [catalog[rng.choice(CODES)] for _ in range(rng.randint(1, 8))]
        results, final = run_year(procs, plan, Usage())
        assert sum(r.plan_pays for r in results) <= plan.annual_max + 0.02
        assert final.max_used <= plan.annual_max + 0.02
        assert final.deductible_met <= plan.deductible + 0.011


def test_schedule_properties(catalog):
    rng = random.Random(777)
    for _ in range(40):
        plan = _rand_plan(rng)
        n = rng.randint(1, 5)
        items = []
        for i in range(n):
            after = None
            if i > 0 and rng.random() < 0.3:
                after = f"t{rng.randrange(i)}"
            urgency = rng.choice(["urgent", "soon", "flexible"])
            if urgency == "urgent" and after and items[int(after[1:])].urgency != "urgent":
                after = None  # spec is ambiguous when an urgent item waits on a non-urgent one
            items.append(TreatmentItem(id=f"t{i}", code=rng.choice(CODES),
                                       urgency=urgency, after=after))
        req = ScheduleRequest(
            plan=plan, items=items,
            usage=Usage(max_used=rng.uniform(0, plan.annual_max),
                        deductible_met=rng.choice([0, plan.deductible])),
            current_month=rng.randint(1, 12))
        resp = best_schedule(req, plan, catalog)
        assert resp.savings >= 0
        assert resp.total_you_pay <= resp.baseline_you_pay + 0.011
        assert len(resp.items) == n
        by_id = {i.id: i for i in resp.items}
        for it in items:
            sch = by_id[it.id]
            if it.urgency == "urgent":
                assert sch.year_offset == 0
            if it.after:
                pre = by_id[it.after]
                assert (pre.year_offset, pre.month) <= (sch.year_offset, sch.month)
            assert 1 <= sch.month <= 12
            if sch.year_offset == 0:
                assert sch.month >= req.current_month
