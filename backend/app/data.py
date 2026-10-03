"""Seed data loading (cached). Reads backend/data."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from .models import Plan, Procedure

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DEFAULT_PLAN_ID = "preferred"


@lru_cache(maxsize=1)
def load_plans() -> dict[str, Plan]:
    plans: dict[str, Plan] = {}
    for path in sorted((DATA_DIR / "plans").glob("*.json")):
        plan = Plan.model_validate(json.loads(path.read_text(encoding="utf-8")))
        plans[plan.id] = plan
    return plans


@lru_cache(maxsize=1)
def load_catalog() -> dict[str, Procedure]:
    raw = json.loads((DATA_DIR / "cdt_codes.json").read_text(encoding="utf-8"))
    return {p["code"]: Procedure.model_validate(p) for p in raw}


def resolve_plan(plan: Plan | None = None, plan_id: str | None = None) -> Plan:
    """Inline plan wins over plan_id; default is preferred. Raises KeyError for unknown id."""
    if plan is not None:
        return plan
    pid = plan_id or DEFAULT_PLAN_ID
    plans = load_plans()
    if pid not in plans:
        raise KeyError(pid)
    return plans[pid]
