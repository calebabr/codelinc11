"""Shared dependencies: the database store, signed demo tokens, error mapping.

No passwords. A token is the member id signed with HMAC, so the server can
check it without a session table. The signing secret comes from
SESSION_SECRET, or is random per process (tokens then end on restart).
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
from collections.abc import Callable
from typing import Annotated, Any

from fastapi import Depends, Header, HTTPException

from ..db import AccessDenied, NotFound, Store

_SECRET = os.environ.get("SESSION_SECRET") or secrets.token_hex(32)
_store: Store | None = None


def get_store() -> Store:
    """One Store per process (tests override it with app.dependency_overrides)."""
    global _store
    if _store is None:
        _store = Store()
    return _store


def make_token(member_id: str) -> str:
    body = base64.urlsafe_b64encode(member_id.encode()).decode().rstrip("=")
    sig = hmac.new(_SECRET.encode(), body.encode(), hashlib.sha256).hexdigest()[:32]
    return f"{body}.{sig}"


def read_token(token: str) -> str | None:
    body, _, sig = token.partition(".")
    good = hmac.new(_SECRET.encode(), body.encode(), hashlib.sha256).hexdigest()[:32]
    if not body or not hmac.compare_digest(sig, good):
        return None
    try:
        return base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)).decode()
    except Exception:  # noqa: BLE001
        return None


def current_member_id(authorization: str | None = Header(default=None)) -> str:
    """The signed-in member id, from 'Authorization: Bearer <token>'. 401 if missing or bad."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Please sign in.")
    member_id = read_token(authorization[7:].strip())
    if member_id is None:
        raise HTTPException(status_code=401, detail="Your session is not valid. Please sign in again.")
    return member_id


def guarded(fn: Callable[[], Any]) -> Any:
    """Run a store call and turn its errors into plain HTTP errors."""
    try:
        return fn()
    except AccessDenied as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from None
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=f"Not found: {exc}") from None
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None


Viewer = Annotated[str, Depends(current_member_id)]
StoreDep = Annotated[Store, Depends(get_store)]
