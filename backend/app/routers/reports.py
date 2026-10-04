"""Reports (sprint 2, B4): synthetic claims, EOBs and copay-style visits, kept per person.

GET    /reports/samples                              the five sample documents (text included)
POST   /members/{id}/reports/samples/{sample_id}     add one sample (demo family only)
POST   /members/{id}/reports/upload?kind=&filename=  raw text/plain body in the sample template (max 20 KB)
GET    /members/{id}/reports?kind=&from=&to=&order=  items plus totals computed from the stored values
GET    /members/{id}/reports/{item_id}               one item
GET    /members/{id}/reports/{item_id}/explain       plain-language explanation built in code (no model)
POST   /members/{id}/reports/{item_id}/mark-paid     mark what you owe as paid (demo family only)
DELETE /members/{id}/reports/{item_id}               remove an item (demo family only)

Visibility is the usual rule: a primary sees everyone in the household, an adult only themself, and
managed members have no login. Reading works in the shared template family; every write is demo
family only (403 otherwise). The documents are synthetic: the parser accepts only the sample
template, and any other text gets 422 "Demo accepts the sample documents only.".
"""
from __future__ import annotations

from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response

from .. import ratelimit
from ..engine.reports import to_dollars, totals
from ..models import (
    ReportExplanation,
    ReportItem,
    ReportKind,
    ReportList,
    ReportSample,
    ReportTotals,
)
from ..reports import (
    DEMO_ONLY,
    MAX_UPLOAD_BYTES,
    ReportParseError,
    explain,
    get_sample,
    item_out,
    list_samples,
    parse_document,
)
from .session import StoreDep, Viewer, guarded

router = APIRouter(tags=["reports"])


def _parse(store, text: str, expected_kind: str | None) -> dict:
    try:
        return parse_document(text, store.list_providers(), expected_kind)
    except ReportParseError:
        raise HTTPException(status_code=422, detail=DEMO_ONLY) from None


def _iso(value: str | None, what: str) -> str | None:
    if value is None or value == "":
        return None
    try:
        return date.fromisoformat(value).isoformat()
    except ValueError:
        raise HTTPException(status_code=422, detail=f"'{what}' must be a date like 2026-09-30.") from None


@router.get("/reports/samples", response_model=list[ReportSample])
def get_samples(viewer: Viewer) -> list[ReportSample]:
    """The sample documents. Each has `text` in the template that upload accepts. All made up."""
    return list_samples()


@router.post("/members/{member_id}/reports/samples/{sample_id}", response_model=ReportItem, status_code=201,
             dependencies=[Depends(ratelimit.limit_compute)])
def add_sample(member_id: str, sample_id: str, viewer: Viewer, store: StoreDep) -> ReportItem:
    """Add one sample document to this person's reports (demo family only; 404 unknown sample)."""
    sample = get_sample(sample_id)
    if sample is None:
        raise HTTPException(status_code=404, detail=f"Not found: sample {sample_id}")
    guarded(lambda: store.check_profile_access(viewer, member_id))
    item = _parse(store, sample.text, None)
    return item_out(guarded(lambda: store.add_report_item(viewer, member_id, item)))


@router.post("/members/{member_id}/reports/upload", response_model=ReportItem, status_code=201,
             dependencies=[Depends(ratelimit.limit_compute)])
async def upload(
    member_id: str, request: Request, viewer: Viewer, store: StoreDep,
    kind: ReportKind | None = None,
    filename: Annotated[str | None, Query(max_length=80)] = None,
) -> ReportItem:
    """Save a document written in the sample template (a raw `text/plain` body of at most 20 KB).
    `kind`, when given, must match the document's `Type` line. `filename` is only checked for
    length. Anything that is not the sample template gets 422 "Demo accepts the sample documents
    only." The text is never echoed back."""
    ctype = request.headers.get("content-type", "").split(";")[0].strip().lower()
    if ctype != "text/plain":
        raise HTTPException(status_code=415, detail="Send the document as plain text (text/plain).")
    raw = await request.body()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="That file is too big. The limit is 20 KB.")
    guarded(lambda: store.check_profile_access(viewer, member_id))
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=422, detail=DEMO_ONLY) from None
    item = _parse(store, text, kind)
    return item_out(guarded(lambda: store.add_report_item(viewer, member_id, item)))


@router.get("/members/{member_id}/reports", response_model=ReportList)
def list_reports(
    member_id: str, viewer: Viewer, store: StoreDep,
    kind: ReportKind | None = None,
    from_: Annotated[str | None, Query(alias="from", max_length=10)] = None,
    to: Annotated[str | None, Query(max_length=10)] = None,
    order: Literal["asc", "desc"] = "asc",
) -> ReportList:
    """Items by service date (`order=asc` is oldest first, the default), with `totals` added up in
    code from the stored values of exactly the items listed."""
    d_from, d_to = _iso(from_, "from"), _iso(to, "to")
    rows = guarded(lambda: store.list_report_items(viewer, member_id, kind, d_from, d_to, order == "desc"))
    t = totals(rows)
    return ReportList(
        items=[item_out(r) for r in rows], count=len(rows),
        totals=ReportTotals(**{k: to_dollars(v) for k, v in t.items()}))


@router.get("/members/{member_id}/reports/{item_id}", response_model=ReportItem)
def get_report(member_id: str, item_id: str, viewer: Viewer, store: StoreDep) -> ReportItem:
    return item_out(guarded(lambda: store.get_report_item(viewer, member_id, item_id)))


@router.get("/members/{member_id}/reports/{item_id}/explain", response_model=ReportExplanation)
def explain_report(member_id: str, item_id: str, viewer: Viewer, store: StoreDep) -> ReportExplanation:
    """What the document is, each line in plain words, the steps billed, allowed, deductible, plan
    paid and you owe, what to do next, and a balance billing note when the dentist is out of
    network. Built in code from the stored values; no model is involved."""
    return explain(guarded(lambda: store.get_report_item(viewer, member_id, item_id)))


@router.post("/members/{member_id}/reports/{item_id}/mark-paid", response_model=ReportItem)
def mark_paid(member_id: str, item_id: str, viewer: Viewer, store: StoreDep) -> ReportItem:
    """Mark what you owe on this document as paid (demo family only). 422 when nothing is owed."""
    return item_out(guarded(lambda: store.mark_report_paid(viewer, member_id, item_id)))


@router.delete("/members/{member_id}/reports/{item_id}", status_code=204)
def delete_report(member_id: str, item_id: str, viewer: Viewer, store: StoreDep) -> Response:
    guarded(lambda: store.delete_report_item(viewer, member_id, item_id))
    return Response(status_code=204)
