"""Chat tools: thin wrappers over the engine. Plan, usage and month come from the request context."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any

from ..data import load_catalog, load_plans, resolve_plan
from ..engine.estimate import estimate
from ..engine.reports import to_dollars, totals
from ..engine.sequencer import best_schedule
from ..engine.simulate import LEVELS, UnknownCode, UnknownPlan, simulate
from ..engine.status import benefits_status
from ..engine.tips import savings_tips
from ..models import (
    ChatRequest,
    Plan,
    SavingsTipsRequest,
    ScheduleRequest,
    SimulateKnownCare,
    SimulateMember,
    SimulateRequest,
    TreatmentItem,
    Usage,
)
from ..questions import build_questions
from ..reports import KINDS as REPORT_KINDS
from ..reports import explain as explain_row
from ..search import search_procedures


@dataclass
class ToolContext:
    plan: Plan
    usage: Usage = field(default_factory=Usage)
    current_month: int = 11
    member: dict | None = None            # the active member (None for stateless chat)
    household: list[dict] = field(default_factory=list)  # people the viewer may discuss
    # Stored report rows (amounts in cents) of the active member, loaded through the access layer by
    # the chat router; None outside the reports scope.
    reports: list[dict] | None = None

    @classmethod
    def from_member(cls, mc: Any) -> ToolContext:
        """Build from a MemberContext (agent/context.py): that person's plan and usage only."""
        return cls(plan=resolve_plan(None, mc.plan_id), usage=mc.usage,
                   current_month=mc.current_month, member=mc.member, household=mc.household)

    @classmethod
    def from_request(cls, req: ChatRequest) -> ToolContext:
        return cls(plan=resolve_plan(req.plan, req.plan_id), usage=req.usage,
                   current_month=req.current_month)

    @classmethod
    def default(cls) -> ToolContext:
        return cls(plan=resolve_plan())


def _ctx(ctx: ToolContext | None) -> ToolContext:
    return ctx or ToolContext.default()


def find_procedure(query: str, ctx: ToolContext | None = None) -> dict:
    matches = search_procedures(str(query), load_catalog())[:5]
    return {"query": query, "matches": [
        {"code": m.procedure.code, "name": m.procedure.name, "category": m.procedure.category,
         "description": m.procedure.description, "score": m.score} for m in matches]}


def estimate_cost(code: str, ctx: ToolContext | None = None) -> dict:
    c = _ctx(ctx)
    proc = load_catalog().get(str(code).upper())
    if proc is None:
        return {"error": f"Unknown procedure code {code}. Use find_procedure first."}
    return {
        "code": proc.code, "name": proc.name, "plan": c.plan.name,
        "in_network": estimate(proc, c.plan, c.usage, True).model_dump(),
        "out_of_network": estimate(proc, c.plan, c.usage, False).model_dump(),
    }


def plan_year_schedule(items: list[Any], ctx: ToolContext | None = None) -> dict:
    """items: list of {"code", "urgency"?, "after"?, "id"?} (or bare codes)."""
    c = _ctx(ctx)
    catalog = load_catalog()
    norm: list[dict] = []
    for n, raw in enumerate(items or [], start=1):
        d = {"code": raw} if isinstance(raw, str) else dict(raw)
        d.setdefault("id", f"t{n}")
        d["code"] = str(d.get("code", "")).upper()
        norm.append(d)
    ids = {d["id"] for d in norm}
    for d in norm:  # allow "after" to be a code of another item
        a = d.get("after")
        if a and a not in ids:
            match = next((o["id"] for o in norm if o is not d and o["code"] == str(a).upper()), None)
            d["after"] = match
    try:
        treatments = [TreatmentItem(id=d["id"], code=d["code"],
                                    urgency=d.get("urgency") or "flexible", after=d.get("after"))
                      for d in norm]
        req = ScheduleRequest(items=treatments, usage=c.usage, current_month=c.current_month)
        res = best_schedule(req, c.plan, catalog)
    except (KeyError, ValueError) as exc:
        return {"error": f"Could not build a schedule: {exc}"}
    return res.model_dump()


def get_benefits_status(ctx: ToolContext | None = None) -> dict:
    c = _ctx(ctx)
    return benefits_status(c.plan, c.usage, load_catalog(), c.current_month).model_dump()


def get_member_eligibility(ctx: ToolContext | None = None) -> dict:
    """Coverage status of the active member (from the database, not from the model)."""
    c = _ctx(ctx)
    if not c.member:
        return {"error": "No member is selected."}
    m = c.member
    return {"name": m["name"], "age": m["age"], "relationship": m["relationship"],
            "full_time_student": bool(m.get("full_time_student")), "status": m["status"],
            "covered_now": m["status"] == "active", "note": m.get("status_note") or ""}


def get_household_coverage(ctx: ToolContext | None = None) -> dict:
    """Who is covered on the plan, limited to the people the signed-in person may see."""
    c = _ctx(ctx)
    return {"members": [{"name": p["name"], "relationship": p["relationship"], "age": p["age"],
                         "status": p["status"], "note": p.get("status_note") or ""}
                        for p in c.household]}


def _codes(raw: Any) -> list[str]:
    """Normalize a model-supplied code list (or single code); keep order, drop blanks and repeats."""
    if isinstance(raw, str):
        raw = [raw]
    out: list[str] = []
    for c in raw or []:
        c = str(c).strip().upper()
        if c and c not in out:
            out.append(c)
    return out


def get_savings_tips(codes: Any = None, quoted_fees: Any = None, urgent_codes: Any = None,
                     ctx: ToolContext | None = None) -> dict:
    """The same tips as the Costs page ("Ways to save"), from the savings engine."""
    c = _ctx(ctx)
    catalog = load_catalog()
    wanted = _codes(codes)
    unknown = [x for x in wanted if x not in catalog]
    if unknown:
        return {"error": f"Unknown procedure code {', '.join(unknown)}. Use find_procedure first."}
    urgent = set(_codes(urgent_codes))
    fees: dict[str, float] = {}
    for k, v in (quoted_fees if isinstance(quoted_fees, dict) else {}).items():
        try:
            fees[str(k).strip().upper()] = float(v)
        except (TypeError, ValueError):
            continue
    items = [TreatmentItem(id=x, code=x, urgency="urgent" if x in urgent else "flexible")
             for x in wanted]
    req = SavingsTipsRequest(plan=c.plan, usage=c.usage, current_month=c.current_month,
                             items=items, quoted_fees={k: v for k, v in fees.items() if k in wanted})
    try:
        res = savings_tips(req, c.plan, catalog)
    except (KeyError, ValueError) as exc:
        return {"error": f"Could not work out savings tips: {exc}"}
    out = res.model_dump()
    out["procedures"] = [catalog[x].name for x in wanted]
    out["general"] = not wanted
    return out


def get_dentist_questions(codes: Any = None, ctx: ToolContext | None = None) -> dict:
    """The same list as the Costs page ("Questions to ask your dentist")."""
    c = _ctx(ctx)
    catalog = load_catalog()
    wanted = _codes(codes)
    unknown = [x for x in wanted if x not in catalog]
    if unknown:
        return {"error": f"Unknown procedure code {', '.join(unknown)}. Use find_procedure first."}
    out = build_questions(c.plan, c.usage, wanted, c.current_month, catalog).model_dump()
    out["procedures"] = [catalog[x].name for x in wanted]
    out["general"] = not wanted
    return out


COMPARE_N, COMPARE_SEED = 5000, 42      # same defaults as the Plans page


def compare_plans(care_levels: Any = None, known_codes: Any = None, ctx: ToolContext | None = None,
                  known_care_by_member: Any = None, in_network: Any = True) -> dict:
    """Which plan costs the household least over many simulated years (the Plans page numbers).

    Covers the people the viewer may see (a primary sees everyone, an adult only themself). Every
    person defaults to average care; `care_levels` maps a member id, full name or first name to
    low, average or high. `known_codes` are added to every simulated year of the active member only;
    `known_care_by_member` ({member id or name: [codes]}) adds known care to the named people only.
    `in_network` (default True) prices everything out of network when False.
    """
    c = _ctx(ctx)
    people = c.household or ([c.member] if c.member else [])
    if not people:
        return {"error": "No household members are available to compare plans for."}

    def keys_of(p: dict) -> list[str]:
        return [str(k).lower() for k in (p["id"], p["name"], p["name"].split()[0])]

    overrides: dict[str, str] = {}
    for k, v in (care_levels.items() if isinstance(care_levels, dict) else []):
        level = str(v).strip().lower()
        if level not in LEVELS:
            return {"error": f"Care level must be low, average or high, not '{v}'."}
        overrides[str(k).strip().lower()] = level
    active = (c.member or people[0])["id"]
    known: dict[str, list[str]] = {}
    for k, v in (known_care_by_member.items() if isinstance(known_care_by_member, dict) else []):
        person = next((p for p in people if str(k).strip().lower() in keys_of(p)), None)
        if person is None:
            return {"error": f"I can only compare plans for people on this household, not '{k}'."}
        known.setdefault(person["id"], [])
        known[person["id"]] += [x for x in _codes(v) if x not in known[person["id"]]]
    shared = _codes(known_codes)
    if shared:
        known.setdefault(active, [])
        known[active] += [x for x in shared if x not in known[active]]
    net = in_network if isinstance(in_network, bool) else str(in_network).strip().lower() not in (
        "false", "no", "0", "out", "out of network")

    def level_for(p: dict) -> str:
        return next((overrides[k] for k in keys_of(p) if k in overrides), "average")

    try:
        members = [SimulateMember(
            id=p["id"], name=p["name"], age=int(p["age"]), care_level=level_for(p),
            known_care=[SimulateKnownCare(code=x) for x in known.get(p["id"], [])])
            for p in people]
        res = simulate(SimulateRequest(members=members, n=COMPARE_N, seed=COMPARE_SEED,
                                       in_network=net), load_plans(), load_catalog())
    except UnknownCode as exc:
        return {"error": f"Unknown procedure code {exc}. Use find_procedure first."}
    except (UnknownPlan, ValueError) as exc:
        return {"error": f"Could not compare plans: {exc}"}
    out = res.model_dump()
    out["members"] = [{"name": m.name, "age": m.age, "care_level": m.care_level,
                       "known_care": [k.code for k in m.known_care]} for m in members]
    out["plan_terms"] = [{
        "plan_id": pl.id, "name": pl.name, "monthly_premium": pl.monthly_premium,
        "deductible": pl.deductible, "deductible_waived_for": list(pl.deductible_waived_for),
        "annual_max": pl.annual_max,
        "plan_pays_percent": {k: round(v * 100) for k, v in pl.coinsurance.items()},
        "frequency_limits_per_year": dict(pl.frequency)}
        for pl in (load_plans()[r.plan_id] for r in res.plans)]
    out["note"] = ("Based on simulated years with synthetic odds, not a prediction for this family. "
                   "Totals are premiums plus what the family pays.")
    return out


_AMOUNT_FIELDS = (("billed_cents", "billed"), ("allowed_cents", "allowed"),
                  ("deductible_applied_cents", "deductible_applied"), ("coinsurance_cents", "coinsurance_amount"),
                  ("copay_cents", "copay_amount"), ("plan_paid_cents", "plan_paid"),
                  ("balance_billing_cents", "balance_billing"), ("you_owe_cents", "you_owe"))


def _report_view(row: dict) -> dict:
    """What the model may see of one stored report: names, dates, status and amounts in dollars.
    Never contact details, never raw uploaded text."""
    d = row["data"]
    out: dict[str, Any] = {
        "id": row["id"], "kind": row["kind"], "service_date": row["service_date"],
        "title": row["title"], "provider_name": row["provider_name"], "code": row["code"],
        "description": row["description"], "paid_status": row["paid_status"]}
    if d.get("status"):
        out["claim_status"] = d["status"]
    if d.get("remark"):
        out["remark"] = d["remark"]
    for cents_key, name in _AMOUNT_FIELDS:
        if cents_key in d:
            out[name] = to_dollars(d[cents_key])
    return out


def _iso_or_none(value: Any) -> str | None | bool:
    """None for no value, an ISO date string for a good one, False for a bad one."""
    if value in (None, ""):
        return None
    try:
        return date.fromisoformat(str(value)).isoformat()
    except ValueError:
        return False


def get_reports(kind: Any = None, from_: Any = None, to: Any = None,
                ctx: ToolContext | None = None) -> dict:
    """The active member's saved claims, EOBs and copay visits, with totals added up in code from the
    stored values of exactly the items listed (the same totals as the Reports page)."""
    c = _ctx(ctx)
    rows = list(c.reports or [])
    if kind not in (None, ""):
        k = str(kind).strip().lower()
        if k not in REPORT_KINDS:
            return {"error": f"kind must be one of: {', '.join(REPORT_KINDS)}."}
        rows = [r for r in rows if r["kind"] == k]
    d_from, d_to = _iso_or_none(from_), _iso_or_none(to)
    if d_from is False or d_to is False:
        return {"error": "Dates must look like 2026-09-30."}
    if d_from:
        rows = [r for r in rows if r["service_date"] >= d_from]
    if d_to:
        rows = [r for r in rows if r["service_date"] <= d_to]
    rows.sort(key=lambda r: r["service_date"])
    t = totals(rows)
    unpaid = [{"id": r["id"], "title": r["title"], "service_date": r["service_date"],
               "you_owe": to_dollars(r["data"].get("you_owe_cents", 0))}
              for r in rows if r["paid_status"] == "unpaid"]
    return {"count": len(rows), "items": [_report_view(r) for r in rows],
            "report_totals": {k: to_dollars(v) for k, v in t.items()},
            "unpaid_items": unpaid,
            "note": "Made-up sample documents for a demo. Amounts are exactly as stored."}


def explain_report(id: Any = None, ctx: ToolContext | None = None) -> dict:
    """The plain-language explanation of one saved document (built in code, the same text as the
    Reports page). Only the active member's own documents can be found."""
    c = _ctx(ctx)
    row = next((r for r in (c.reports or []) if r["id"] == str(id or "")), None)
    if row is None:
        return {"error": "No saved document with that id. Call get_reports to see the ids."}
    return explain_row(row).model_dump()


REPORT_TOOL_NAMES = {"get_reports", "explain_report"}

REPORT_TOOL_SCHEMAS: list[dict] = [
    {"type": "function", "function": {
        "name": "get_reports",
        "description": ("The person's saved claims, EOBs (explanation of benefits) and copay visits, with "
                        "totals: billed, allowed, plan_paid, you_paid and you_owe_open (what is still owed). "
                        "Also unpaid_items. All amounts come from the stored documents."),
        "parameters": {"type": "object", "properties": {
            "kind": {"type": "string", "enum": list(REPORT_KINDS),
                     "description": "Only this kind of document (optional)"},
            "from": {"type": "string", "description": "Earliest service date, like 2026-01-01 (optional)"},
            "to": {"type": "string", "description": "Latest service date, like 2026-12-31 (optional)"}}}}},
    {"type": "function", "function": {
        "name": "explain_report",
        "description": ("Plain-language explanation of one saved document: what it is, each line, the "
                        "steps, what to do next, and a balance billing note. Use an id from get_reports."),
        "parameters": {"type": "object", "properties": {
            "id": {"type": "string", "description": "The document id from get_reports"}},
            "required": ["id"]}}},
]

TOOL_SCHEMAS: list[dict] = [
    {"type": "function", "function": {
        "name": "find_procedure",
        "description": "Find the dental procedure (CDT code) that matches the user's plain-English words.",
        "parameters": {"type": "object", "properties": {
            "query": {"type": "string", "description": "e.g. 'crown' or 'cap on my back tooth'"}},
            "required": ["query"]}}},
    {"type": "function", "function": {
        "name": "estimate_cost",
        "description": "Exact in-network and out-of-network cost for one procedure, using the member's plan and usage.",
        "parameters": {"type": "object", "properties": {
            "code": {"type": "string", "description": "CDT code, e.g. D2740"}},
            "required": ["code"]}}},
    {"type": "function", "function": {
        "name": "plan_year_schedule",
        "description": "Find the cheapest timing for several procedures, including waiting for the next plan year.",
        "parameters": {"type": "object", "properties": {
            "items": {"type": "array", "items": {"type": "object", "properties": {
                "code": {"type": "string"},
                "urgency": {"type": "string", "enum": ["urgent", "soon", "flexible"]},
                "after": {"type": "string", "description": "id or code of a procedure that must come first"}},
                "required": ["code"]}}},
            "required": ["items"]}}},
    {"type": "function", "function": {
        "name": "get_benefits_status",
        "description": "What the member has left: yearly maximum, deductible, cleanings, months left.",
        "parameters": {"type": "object", "properties": {}}}},
    {"type": "function", "function": {
        "name": "get_member_eligibility",
        "description": "Whether the active member is covered right now (for example pending student verification).",
        "parameters": {"type": "object", "properties": {}}}},
    {"type": "function", "function": {
        "name": "get_household_coverage",
        "description": "Who is covered on the plan (only the people the signed-in person may see).",
        "parameters": {"type": "object", "properties": {}}}},
    {"type": "function", "function": {
        "name": "get_savings_tips",
        "description": ("Ways to save money (the same 'Ways to save' as the Costs page), using the member's "
                        "plan and usage. Pass the CDT codes being discussed if any; with none you get general tips."),
        "parameters": {"type": "object", "properties": {
            "codes": {"type": "array", "items": {"type": "string"},
                      "description": "CDT codes, e.g. ['D2740']; use find_procedure first if unsure"},
            "quoted_fees": {"type": "object", "additionalProperties": {"type": "number"},
                            "description": "Fee on the dentist's quote per code, only if the person gave one"},
            "urgent_codes": {"type": "array", "items": {"type": "string"},
                             "description": "Codes that are urgent or painful, so they are never moved"}}}}},
    {"type": "function", "function": {
        "name": "get_dentist_questions",
        "description": ("Questions to ask the dentist (the same list as the Costs page). Pass the CDT codes "
                        "being discussed if any; with none you get general questions."),
        "parameters": {"type": "object", "properties": {
            "codes": {"type": "array", "items": {"type": "string"},
                      "description": "CDT codes, e.g. ['D3330']"}}}}},
    {"type": "function", "function": {
        "name": "compare_plans",
        "description": ("Which dental plan (Basic, Preferred, Premium) costs the household the least, from 5,000 "
                        "simulated years: share of years each plan is cheapest, typical and bad-year totals, and "
                        "reasons. Covers the people the signed-in person may see. Everyone defaults to average care."),
        "parameters": {"type": "object", "properties": {
            "care_levels": {"type": "object", "additionalProperties": {"type": "string", "enum": list(LEVELS)},
                            "description": "Optional care level by member id or name, e.g. {'Alex': 'high'}"},
            "known_codes": {"type": "array", "items": {"type": "string"},
                            "description": "CDT codes of care the active member already knows they need, e.g. ['D2740']"},
            "known_care_by_member": {"type": "object", "additionalProperties": {
                "type": "array", "items": {"type": "string"}},
                "description": ("Known care for specific people only, by member id or name, "
                                "e.g. {'Alex': ['D2740']}. Other people are not affected.")},
            "in_network": {"type": "boolean",
                           "description": "false to price everything out of network (default true)"}}}}},
]


def run_tool(name: str, args: dict, ctx: ToolContext) -> dict:
    """Dispatch a tool call by name. Never raises; errors come back as {"error": ...}."""
    args = args if isinstance(args, dict) else {}
    try:
        if name == "find_procedure":
            return find_procedure(args.get("query", ""), ctx)
        if name == "estimate_cost":
            return estimate_cost(args.get("code", ""), ctx)
        if name == "plan_year_schedule":
            return plan_year_schedule(args.get("items", []), ctx)
        if name == "get_benefits_status":
            return get_benefits_status(ctx)
        if name == "get_savings_tips":
            return get_savings_tips(args.get("codes"), args.get("quoted_fees"),
                                    args.get("urgent_codes"), ctx)
        if name == "get_dentist_questions":
            return get_dentist_questions(args.get("codes"), ctx)
        if name == "compare_plans":
            return compare_plans(args.get("care_levels"), args.get("known_codes"), ctx,
                                 known_care_by_member=args.get("known_care_by_member"),
                                 in_network=args.get("in_network", True))
        if name == "get_reports":
            return get_reports(args.get("kind"), args.get("from"), args.get("to"), ctx)
        if name == "explain_report":
            return explain_report(args.get("id"), ctx)
        if name == "get_member_eligibility":
            return get_member_eligibility(ctx)
        if name == "get_household_coverage":
            return get_household_coverage(ctx)
    except Exception as exc:  # noqa: BLE001
        return {"error": f"Tool {name} failed: {exc}"}
    return {"error": f"Unknown tool {name}"}
