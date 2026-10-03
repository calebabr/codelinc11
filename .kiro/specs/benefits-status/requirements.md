# Requirements Document

## Introduction

The `benefits_status()` engine function computes a patient's current dental benefit position for a given plan year. Given a plan definition and the patient's year-to-date usage, it returns remaining annual maximum, deductible progress, frequency-limited procedure counts, unused preventive value, and a structured trace. It is a pure function: no LLM calls, no network access, no file writes — it only reads plan data passed in as input.

This function supports Feature F4 (My Benefits) in the CodéLinc11 dental benefits calculator.

---

## Glossary

- **Annual_Max**: The maximum dollar amount the plan will pay in a single plan year (e.g., $1,500 for Demo PPO).
- **Deductible**: The dollar amount the patient must pay out-of-pocket before coinsurance applies (e.g., $50 for Demo PPO). Preventive procedures are exempt from the deductible.
- **Coinsurance**: The percentage of the allowed amount the plan pays after the deductible is met. Categories: `preventive` (100%), `basic` (80%), `major` (50%).
- **Frequency_Limit**: The maximum number of times a specific procedure code is covered per plan year (e.g., cleanings: 2 per year).
- **Remaining_Max**: Annual_Max minus the total plan-paid amount so far this year. Cannot go below $0.
- **Remaining_Deductible**: Deductible minus the amount the patient has already applied toward the deductible this year. Cannot go below $0.
- **Frequency_Count**: The number of times a frequency-limited procedure has been used in the current plan year.
- **Remaining_Uses**: Frequency_Limit minus Frequency_Count for a given procedure. Cannot go below $0.
- **Unused_Preventive_Value**: The total dollar value of covered preventive procedures the patient has not yet used this year, calculated at in-network allowed amounts.
- **Plan**: A data structure containing Annual_Max, Deductible, coinsurance rates by category, and Frequency_Limit entries.
- **Usage**: A data structure describing what the patient has consumed this year: total plan-paid amount, amount applied to the deductible, and per-procedure-code usage counts.
- **BenefitsStatus**: The return value of `benefits_status()`, containing all computed fields plus a Trace.
- **Trace**: A list of human-readable strings explaining each computation step, so the UI can render "show the math".
- **Engine**: The pure Python module `backend/app/engine/` that performs all money math.

---

## Requirements

### Requirement 1: Compute Remaining Annual Maximum

**User Story:** As a patient, I want to see how much of my annual maximum is left, so that I know how much the plan will still pay this year.

#### Acceptance Criteria

1. THE Engine SHALL compute `Remaining_Max` as `Annual_Max − total_plan_paid_ytd`, where `Annual_Max` is greater than 0 and `total_plan_paid_ytd` is greater than or equal to 0.
2. IF `total_plan_paid_ytd` exceeds `Annual_Max`, THEN THE Engine SHALL return a `Remaining_Max` of `0`.
3. WHEN computing `Remaining_Max`, THE Engine SHALL add a Trace entry containing three labeled fields: the `Annual_Max` value, the `total_plan_paid_ytd` value (labeled as "used"), and the computed `Remaining_Max` value.
4. IF `Annual_Max` is less than or equal to 0 or `total_plan_paid_ytd` is less than 0, THEN THE Engine SHALL raise a `ValueError` indicating invalid input and SHALL NOT return a `Remaining_Max` value.

---

### Requirement 2: Compute Deductible Progress

**User Story:** As a patient, I want to see how much of my deductible I've already paid, so that I know what I still owe before coinsurance kicks in.

#### Acceptance Criteria

1. THE Engine SHALL compute `Remaining_Deductible` as `Deductible − deductible_paid_ytd` and SHALL set `deductible_met` to `False` when `deductible_paid_ytd` is less than `Deductible`.
2. IF `deductible_paid_ytd` equals or exceeds `Deductible`, THEN THE Engine SHALL return a `Remaining_Deductible` of `0` and set `deductible_met` to `True`.
3. WHERE `Deductible` is `0` for a plan, THE Engine SHALL return `Remaining_Deductible` of `0` and set `deductible_met` to `True`.
4. WHEN computing deductible progress, THE Engine SHALL add a Trace entry stating the `Deductible`, the `deductible_paid_ytd` amount, and the `Remaining_Deductible`.
5. IF `deductible_paid_ytd` is negative, THEN THE Engine SHALL raise a `ValueError` with a message indicating that `deductible_paid_ytd` must be non-negative.

---

### Requirement 3: Compute Frequency-Limited Procedure Counts

**User Story:** As a patient, I want to see how many times I can still use each frequency-limited benefit (such as cleanings), so that I don't accidentally schedule an uncovered visit.

#### Acceptance Criteria

1. THE Engine SHALL compute `Remaining_Uses` for each frequency-limited procedure code defined in the Plan as `max(0, Frequency_Limit − Frequency_Count)`.
2. IF `Frequency_Count` equals or exceeds `Frequency_Limit` for a procedure code, THEN THE Engine SHALL return `Remaining_Uses` of `0` for that code.
3. WHEN a procedure code has a `Frequency_Limit` but no recorded usage in the current plan year, THE Engine SHALL treat `Frequency_Count` as `0` and count only claims dated within the current plan year.
4. WHEN computing frequency counts, THE Engine SHALL add a Trace entry for each frequency-limited code stating the code, `Frequency_Limit`, `Frequency_Count`, and `Remaining_Uses`.
5. IF a procedure code is present in the frequency output, THEN it SHALL have a `Frequency_Limit` defined in the Plan; procedure codes without a `Frequency_Limit` SHALL be omitted from the frequency output.

---

### Requirement 4: Compute Unused Preventive Value

**User Story:** As a patient, I want to know the dollar value of preventive benefits I haven't used yet, so that I can take advantage of them before the plan year ends.

#### Acceptance Criteria

1. WHEN `benefits_status()` is called, THE Engine SHALL compute `Unused_Preventive_Value` as the sum of `max(0, Frequency_Limit − Frequency_Count) × in_network_allowed_fee` for each preventive procedure code in the Plan that has both a `Frequency_Limit` and an `in_network_allowed_fee` greater than 0.
2. IF all frequency-limited preventive procedures have been fully used (all `Remaining_Uses` equal 0), THEN THE Engine SHALL return `Unused_Preventive_Value` of `0`.
3. WHEN computing `Unused_Preventive_Value`, THE Engine SHALL add a Trace entry listing each contributing procedure code, its `Remaining_Uses`, its `in_network_allowed_fee`, and the per-code subtotal; if `Unused_Preventive_Value` is `0`, THE Engine SHALL still add a Trace entry stating that no preventive uses remain.
4. IF a preventive procedure code has an `in_network_allowed_fee` of `0`, THEN THE Engine SHALL exclude that code from the `Unused_Preventive_Value` calculation and SHALL omit it from the Trace entry.

---

### Requirement 5: Return a Structured BenefitsStatus Result

**User Story:** As a calling system, I want a single structured result from `benefits_status()`, so that I can display all benefit information consistently without calling multiple functions.

#### Acceptance Criteria

1. THE Engine SHALL return a `BenefitsStatus` value containing: `remaining_max` (the annual maximum minus `total_plan_paid_ytd`, clamped to a minimum of 0); `remaining_deductible` (the plan deductible minus `deductible_paid_ytd`, clamped to a minimum of 0); `deductible_met` (True if and only if `deductible_paid_ytd` is greater than or equal to the plan deductible); `frequency` (a mapping from each procedure code that has a frequency limit in the Plan to `{limit, used, remaining}`, where `remaining = limit − used`, clamped to a minimum of 0); `unused_preventive_value` (the sum, over every preventive procedure code in the Plan whose `used` count is less than its `limit`, of `(limit − used) × in_network_allowed_fee`); and `trace` (a list of strings describing each computation step, with one entry per field computed).
2. THE Engine SHALL accept a `Plan` and a `Usage` as its only inputs; it SHALL NOT read from the file system or make network calls.
3. IF all fields in `Plan` and `Usage` are non-negative and within their defined ranges, THEN THE Engine SHALL return a `BenefitsStatus` without raising an exception.
4. IF `total_plan_paid_ytd` is negative, THEN THE Engine SHALL raise a `ValueError` with a message indicating that `total_plan_paid_ytd` must be non-negative.
5. IF `deductible_paid_ytd` is negative, THEN THE Engine SHALL raise a `ValueError` with a message indicating that `deductible_paid_ytd` must be non-negative.
6. IF a `Frequency_Count` in `Usage` is negative, THEN THE Engine SHALL raise a `ValueError` with a message indicating which procedure code has the invalid count.
7. IF a procedure code present in `Usage.frequency_counts` has no corresponding frequency limit defined in `Plan`, THEN THE Engine SHALL raise a `ValueError` with a message indicating the unrecognized procedure code.

---

### Requirement 6: Golden Acceptance Scenario

**User Story:** As M (math reviewer), I want the function to produce exactly the right numbers for the Demo PPO acceptance case, so that I can trust it before integration.

#### Acceptance Criteria

1. WHEN the Demo PPO plan (Annual_Max $1,500, Deductible $50, cleaning D1110 limited to 2 per year at $120 in-network) is given with Usage of `total_plan_paid_ytd = 1100`, `deductible_paid_ytd = 50`, and `d1110_count = 1`, THEN THE Engine SHALL return:
   - `remaining_max = 400`
   - `remaining_deductible = 0`
   - `deductible_met = True`
   - `frequency["D1110"] = {limit: 2, used: 1, remaining: 1}`
   - `unused_preventive_value = 120`

2. WHEN the Demo PPO plan is given with Usage of `total_plan_paid_ytd = 1100`, `deductible_paid_ytd = 50`, and `d1110_count = 2` (both cleanings used), THEN THE Engine SHALL return:
   - `remaining_max = 400`
   - `remaining_deductible = 0`
   - `deductible_met = True`
   - `frequency["D1110"] = {limit: 2, used: 2, remaining: 0}`
   - `unused_preventive_value = 0`

3. WHEN the Demo PPO plan is given with a fresh plan year (all usage at zero: `total_plan_paid_ytd = 0`, `deductible_paid_ytd = 0`, `d1110_count = 0`), THEN THE Engine SHALL return:
   - `remaining_max = 1500`
   - `remaining_deductible = 50`
   - `deductible_met = False`
   - `frequency["D1110"] = {limit: 2, used: 0, remaining: 2}`
   - `unused_preventive_value = 240`

---

### Requirement 7: Trace Completeness

**User Story:** As a UI developer, I want every computation step recorded in the trace, so that the "show the math" feature can display a clear explanation.

#### Acceptance Criteria

1. WHEN `benefits_status()` returns, THE Engine SHALL have added at least one Trace entry for each of: remaining annual maximum, deductible progress, each frequency-limited procedure defined in the Plan, and unused preventive value.
2. WHEN `benefits_status()` returns, THE Trace SHALL be a non-empty list of non-empty strings.
3. IF the Trace includes a dollar amount for a computed field, THEN that amount SHALL equal the corresponding value in the returned `BenefitsStatus` (no tolerance for rounding differences at the cent level).
4. WHEN a procedure has no frequency limit (and therefore does not appear in the frequency output), THE Engine SHALL NOT add a frequency Trace entry for that procedure code.
