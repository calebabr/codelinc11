"""API contract for the dental prototype.

This file is the single source of truth for request/response shapes.
Only the orchestrator / API owner changes it. Everyone else imports from it.
All money values are floats in US dollars, rounded to 2 decimals by the engine.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Category = Literal["preventive", "basic", "major"]
Urgency = Literal["urgent", "soon", "flexible"]


# ---------- Catalog data ----------

class Plan(BaseModel):
    id: str
    name: str
    description: str = ""
    monthly_premium: float = 0
    deductible: float                                   # per person per plan year
    deductible_waived_for: list[Category] = ["preventive"]
    annual_max: float
    coinsurance: dict[Category, float]                  # PLAN's share, e.g. {"basic": 0.8}
    frequency: dict[str, int] = {}                      # max per plan year by CDT code, e.g. {"D1110": 2}
    plan_year_start_month: int = 1                      # 1 = January
    orthodontia_child: float = 0.0                      # plan's share for children's braces; shown on the Plans page, not used by the engine yet
    alternate_benefit: bool = False                     # plan pays a costlier option at the price of its cheaper alternative


class Procedure(BaseModel):
    code: str                                           # CDT code, e.g. "D2740"
    name: str
    category: Category
    description: str = ""
    synonyms: list[str] = []
    fee_p50: float                                      # typical in-network (allowed) amount
    fee_p80: float                                      # typical out-of-network billed amount
    alternative_codes: list[str] = []                   # cheaper clinically-acceptable alternatives (CDT codes)


class Usage(BaseModel):
    """What the member has already used in the CURRENT plan year."""
    max_used: float = 0
    deductible_met: float = 0
    history: list[str] = []                             # CDT codes already done this plan year


# ---------- Estimate ----------

class TraceStep(BaseModel):
    label: str
    amount: float
    note: str


class EstimateResult(BaseModel):
    code: str
    name: str
    category: Category
    in_network: bool
    covered: bool                                       # False when a frequency limit blocks coverage
    billed: float                                       # what the dentist charges
    allowed: float                                      # amount the plan bases payment on
    deductible_applied: float
    plan_pays: float
    you_pay: float
    balance_bill: float                                 # billed - allowed (0 in network)
    max_used_after: float                               # plan-year max used after this procedure
    trace: list[TraceStep]


class EstimateRequest(BaseModel):
    plan_id: str | None = None
    plan: Plan | None = None                         # custom plan (overrides plan_id)
    code: str
    usage: Usage = Usage()


class EstimateResponse(BaseModel):
    in_network: EstimateResult
    out_of_network: EstimateResult


# ---------- Procedure search ----------

class ProcedureMatch(BaseModel):
    procedure: Procedure
    score: float                                        # 0..1, higher is better


# ---------- Plan My Year ----------

class TreatmentItem(BaseModel):
    id: str                                             # unique within the request, e.g. "t1"
    code: str
    urgency: Urgency = "flexible"
    after: str | None = None                         # id of an item that must happen first


class ScheduleRequest(BaseModel):
    plan_id: str | None = None
    plan: Plan | None = None
    items: list[TreatmentItem]
    usage: Usage = Usage()
    current_month: int = Field(default=11, ge=1, le=12)  # month we are in now (1-12)


class ScheduledItem(BaseModel):
    id: str
    code: str
    name: str
    category: Category
    year_offset: int                                    # 0 = current plan year, 1 = next plan year
    month: int                                          # 1-12
    plan_pays: float
    you_pay: float
    note: str                                           # plain-English reason for this placement


class YearSummary(BaseModel):
    year_offset: int
    label: str                                          # e.g. "This plan year" / "Next plan year"
    plan_pays: float
    you_pay: float
    max_used_end: float
    max_remaining_end: float


class ScheduleResponse(BaseModel):
    items: list[ScheduledItem]                          # ordered chronologically
    years: list[YearSummary]
    total_you_pay: float                                # optimized schedule
    baseline_you_pay: float                             # everything done now (this plan year)
    savings: float                                      # baseline - total (never negative)
    baseline_items: list[ScheduledItem]                 # the "everything now" schedule, for the toggle
    reasons: list[str]                                  # plain-English bullets explaining the schedule


# ---------- Benefits status ----------

class BenefitsStatusRequest(BaseModel):
    plan_id: str | None = None
    plan: Plan | None = None
    usage: Usage = Usage()
    current_month: int = Field(default=11, ge=1, le=12)


class FrequencyStatus(BaseModel):
    code: str
    name: str
    used: int
    limit: int
    remaining: int


class BenefitsStatus(BaseModel):
    plan_name: str
    annual_max: float
    max_used: float
    max_remaining: float
    deductible: float
    deductible_met: float
    deductible_remaining: float
    frequencies: list[FrequencyStatus]
    unused_preventive_value: float                      # fee value of covered-but-unused preventive visits
    months_left: int                                    # months left in the plan year, including this one
    reminder: str | None = None                      # set when benefits would expire soon (month >= 10)


# ---------- Chat ----------

class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    plan_id: str | None = None
    plan: Plan | None = None
    usage: Usage = Usage()
    current_month: int = Field(default=11, ge=1, le=12)


class HealthResponse(BaseModel):
    ok: bool
    ollama_available: bool
    ollama_model: str
    chat_mode: Literal["anthropic", "ollama", "unavailable"]


# ---------- Treatment plan (dentist quote) parsing ----------

class ParsedTreatment(BaseModel):
    id: str                                             # "q1", "q2", ... unique within the response
    code: str | None = None                          # catalog CDT code, None when not matched
    name: str                                           # catalog name if matched, else the text found
    tooth: str | None = None                         # e.g. "19"
    quoted_fee: float | None = None                  # fee written on the dentist's plan
    typical_fee: float | None = None                 # catalog fee_p50 when matched
    urgency: Urgency = "flexible"
    after: str | None = None                         # id of a ParsedTreatment that must come first
    phase: str | None = None                         # e.g. "Phase 1"
    matched: bool = False
    confidence: float = 0.0                             # 0..1
    source_line: str = ""


class TreatmentPlanParseRequest(BaseModel):
    text: str
    plan_id: str | None = None
    plan: Plan | None = None


class TreatmentPlanParseResponse(BaseModel):
    items: list[ParsedTreatment]
    unmatched_lines: list[str] = []                     # lines that looked like treatments but could not be matched
    notes: list[str] = []                               # plain-English notes for the user
    mode: Literal["rules", "ollama"] = "rules"


# ---------- Questions to ask your dentist ----------

class DentistQuestion(BaseModel):
    id: str
    text: str
    why: str                                            # one-line reason this question matters


class QuestionSection(BaseModel):
    id: str
    title: str                                          # e.g. "Is it urgent?", "Cost and billing"
    questions: list[DentistQuestion]


class QuestionsRequest(BaseModel):
    plan_id: str | None = None
    plan: Plan | None = None
    codes: list[str] = []                               # procedures being considered (may be empty)
    usage: Usage = Usage()
    current_month: int = Field(default=11, ge=1, le=12)


class QuestionsResponse(BaseModel):
    safety_note: str                                    # always present: never delay urgent/painful care
    sections: list[QuestionSection]


# ---------- Savings tips ----------

TipKind = Literal["timing", "network", "preventive", "alternative", "fsa_hsa", "quote_check"]


class SavingsTip(BaseModel):
    id: str
    kind: TipKind
    title: str
    summary: str                                        # plain-English, one or two sentences
    saving: float                                       # dollars; computed by the engine, never by the LLM
    before: float                                       # cost without following the tip
    after: float                                        # cost if the tip is followed
    steps: list[TraceStep] = []                         # how the number was calculated
    assumptions: list[str] = []


class SavingsTipsRequest(BaseModel):
    plan_id: str | None = None
    plan: Plan | None = None
    usage: Usage = Usage()
    current_month: int = Field(default=11, ge=1, le=12)
    items: list[TreatmentItem] = []                     # treatments under consideration
    quoted_fees: dict[str, float] = {}                  # treatment item id -> fee on the dentist's quote
    tax_rate: float = Field(default=0.25, ge=0, le=0.6) # assumed marginal tax rate for FSA/HSA tip


class SavingsTipsResponse(BaseModel):
    tips: list[SavingsTip]                              # sorted by saving, largest first; tips overlap, never sum them
    note: str = "Tips overlap, so their savings can't be added together. These are estimates, not tax or medical advice."


# ---------- Households, sign-in and overview (T05) ----------

class DemoAccount(BaseModel):
    account_id: str
    email: str
    display_name: str
    member_id: str
    role: Literal["primary", "adult", "managed"]
    household_id: str


class DemoLoginRequest(BaseModel):
    member_id: str


class Member(BaseModel):
    id: str
    household_id: str
    name: str
    relationship: str
    age: int
    role: Literal["primary", "adult", "managed"]
    has_login: bool
    status: str = "active"                              # "active" or "pending"
    status_note: str | None = None


class PlanTierSummary(BaseModel):
    id: str
    name: str
    monthly_premium: float                              # dollars per covered person per month
    annual_max: float
    deductible: float
    preventive_pct: int
    basic_pct: int
    major_pct: int
    ortho_pct: int


class Household(BaseModel):
    id: str
    name: str
    plan_tier: PlanTierSummary
    members: list[Member]                               # only the members the signed-in person may see


class DemoLoginResponse(BaseModel):
    token: str                                          # send as "Authorization: Bearer <token>"
    member: Member
    household: Household


class ServiceEligibility(BaseModel):
    service: Literal["preventive", "basic", "major", "orthodontia"]
    label: str
    covered: bool
    plan_share: float                                   # plan's share, 0..1
    deductible_applies: bool
    note: str


class MemberUsageDollars(BaseModel):
    plan_year: int
    max_used: float
    deductible_met: float
    visits: int
    cleanings_used: int


class MemberOverview(BaseModel):
    member: Member
    plan_tier: PlanTierSummary
    usage: MemberUsageDollars                           # this person's usage only, never a household total
    benefits: BenefitsStatus                            # computed by the benefits-status engine
    reminder: str | None = None
    eligibility: list[ServiceEligibility]
    as_of: str                                          # demo date used as "today" (ISO)


class ScheduleEntry(BaseModel):
    id: int
    member_id: str
    member_name: str
    kind: str                                           # "appointment" or "reminder"
    due_date: str
    title: str
    note: str | None = None


class InviteRequest(BaseModel):
    email: str = Field(min_length=3, max_length=200, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    member_id: str | None = None


class InviteResponse(BaseModel):
    id: str
    household_id: str
    invited_by: str
    member_id: str | None = None
    email: str
    status: str
    created_at: str


# ---------- Annual cost calculator ----------

class CareItem(BaseModel):
    code: str
    count: int = Field(default=1, ge=1, le=12)


class AnnualCostRequest(BaseModel):
    tier_id: str                                        # "basic" | "preferred" | "premium"
    covered_people: int = Field(default=1, ge=1, le=10)
    expected_care: list[CareItem] = Field(default=[], max_length=30)  # per person, applied to each covered person
    in_network: bool = True


class AnnualCostPerson(BaseModel):
    person: int                                         # 1-based
    plan_pays: float
    you_pay: float
    max_used_end: float


class AnnualCostResponse(BaseModel):
    tier_id: str
    tier_name: str
    covered_people: int
    premiums: float                                     # monthly premium x 12 x covered people
    plan_pays: float
    out_of_pocket_care: float
    total_cost: float                                   # premiums + out_of_pocket_care
    per_person: list[AnnualCostPerson]
    assumptions: list[str]
    disclaimer: str = "This is an estimate. Your actual cost depends on your dentist's charges and claim review."
