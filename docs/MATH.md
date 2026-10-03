# MATH

How each cost is calculated. All of it lives in `backend/app/engine/`. The frontend and the AI model never compute a dollar amount. The golden numbers below come from [FEATURES.md](FEATURES.md) section 2 and are checked exactly by `backend/tests/test_engine.py`. This file describes the code as of 2026-10-03.

## Inputs
- **Plan** (`backend/data/plans/*.json`): deductible, yearly maximum, share the plan pays for each category (preventive, basic, major), which categories skip the deductible, frequency limits (cleaning D1110 and exam D0120, 2 per year), plan year start month.
- **Procedure** (`backend/data/cdt_codes.json`, 16 procedures): code, name, category, typical fee `fee_p50` (in network), higher fee `fee_p80` (out-of-network billed).
- **Usage**: maximum used so far, deductible met so far, and the codes already done this year.

## One estimate (`engine/estimate.py`)
1. **Allowed amount** = the typical fee (`fee_p50`). **Billed** = the allowed amount in network, or `fee_p80` out of network. **Balance bill** = billed minus allowed (zero in network).
2. **Frequency limit.** If the code has a limit (for example 2 cleanings) and the history already has that many, the plan pays $0 and you pay the billed amount, with the reason in the trace.
3. **Deductible.** Zero for categories the plan waives it for (preventive). Otherwise the part of the deductible not yet met, but never more than the allowed amount.
4. **Plan share** = (allowed - deductible) x the category's percentage.
5. **Yearly maximum.** The plan pays the smaller of the plan share and what is left of the maximum.
6. **You pay** = billed - plan pays.

Every step is added to a `trace` with a plain-English note ("Show the math").

Out-of-network pays on the in-network allowed amount, and the dentist can bill the difference.

### Golden examples (Preferred plan: $50 deductible, $1,500 maximum, 100/80/50)
| ID | Situation | Result |
|---|---|---|
| G1 | Cleaning, fresh year | Plan pays $120, you pay $0 |
| G2 | One filling, fresh year | Deductible $50, then 80% of $150 = $120 plan, you pay $80 |
| G3 | Crown, deductible not met, $1,100 used | 50% of $1,150 = $575, capped at the $400 left, you pay $800 |
| G4 | Same crown, fresh year | Plan pays $575, you pay $625 (waiting saves $175) |
| G5 | Crown, out of network, fresh year | Plan pays $575 on a $1,200 allowed amount, billed $1,500, you pay $925, of which $300 is balance billing |
| G6 | Third cleaning in a plan year | Not covered, you pay $120, with the reason |

## One plan year (`engine/annual.py`)
`run_year` applies procedures one after another. After each one, deductible met, maximum used and history are updated, so the next procedure sees the new state.

## Plan My Year (`engine/sequencer.py`)
- Treatments have a code, an urgency (`urgent` or not) and an optional "after" (must come after another treatment). At most **10** treatments per request.
- The search tries **every** way to split the treatments between this plan year and the next (2^n cases). Urgent treatments never move to next year. A treatment cannot be in an earlier year than the one it follows.
- Inside a year the order is: urgent first, then respecting "after", then the lowest plan share first (so a fresh deductible lands where the plan pays least), then higher fee first.
- The best split is the one with the lowest total you pay (a tiny tie-break prefers fewer moved treatments).
- The baseline is "everything now" in the current year. **Savings** = baseline minus the best total.
- If an urgent treatment depends on another, that one is treated as urgent too, and the reasons say so.

### Scenario S2 (November, deductible met, $1,100 of $1,500 used)
Root canal D3330 (urgent), crown D2740 (after the root canal), two fillings D2392.

| | Plan pays | You pay |
|---|---|---|
| Everything now | $400 | $2,300 |
| Optimized, this year (root canal) | $400 | $700 |
| Optimized, next year (crown, then two fillings) | $895 | $705 |
| Optimized total | $1,295 | **$1,405** |

Savings: **$895**. The root canal stays this year.

## Benefits status (`engine/status.py`)
Maximum remaining, deductible remaining, frequency used and left, and the value of unused preventive visits (remaining visits x typical fee). From month 10 on, if anything is left, a reminder says that unused benefits will not carry over.

## Other engine modules
- `engine/tips.py`: savings tips (timing, network, using preventive visits, cheaper alternatives, a tax-account tip, quote checks). Each tip's numbers come from the engine.
- `backend/app/questions.py`: questions to ask your dentist (no dollar math).
- `backend/app/treatment_parser.py`: reads pasted quote text into treatments (it extracts, it does not price).

## Plan tiers (decision D6; placeholders, not real plans)
| | Basic | Preferred | Premium |
|---|---|---|---|
| Monthly premium | $28 | $44 | $61 |
| Yearly maximum | $1,000 | $1,500 | $2,500 |
| Deductible | $100 | $50 | $50 |
| Preventive / basic / major | 100 / 50 / 0 | 100 / 80 / 50 | 100 / 90 / 70 |
| Orthodontia (children), data only | 0% | 50% | 60% |

Orthodontia is stored but the engine does not use it yet. The database stores the same tiers in cents (`database/seeds/demo_household.json`).

## Not built yet
The annual-cost calculator on the engine (T05) and a plan-comparison simulation. Not described here until they exist.

## Rounding
Dollar amounts are rounded to cents in the engine. The database stores whole cents.
