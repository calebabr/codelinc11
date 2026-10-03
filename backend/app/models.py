"""API contract for the dental prototype.

This file is the single source of truth for request/response shapes.
Only the orchestrator / API owner changes it. Everyone else imports from it.
All money values are floats in US dollars, rounded to 2 decimals by the engine.
"""
from __future__ import annotations

from typing import Literal, Optional

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
    plan_id: Optional[str] = None
    plan: Optional[Plan] = None                         # custom plan (overrides plan_id)
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
    after: Optional[str] = None                         # id of an item that must happen first


class ScheduleRequest(BaseModel):
    plan_id: Optional[str] = None
    plan: Optional[Plan] = None
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
    plan_id: Optional[str] = None
    plan: Optional[Plan] = None
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
    reminder: Optional[str] = None                      # set when benefits would expire soon (month >= 10)


# ---------- Chat ----------

class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    plan_id: Optional[str] = None
    plan: Optional[Plan] = None
    usage: Usage = Usage()
    current_month: int = Field(default=11, ge=1, le=12)


class HealthResponse(BaseModel):
    ok: bool
    ollama_available: bool
    ollama_model: str
    chat_mode: Literal["ollama", "fallback"]


# ---------- Treatment plan (dentist quote) parsing ----------

class ParsedTreatment(BaseModel):
    id: str                                             # "q1", "q2", ... unique within the response
    code: Optional[str] = None                          # catalog CDT code, None when not matched
    name: str                                           # catalog name if matched, else the text found
    tooth: Optional[str] = None                         # e.g. "19"
    quoted_fee: Optional[float] = None                  # fee written on the dentist's plan
    typical_fee: Optional[float] = None                 # catalog fee_p50 when matched
    urgency: Urgency = "flexible"
    after: Optional[str] = None                         # id of a ParsedTreatment that must come first
    phase: Optional[str] = None                         # e.g. "Phase 1"
    matched: bool = False
    confidence: float = 0.0                             # 0..1
    source_line: str = ""


class TreatmentPlanParseRequest(BaseModel):
    text: str
    plan_id: Optional[str] = None
    plan: Optional[Plan] = None


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
    plan_id: Optional[str] = None
    plan: Optional[Plan] = None
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
    plan_id: Optional[str] = None
    plan: Optional[Plan] = None
    usage: Usage = Usage()
    current_month: int = Field(default=11, ge=1, le=12)
    items: list[TreatmentItem] = []                     # treatments under consideration
    quoted_fees: dict[str, float] = {}                  # treatment item id -> fee on the dentist's quote
    tax_rate: float = Field(default=0.25, ge=0, le=0.6) # assumed marginal tax rate for FSA/HSA tip


class SavingsTipsResponse(BaseModel):
    tips: list[SavingsTip]                              # sorted by saving, largest first; tips overlap, never sum them
    note: str = "Tips overlap, so their savings can't be added together. These are estimates, not tax or medical advice."
