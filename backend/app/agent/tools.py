"""Chat tools: thin wrappers over the engine. Plan, usage and month come from the request context."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from ..data import load_catalog, resolve_plan
from ..engine.estimate import estimate
from ..engine.sequencer import best_schedule
from ..engine.status import benefits_status
from ..models import ChatRequest, Plan, ScheduleRequest, TreatmentItem, Usage
from ..search import search_procedures


@dataclass
class ToolContext:
    plan: Plan
    usage: Usage = field(default_factory=Usage)
    current_month: int = 11

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
    except Exception as exc:  # noqa: BLE001
        return {"error": f"Tool {name} failed: {exc}"}
    return {"error": f"Unknown tool {name}"}
