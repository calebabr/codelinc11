"""FastAPI app for the dental prototype."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from .agent.ollama_client import OllamaClient
from .agent.providers import select_provider
from .data import load_catalog, load_plans, resolve_plan
from .engine.estimate import estimate
from .engine.sequencer import best_schedule
from .engine.status import benefits_status
from .models import (
    BenefitsStatus,
    BenefitsStatusRequest,
    EstimateRequest,
    EstimateResponse,
    HealthResponse,
    Plan,
    ProcedureMatch,
    ScheduleRequest,
    ScheduleResponse,
)
from .routers import annual_cost as annual_cost_router
from .routers import auth as auth_router
from .routers import chat as chat_router
from .routers import households as households_router
from .routers import members as members_router
from .routers import questions as questions_router
from .routers import tips as tips_router
from .routers import treatment_plan as treatment_plan_router
from .search import search_procedures

app = FastAPI(title="Dental Benefits Prototype")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(treatment_plan_router.router)
app.include_router(questions_router.router)
app.include_router(tips_router.router)
app.include_router(auth_router.router)
app.include_router(chat_router.router)
app.include_router(households_router.router)
app.include_router(members_router.router)
app.include_router(annual_cost_router.router)


def _plan(plan: Plan | None, plan_id: str | None) -> Plan:
    try:
        return resolve_plan(plan, plan_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Unknown plan '{plan_id}'") from None


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    provider = select_provider()
    name = getattr(provider, "name", None) if provider else None
    mode = name if name in ("anthropic", "ollama") else "unavailable"
    return HealthResponse(ok=True, ollama_available=mode == "ollama",
                          ollama_model=OllamaClient().model, chat_mode=mode)


@app.get("/plans", response_model=list[Plan])
def list_plans() -> list[Plan]:
    return list(load_plans().values())


@app.get("/plans/{plan_id}", response_model=Plan)
def get_plan(plan_id: str) -> Plan:
    plans = load_plans()
    if plan_id not in plans:
        raise HTTPException(status_code=404, detail=f"Unknown plan '{plan_id}'")
    return plans[plan_id]


@app.get("/procedures", response_model=list[ProcedureMatch])
def procedures(q: str = "") -> list[ProcedureMatch]:
    return search_procedures(q, load_catalog())


@app.post("/estimate", response_model=EstimateResponse)
def post_estimate(req: EstimateRequest) -> EstimateResponse:
    plan = _plan(req.plan, req.plan_id)
    proc = load_catalog().get(req.code)
    if proc is None:
        raise HTTPException(status_code=404, detail=f"Unknown procedure code '{req.code}'")
    return EstimateResponse(in_network=estimate(proc, plan, req.usage, True),
                            out_of_network=estimate(proc, plan, req.usage, False))


@app.post("/schedule", response_model=ScheduleResponse)
def post_schedule(req: ScheduleRequest) -> ScheduleResponse:
    plan = _plan(req.plan, req.plan_id)
    try:
        return best_schedule(req, plan, load_catalog())
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Unknown procedure code {exc}") from None
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None


@app.post("/benefits-status", response_model=BenefitsStatus)
def post_benefits_status(req: BenefitsStatusRequest) -> BenefitsStatus:
    plan = _plan(req.plan, req.plan_id)
    return benefits_status(plan, req.usage, load_catalog(), req.current_month)


def _ics_escape(text: str) -> str:
    return (text.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,")
            .replace("\n", "\\n"))


@app.get("/reminders.ics")
def reminders(plan_name: str = "Your dental plan", max_remaining: float = 0,
              month: int = Query(default=11, ge=1, le=12)) -> Response:
    today = datetime.now(timezone.utc).date()
    year = today.year if today <= date(today.year, 12, 15) else today.year + 1
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    summary = "Use your dental benefits before they reset"
    desc = (f"{plan_name}: you have about ${max_remaining:,.0f} of your yearly maximum left "
            f"(as of month {month}). Unused benefits do not carry over, so book your visits soon. "
            "This is an estimate, not a guarantee.")
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Dental Benefits Prototype//EN",
             "CALSCALE:GREGORIAN", "METHOD:PUBLISH"]
    for day in (1, 15):
        start = date(year, 12, day)
        lines += [
            "BEGIN:VEVENT",
            f"UID:{uuid.uuid4()}@dental-prototype",
            f"DTSTAMP:{stamp}",
            f"DTSTART;VALUE=DATE:{start:%Y%m%d}",
            f"DTEND;VALUE=DATE:{start + timedelta(days=1):%Y%m%d}",
            f"SUMMARY:{_ics_escape(summary)}",
            f"DESCRIPTION:{_ics_escape(desc)}",
            "END:VEVENT",
        ]
    lines.append("END:VCALENDAR")
    body = "\r\n".join(lines) + "\r\n"
    return Response(content=body, media_type="text/calendar",
                    headers={"Content-Disposition": 'attachment; filename="dental-reminders.ics"'})
