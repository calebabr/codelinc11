"""Deterministic 'questions to ask your dentist' templates. No LLM, no network."""
from __future__ import annotations

from .engine.estimate import money
from .engine.status import benefits_status
from .models import (
    DentistQuestion,
    Plan,
    Procedure,
    QuestionSection,
    QuestionsResponse,
    Usage,
)

SAFETY_NOTE = ("If you have pain, swelling, or an infection, don't wait on this list: "
               "call your dentist or urgent care right away.")


def _q(id_: str, text: str, why: str) -> DentistQuestion:
    return DentistQuestion(id=id_, text=text, why=why)


def _kind(proc: Procedure) -> str:
    name = proc.name.lower()
    if "crown" in name:
        return "crown"
    if "root canal" in name:
        return "root_canal"
    if "filling" in name:
        return "filling"
    if "extraction" in name:
        return "extraction"
    if any(w in name for w in ("implant", "bridge", "denture")):
        return "prosthetic"
    if "deep cleaning" in name or "scaling" in name:
        return "deep_cleaning"
    if proc.category == "preventive":
        return "preventive"
    return "other"


def _procedure_questions(kind: str) -> list[DentistQuestion]:
    if kind == "crown":
        return [
            _q("crown_buildup", "Will I need a build-up under the crown, and is it billed separately?",
               "A build-up is an extra charge that is often forgotten in the first quote."),
            _q("crown_replace_freq", "When was a crown last placed on this tooth, and how often does my plan replace one?",
               "Many plans only pay to replace a crown on the same tooth every 5 to 10 years."),
            _q("crown_temp", "Is a temporary crown included, or what does it cost?",
               "Temporary work can be a separate line item."),
        ]
    if kind == "root_canal":
        return [
            _q("rc_crown_after", "Will I need a crown afterward, and how soon?",
               "A crown often follows a root canal, and it is a second cost to plan for."),
            _q("rc_who", "Will you do the root canal or refer me to a specialist, and is the specialist in my network?",
               "Specialists can have different fees and network status."),
        ]
    if kind == "filling":
        return [
            _q("fill_material", "Which filling material do you recommend, and does my plan pay for it?",
               "Some plans pay less for white (composite) fillings on back teeth."),
            _q("fill_surfaces", "How many surfaces is each filling, and how is that billed?",
               "Fillings are priced by the number of surfaces."),
        ]
    if kind == "extraction":
        return [
            _q("ext_replace", "What are my options to replace the tooth, and what would each cost?",
               "A replacement is a second treatment with its own cost."),
            _q("ext_simple", "Is this a simple extraction or a surgical one?",
               "Surgical extractions are billed under a different code."),
        ]
    if kind == "prosthetic":
        return [
            _q("pros_included", "What is included in the price (exam, imaging, parts, follow-ups)?",
               "These treatments often have many separate parts."),
            _q("pros_healing", "How long is healing, and how many stages or visits are there?",
               "Stages may fall in different plan years, which changes what your plan pays."),
        ]
    if kind == "deep_cleaning":
        return [
            _q("deep_quads", "How many quadrants need deep cleaning?",
               "The number of areas treated sets the total cost."),
            _q("deep_billing", "Is it billed per quadrant, and can it be spread across visits?",
               "Deep cleaning is billed per quadrant, so splitting visits can matter."),
        ]
    if kind == "preventive":
        return [
            _q("prev_freq", "How often are exams, cleanings, and X-rays covered for me?",
               "Preventive visits are usually limited per plan year."),
        ]
    return []


def build_questions(plan: Plan, usage: Usage, codes: list[str], current_month: int,
                    catalog: dict[str, Procedure]) -> QuestionsResponse:
    # Valid, de-duplicated codes (order kept); unknown codes are ignored.
    valid: list[Procedure] = []
    seen: set[str] = set()
    for code in codes:
        c = code.strip().upper()
        if c in catalog and c not in seen:
            seen.add(c)
            valid.append(catalog[c])
    status = benefits_status(plan, usage, catalog, current_month)

    urgency = [
        _q("urgency_wait", "Is this urgent, or can it safely wait a few weeks?",
           "Only your dentist can say what is safe to delay, and delaying can change what you pay."),
        _q("urgency_reset", "What happens if I wait until my plan year resets?",
           "Waiting may unlock a fresh yearly maximum, but only if it is clinically safe."),
    ]
    billing = [
        _q("billing_codes", "Which procedure codes will you bill?",
           "The codes decide what your plan pays, so you can check them with your insurer."),
        _q("billing_full_price", "What is the full price including X-rays, numbing, and temporary work?",
           "Extras are often left out of the first number you hear."),
        _q("billing_separate", "Is anything billed separately?",
           "Knowing this up front avoids a surprise bill later."),
        _q("billing_payment_plan", "Do you offer a payment plan or a discount for paying upfront?",
           "Many offices do, but they rarely mention it unless asked."),
        _q("billing_network", "Are you in network with my plan?",
           "Out-of-network offices can bill you the difference your plan does not cover."),
        _q("billing_predetermination", "Can you send my insurer a pre-treatment estimate (predetermination) first?",
           "It shows what the plan expects to pay before you commit."),
    ]
    coverage: list[DentistQuestion] = []
    for p in valid:
        if p.code in plan.frequency:
            coverage.append(_q(
                f"coverage_freq_{p.code}",
                f"My plan limits {p.name} to {plan.frequency[p.code]} per year. When was mine last done?",
                "Frequency limits can make a repeat visit completely out of pocket."))
    if plan.alternate_benefit:
        coverage.append(_q(
            "coverage_alternate_benefit",
            "Does my plan pay only for the less expensive option, and what would I owe if I choose the more expensive one?",
            "Your plan has an alternate-benefit rule, so a pricier choice may leave you paying the difference."))
    coverage.append(_q(
        "coverage_waiting",
        "Does my plan have a waiting period for this kind of treatment?",
        "Some plans delay coverage for major work for the first months."))
    coverage.append(_q(
        "coverage_xrays",
        "When were my last X-rays, and does my plan limit how often they are covered?",
        "Repeat X-rays can be denied if they are too soon."))
    if status.max_used > 0:
        coverage.append(_q(
            "coverage_max_left",
            f"I have about {money(status.max_remaining)} of my yearly maximum left. How should we sequence the work around it?",
            "The yearly maximum is the main limit on what the plan will pay."))
    alternatives = [
        _q("alt_lower_cost", "Is there a lower-cost option?",
           "A cheaper clinically acceptable option can save a lot."),
        _q("alt_filling_vs_crown", "Is a filling enough, or do I need a crown?",
           "Crowns cost much more than fillings, so confirm which one the tooth really needs."),
    ]

    sections = [
        QuestionSection(id="urgency", title="Is it urgent?", questions=urgency),
        QuestionSection(id="billing", title="Cost and billing", questions=billing),
        QuestionSection(id="coverage", title="Insurance and coverage", questions=coverage),
        QuestionSection(id="alternatives", title="Other options", questions=alternatives),
    ]
    low_max = status.max_remaining < 0.25 * plan.annual_max
    if len(valid) >= 2 or low_max or current_month >= 10:
        sections.append(QuestionSection(
            id="timing", title="Splitting the work over time",
            questions=[
                _q("timing_split", "Can the work be split across two plan years, and which parts must happen first?",
                   "Spreading treatment can let you use two yearly maximums."),
                _q("timing_order", "In what order should the treatments be done, and does the order matter medically?",
                   "Some treatments have to come first, which limits how you can schedule them."),
                _q("timing_wait_risk", "What is the risk of waiting for each part?",
                   "It separates what is safe to delay from what is not."),
            ]))

    if valid:
        proc_qs: list[DentistQuestion] = []
        ids: set[str] = set()
        for p in valid:
            for q in _procedure_questions(_kind(p)):
                if q.id not in ids:
                    ids.add(q.id)
                    proc_qs.append(q)
        if proc_qs:
            names = [p.name for p in valid]
            label = names[0] if len(names) == 1 else ", ".join(names[:-1]) + " and " + names[-1]
            sections.append(QuestionSection(id="procedure", title=f"About {label}", questions=proc_qs))

    return QuestionsResponse(safety_note=SAFETY_NOTE, sections=sections)
