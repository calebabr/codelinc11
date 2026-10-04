"""Assistant endpoints: POST /chat (SSE), GET /chat/suggestions, POST /chat/attachments,
GET /members/{id}/assistant-context.

With a `member_id` the chat is personal: it needs a signed-in session (Authorization: Bearer ...),
the access layer decides whether the viewer may see that member (primary: anyone in the household,
adult: only themself), and the assistant gets only that person's plan, usage and context. Each
exchange is saved to that person's chat memory. Chat needs a signed-in session unless ASSISTANT_ALLOW_ANONYMOUS=1 (default off).
Without a `member_id` the chat is stateless and
uses the plan and usage in the request (nothing is loaded or saved).

Include in main.py:  app.include_router(chat_router.router)  and remove the old POST /chat there.
"""
from __future__ import annotations

import base64
import contextlib
import json
import os
import secrets
from collections.abc import Iterator
from dataclasses import dataclass
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import Field

from .. import ratelimit
from ..agent.context import MemberContext, build_member_context
from ..agent.loop import run_chat
from ..agent.providers import Provider, select_provider
from ..agent.suggestions import suggest_questions
from ..models import ChatRequest
from .session import StoreDep, Viewer, guarded, read_token

router = APIRouter(tags=["assistant"])

MAX_PDF_BYTES = 5 * 1024 * 1024
MAX_ATTACHMENTS_PER_CHAT = 3
SAMPLE_NOTICE = "Demo only: upload sample documents, not real health records."
SAVED_MODES = {"anthropic", "ollama", "template"}


class MemberChatRequest(ChatRequest):
    member_id: str | None = None      # the person the chat is about (default: stateless chat)
    attachment_ids: list[str] = Field(default_factory=list)    # ids from POST /chat/attachments
    scope: Literal["reports"] | None = None   # "reports": questions about saved claims, EOBs, copays


@dataclass
class _Attachment:
    viewer_id: str
    member_id: str
    filename: str
    data: bytes


_ATTACHMENTS: dict[str, _Attachment] = {}   # in memory only; cleared when the server restarts


def get_provider() -> Provider | None:
    """Overridden in tests with a scripted fake provider."""
    return select_provider()


ProviderDep = Annotated[Provider | None, Depends(get_provider)]


class _NoProvider:
    name = "unavailable"
    supports_documents = False

    def is_available(self) -> bool:
        return False


def optional_viewer(authorization: str | None = Header(default=None)) -> str | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    return read_token(authorization[7:].strip())


def _sse(events: Iterator[dict]) -> Iterator[str]:
    try:
        for ev in events:
            yield f"event: {ev['event']}\ndata: {json.dumps(ev['data'])}\n\n"
    except Exception as exc:  # noqa: BLE001  keep the stream well-formed
        yield f"event: error\ndata: {json.dumps({'message': type(exc).__name__})}\n\n"


def _context(store: Any, viewer_id: str, member_id: str) -> MemberContext:
    return guarded(lambda: build_member_context(store, viewer_id, member_id))


def _remember(store: Any, ctx: MemberContext, user_text: str, events: Iterator[dict]) -> Iterator[dict]:
    """Pass events through; after a good answer, save the exchange to this member's memory."""
    parts: list[str] = []
    mode = ""
    for ev in events:
        if ev["event"] == "token":
            parts.append(ev["data"]["text"])
        elif ev["event"] == "done":
            mode = ev["data"].get("mode", "")
        yield ev
    if mode in SAVED_MODES and parts and user_text.strip():
        with contextlib.suppress(Exception):  # saving memory must never break the answer
            store.append_member_context(ctx.viewer_id, ctx.member_id, "chat", user_text, role="user")
            store.append_member_context(ctx.viewer_id, ctx.member_id, "chat", "".join(parts).strip(),
                                        role="assistant")


@router.post("/chat", dependencies=[Depends(ratelimit.limit_chat)])
def chat(req: MemberChatRequest, store: StoreDep, provider: ProviderDep,
         viewer: Annotated[str | None, Depends(optional_viewer)] = None) -> StreamingResponse:
    if viewer is None and os.environ.get("ASSISTANT_ALLOW_ANONYMOUS") != "1":
        raise HTTPException(status_code=401, detail="Please sign in to use the assistant.")
    headers = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    client: Any = provider if provider is not None else _NoProvider()
    plain = ChatRequest(messages=req.messages, plan_id=req.plan_id, plan=req.plan,
                        usage=req.usage, current_month=req.current_month)

    if req.member_id is None:
        if req.attachment_ids:
            raise HTTPException(status_code=422, detail="Name the person (member_id) to attach a document.")
        return StreamingResponse(_sse(run_chat(plain, client=client)),
                                 media_type="text/event-stream", headers=headers)

    if viewer is None:
        raise HTTPException(status_code=401, detail="Please sign in to chat about a person.")
    ctx = _context(store, viewer, req.member_id)

    documents: list[dict] = []
    if len(req.attachment_ids) > MAX_ATTACHMENTS_PER_CHAT:
        raise HTTPException(status_code=422, detail="Too many attachments.")
    for aid in req.attachment_ids:
        att = _ATTACHMENTS.get(aid)
        if att is None or att.viewer_id != viewer or att.member_id != req.member_id:
            raise HTTPException(status_code=404, detail="Attachment not found.")
        documents.append({"media_type": "application/pdf",
                          "data": base64.b64encode(att.data).decode()})

    if req.scope == "reports":
        # Same visibility rule as the Reports page; the rows (cents) stay on the server and only
        # the tool results reach the model. A reports chat is not saved to the general chat memory.
        rows = guarded(lambda: store.list_report_items(viewer, req.member_id))
        events = run_chat(plain, client=client, context=ctx, scope="reports", reports=rows)
        return StreamingResponse(_sse(events), media_type="text/event-stream", headers=headers)

    last_user = next((m.content for m in reversed(req.messages) if m.role == "user"), "")
    events = run_chat(plain, client=client, context=ctx, documents=documents or None)
    return StreamingResponse(_sse(_remember(store, ctx, last_user, events)),
                             media_type="text/event-stream", headers=headers)


@router.get("/chat/suggestions")
def suggestions(store: StoreDep, viewer: Viewer, member_id: str | None = Query(default=None)) -> dict:
    ctx = _context(store, viewer, member_id or viewer)
    return {"member_id": ctx.member_id, "suggestions": suggest_questions(ctx)}


@router.get("/members/{member_id}/assistant-context")
def assistant_context(member_id: str, store: StoreDep, viewer: Viewer) -> dict:
    """What the assistant knows about this person (for the 'what the assistant knows' panel)."""
    return _context(store, viewer, member_id).public_view()


@router.delete("/members/{member_id}/chat")
def clear_chat(member_id: str, store: StoreDep, viewer: Viewer) -> dict:
    """Clear this person's saved assistant chat (same visibility rule as chat)."""
    removed = guarded(lambda: store.clear_chat_memory(viewer, member_id))
    return {"ok": True, "removed": removed}


@router.post("/chat/attachments", dependencies=[Depends(ratelimit.limit_attachments)])
async def upload_attachment(request: Request, store: StoreDep, viewer: Viewer,
                            member_id: str, filename: str = "document.pdf") -> dict:
    """Upload one PDF as the raw request body (Content-Type: application/pdf, max 5 MB)."""
    guarded(lambda: store.get_member(viewer, member_id))  # same visibility rule as chat
    if (request.headers.get("content-type") or "").split(";")[0].strip().lower() != "application/pdf":
        raise HTTPException(status_code=415, detail="Only PDF files can be attached.")
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > MAX_PDF_BYTES:
        raise HTTPException(status_code=413, detail="That file is too large (limit 5 MB).")
    data = await request.body()
    if len(data) > MAX_PDF_BYTES:
        raise HTTPException(status_code=413, detail="That file is too large (limit 5 MB).")
    if not data.startswith(b"%PDF-"):
        raise HTTPException(status_code=415, detail="That file is not a PDF.")
    aid = "att-" + secrets.token_hex(6)
    safe_name = "".join(ch for ch in filename if ch.isalnum() or ch in "._- ")[:80] or "document.pdf"
    _ATTACHMENTS[aid] = _Attachment(viewer, member_id, safe_name, data)
    return {"attachment_id": aid, "filename": safe_name, "size": len(data), "notice": SAMPLE_NOTICE}
