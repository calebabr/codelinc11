# F7: Choose a Plan (Monte Carlo plan comparison)

**Status: built** on `feature/choose-a-plan` (tasks T27 to T29, T31, T34 and T35 in `agents/tasks/`), **not pushed or merged to `main` yet**. Checked 2026-10-03: backend 391 tests passed (ruff clean), frontend 151 tests, typecheck and build clean. The page and the saved comparisons were not yet clicked through in a browser by a human, and no Playwright test exists. Owner: Caleb (engine + API), frontend agent (Plans page), AI agent (assistant tool).
**Branch:** `feature/choose-a-plan` off `main`; merge only when every check passes and it has been seen live. Caleb merges.
Original sketch: [../planning/path1-deep-dive.md](../planning/path1-deep-dive.md) section 4.5. Feature list: [../FEATURES.md](../FEATURES.md) F7.

## What was built (2026-10-03)
| Layer | Where |
|---|---|
| Engine | `backend/app/engine/simulate.py` (`simulate()`, pure Python, `random.Random(seed)`, no numpy; prices through `run_year()` / `estimate()` only) |
| API | `POST /simulate` in `backend/app/routers/simulate.py` (bearer token; 100 to 20,000 years; 404 unknown plan; 422 unknown code) |
| Assistant | tool `compare_plans` in `backend/app/agent/tools.py` (n 5,000, seed 42, same as the page) |
| Frontend | "Which plan fits us?" section on the Plans page: `frontend/src/features/plans/WhichPlanFits.tsx`, `SimulateResults.tsx`, `useSimulate.ts`; call in `frontend/src/lib/api/simulate.ts`; types in `frontend/src/lib/types/simulate.ts` |
| Saved comparisons | `POST/GET/PUT/DELETE /members/{id}/saved-simulations` in `backend/app/routers/saved_simulations.py` (migration `003_saved_simulations.sql`); the client sends only its choices and the **server runs `simulate()` itself** and stores the headline summary (winner, per-plan share, median, p90, current plan id), so a saved result cannot be forged. Same access rules as saved plans; at most 20 per member. Page: `SaveComparison.tsx` ("Save to Plan My Year"); Plan My Year lists them in `SavedComparisons.tsx`; Open jumps to Plans with the choices filled in and re-runs live |
| Assistant follow-ups | `compare_plans` returns `plan_terms`; the chat `done` event can carry up to 4 `followups` shown as "Ask next" chips; chips "Summarize the plan simulations" and "How are the simulations calculated?"; a percentage guard (`guard.check_percents`) next to the dollar guard. See [../AI.md](../AI.md) |
| Rate limit | `/simulate` counts toward `RATE_COMPUTE_PER_MINUTE` (60 a minute per household) |
| Tests | `backend/tests/test_simulate.py`, `test_simulate_api.py`, `test_agent_compare_plans.py`, `test_agent_sim_followups.py`, `test_saved_simulations.py`; `frontend/src/features/plans/WhichPlanFits.test.tsx`, `SaveComparison.test.tsx` |

### Result for the Halog household (checked 2026-10-03)
Marc 41, AC 39, Sophia 9, Hannah 23, everyone on average care, 5,000 years, seed 42, in network. It runs in about 0.1 to 0.2 seconds. Premiums per year: Basic $1,344, Preferred $2,112, Premium $2,928.

| | Cheapest in | Typical year (median) | Bad year (90th percentile) |
|---|---|---|---|
| **No known care** | | | |
| Basic | 82% | $1,939 | $3,294 |
| Preferred | 17% | $2,392 | $3,092 |
| Premium | 1% | $3,123 | $3,528 |
| **With AC's crown (D2740 x 1) as known care** | | | |
| Basic | 39% | $3,139 | $4,494 |
| Preferred | 54% | $2,992 | $3,852 |
| Premium | 7% | $3,498 | $3,903 |

Without known care the winner is Basic; with the crown it is Preferred. All totals include premiums. The odds behind these numbers are **synthetic placeholders**, not claims data, and the screen says so.

## The question it answers
"Which dental plan should my family pick?" Today the Plans page compares Basic, Preferred and Premium by their rules (premium, deductible, coinsurance, yearly maximum). That tells you what each plan *is*, not what it would *cost you*. Nobody knows next year's dental care in advance, so the honest answer is a range: "Premium is the cheapest choice in X% of likely years for your household, costs $X in a typical year, and protects you best in a bad year."

## What the user sees (Plans page, new "Which plan fits us?" section)
1. **Who is covered:** the household members are pre-filled from the database (ages drive the odds). Tap a person to mark a care level: *Low* (healthy teeth), *Average*, *High* (frequent dental work).
2. **Known care:** tap treatments someone already knows they need (for example AC's crown). Reuses the Plan My Year treatment cards.
3. **Results, one card per plan:**
   - "Cheapest in **X%** of years" (the headline, largest number on the card)
   - Typical year (median) total: premiums + what you pay
   - Bad year (90th percentile) total
   - A small distribution chart (box plot or overlaid histogram, Recharts) for the three plans
4. **Why:** plain-language reasons from the engine trace, for example "Premium costs $204 more a year in premiums, but your planned crown and AC's higher care level make big bills likely, where Premium's 70% major coverage and $2,500 maximum pay more."
5. The estimate disclaimer, plus: "Based on simulated years with synthetic odds, not a prediction for your family."

The assistant gets a new tool, `compare_plans`, so "Which plan should we choose?" returns the same numbers in chat.

## How it works
- **Simulate N years** (default 5,000) for the whole household. For each person and each simulated year:
  - Preventive: two exams and cleanings (most people), drawn per care level.
  - Fillings, root canals, crowns, extractions: Poisson counts with rates by care level and age band (table below).
  - Known care is added to every simulated year.
- **Common random numbers:** each simulated year is generated once and then priced under all three plans. This makes the comparison fair (the plans see identical years) and cuts noise.
- **Pricing uses the existing engine only:** every simulated year runs through `engine/annual.py` / `estimate()` per person (each person has their own deductible, maximum and frequency limits), plus 12 months of premium. No new money formulas.
- **Fixed seed** (default 42), so the same inputs always give the same output and tests can check exact results.
- **Outputs per plan:** mean, median, 10th and 90th percentile total cost, and the share of simulated years in which that plan is the cheapest.

### Draft yearly rates per person (synthetic placeholders; M to review)
| Care level | Exams and cleanings | Fillings | Root canals | Crowns | Extractions |
|---|---|---|---|---|---|
| Low | 2 | 0.2 | 0.02 | 0.03 | 0.02 |
| Average | 2 | 0.6 | 0.05 | 0.10 | 0.05 |
| High | 2 | 1.5 | 0.15 | 0.40 | 0.10 |

Children under 13 use the "Low" restorative rates plus sealants; braces are out of scope (orthodontia is stored but not used by the engine).

## Build plan (original sketch; what was built is in the tables above)
| Layer | Work | Files |
|---|---|---|
| Engine | `simulate()` with `random.Random(seed)` (no numpy, see the decisions below), a `sample_year()` helper, results per plan | `backend/app/engine/simulate.py` (new) |
| Models | `SimulateRequest` (members with age and care level, known items, n, seed), `SimulateResponse` | `backend/app/models.py` |
| API | `POST /simulate`; `GET /members/{id}/...`-style household defaults come from the existing household API | `backend/app/routers/simulate.py` (new) |
| AI | `compare_plans` tool calling `simulate()`; the number guard already covers its output | `backend/app/agent/tools.py` |
| Frontend | "Which plan fits us?" section, care-level chips, known-care cards, result cards, distribution chart | `frontend/src/features/plans/`, `frontend/src/lib/api/plans.ts` |
| Docs | Method and rates | `docs/MATH.md`, `docs/AI.md`, this file |

No new backend dependency was added: the pure-Python version with cached pricing runs n = 5,000 for 4 people x 3 plans in about 0.15 seconds.

## Tests (must pass before merge)
- Same seed and inputs give identical results; a different seed changes them slightly but not the winner for a clear case.
- A zero-care profile (no procedures) makes the cheapest-premium plan (Basic) win 100% of years, with totals equal to 12 x premium.
- Adding a known crown for an adult raises Premium's "cheapest" share compared with no known care.
- Every simulated total equals premiums plus the sum of engine `you_pay` values (spot-check a few years against `estimate()` directly).
- Probabilities across the three plans add up to 100% (ties broken by premium, documented).
- API: `POST /simulate` returns the shape and rejects n above a limit (for example 20,000) to keep responses fast.
- Frontend: results render from a mocked response; no dollar math in the frontend; layout works at 375 px.
- Golden numbers G1-G6 and S2 still pass unchanged.

## Acceptance
- With the seeded Halog household on Average care and no known care, the page shows one card per plan with a "cheapest in X% of years" figure, median and bad-year totals, and a chart, in under 2 seconds.
- Marking AC's crown as known care visibly shifts the result toward the plan with better major coverage.
- Asking the assistant "Which plan should we pick?" returns the same percentages as the page.

## Risks and limits
- The odds are synthetic placeholders; say so on screen and in the demo. Real rates would need claims data.
- New code the night before the demo: build on a branch; the current demo path stays untouched if it is not ready.
- Results compare plans for one plan year only; they ignore switching costs and waiting periods.

## Demo line
"We don't just tell you what a plan covers. We simulate five thousand possible years for your family and show which plan actually costs you the least, most of the time, with the same tested engine that prices every estimate."


## Decisions made before building (2026-10-04)
- **No numpy.** Pure Python (`random.Random(seed)`) is enough *if* pricing is cached: a person's simulated year is a list of procedure codes, and its cost under a plan depends only on (plan, ordered code list). Cache by that key (`functools.lru_cache` or a dict per request). Most simulated years repeat, so n = 5,000 x 4 people x 3 plans needs only a few hundred real `run_year()` calls. Target: under 2 seconds for the Halog household. If it is still too slow, lower the default to 2,000 and say so.
- **Canonical order inside a simulated year:** preventive, then basic, then major, ties by code. This makes results deterministic and lets the cache hit more. (The Plan My Year sequencer handles ordering for real treatments; this feature only prices a typical year.)
- **Poisson sampling** by Knuth's method with the seeded generator (rates are small).
- **Sampling order and common random numbers:** draw every person's year once, in a fixed person order, then price the same years under each plan. Never reseed per plan.
- **Out-of-network** is a request flag; in-network by default. Out-of-network pricing uses the same per-person estimate path as `annual_cost` (`estimate(..., in_network=False)`).
- **Ties:** a plan "wins" a year if its total is lowest; exact ties go to the lower monthly premium, then the plan id. Shares are rounded to whole percents and the largest remainder method makes them add to exactly 100.
- **Premiums:** `monthly_premium x 12 x covered people` (same as `annual_cost`).
- **Children under 13:** sealants instead of fillings at the low restorative rate; any person with `age < 13` ignores the "high" level for crowns and root canals (cap at average). Ages come from the household members.
- **Histogram:** the API returns shared bin edges and per-plan counts so the frontend never computes statistics.
- **Reasons** are generated in the engine from the numbers (no LLM): premium difference, and which of preventive, basic or major coverage drives the gap in a bad year.
- **Who can call it:** any signed-in member (bearer token); the request carries members and care levels, so it needs no household data from the database. The assistant tool reads the household members the viewer is allowed to see.

## API contract (frontend and backend build against this exactly)
`POST /simulate` (bearer token)
```json
{
  "members": [{"id": "m-alex", "name": "AC", "age": 34, "care_level": "average",
               "known_care": [{"code": "D2740", "count": 1}]}],
  "plan_ids": ["basic", "preferred", "premium"],
  "n": 5000, "seed": 42, "in_network": true
}
```
`plan_ids` defaults to all plans; `n` 100 to 20,000 (422 outside); `seed` defaults to 42; `members` 1 to 8, `care_level` is `low`, `average` or `high`, `known_care` up to 10 items with `count` 1 to 5.
Response 200:
```json
{
  "n": 5000, "seed": 42, "in_network": true,
  "plans": [{
    "plan_id": "premium", "name": "Premium", "monthly_premium": 61.0, "premiums_total": 2928.0,
    "mean": 0.0, "median": 0.0, "p10": 0.0, "p90": 0.0, "min": 0.0, "max": 0.0,
    "cheapest_share": 62,
    "histogram": [0, 12, 80]
  }],
  "bin_edges": [0.0, 250.0, 500.0],
  "winner_plan_id": "premium",
  "reasons": ["..."],
  "assumptions": ["Odds are synthetic placeholders, not claims data.", "..."],
  "disclaimer": "This is an estimate. Your actual cost depends on your dentist's charges and claim review."
}
```
All totals are the *whole household's* yearly total: premiums plus what the family pays. `histogram` has one count per bin (`len(bin_edges) - 1`), same edges for every plan. `cheapest_share` values sum to exactly 100.
Assistant tool: `compare_plans(care_levels?: {member_id: level}, known_codes?: [code])` returns the same fields (plus the members used).
