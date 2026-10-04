# F7: Choose a Plan (Monte Carlo plan comparison)

**Status:** proposed, not built. Written 2026-10-03. Owner: Caleb (engine + API), frontend agent (Plans page), AI agent (assistant tool).
**Branch:** build on `feature/choose-a-plan` off `main`; merge only when every check passes and it has been seen live.
Original sketch: [../planning/path1-deep-dive.md](../planning/path1-deep-dive.md) section 4.5. Feature list: [../FEATURES.md](../FEATURES.md) F7.

## The question it answers
"Which dental plan should my family pick?" Today the Plans page compares Basic, Preferred and Premium by their rules (premium, deductible, coinsurance, yearly maximum). That tells you what each plan *is*, not what it would *cost you*. Nobody knows next year's dental care in advance, so the honest answer is a range: "Premium is the cheapest choice in 62% of likely years for your household, costs $X in a typical year, and protects you best in a bad year."

## What the user sees (Plans page, new "Which plan fits us?" section)
1. **Who is covered:** the household members are pre-filled from the database (ages drive the odds). Tap a person to mark a care level: *Low* (healthy teeth), *Average*, *High* (frequent dental work).
2. **Known care:** tap treatments someone already knows they need (for example Alex's crown). Reuses the Plan My Year treatment cards.
3. **Results, one card per plan:**
   - "Cheapest in **62%** of years" (the headline, largest number on the card)
   - Typical year (median) total: premiums + what you pay
   - Bad year (90th percentile) total
   - A small distribution chart (box plot or overlaid histogram, Recharts) for the three plans
4. **Why:** plain-language reasons from the engine trace, for example "Premium costs $204 more a year in premiums, but your planned crown and Alex's higher care level make big bills likely, where Premium's 70% major coverage and $2,500 maximum pay more."
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

## Build plan
| Layer | Work | Files |
|---|---|---|
| Engine | `simulate()` with `numpy.random.default_rng(seed)`, a `sample_year()` helper, results per plan | `backend/app/engine/simulate.py` (new) |
| Models | `SimulateRequest` (members with age and care level, known items, n, seed), `SimulateResponse` | `backend/app/models.py` |
| API | `POST /simulate`; `GET /members/{id}/...`-style household defaults come from the existing household API | `backend/app/routers/simulate.py` (new) |
| AI | `compare_plans` tool calling `simulate()`; the number guard already covers its output | `backend/app/agent/tools.py` |
| Frontend | "Which plan fits us?" section, care-level chips, known-care cards, result cards, distribution chart | `frontend/src/features/plans/`, `frontend/src/lib/api/plans.ts` |
| Docs | Method and rates | `docs/MATH.md`, `docs/AI.md`, this file |

`numpy` is a new backend dependency (`backend/requirements.txt`). A pure-Python version is fine too at n = 5,000 for 4 people x 3 plans if we want to avoid it.

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
- With the seeded Rivera household on Average care and no known care, the page shows one card per plan with a "cheapest in X% of years" figure, median and bad-year totals, and a chart, in under 2 seconds.
- Marking Alex's crown as known care visibly shifts the result toward the plan with better major coverage.
- Asking the assistant "Which plan should we pick?" returns the same percentages as the page.

## Risks and limits
- The odds are synthetic placeholders; say so on screen and in the demo. Real rates would need claims data.
- New code the night before the demo: build on a branch; the current demo path stays untouched if it is not ready.
- Results compare plans for one plan year only; they ignore switching costs and waiting periods.

## Demo line
"We don't just tell you what a plan covers. We simulate five thousand possible years for your family and show which plan actually costs you the least, most of the time, with the same tested engine that prices every estimate."
