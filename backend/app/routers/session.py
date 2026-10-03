"""Shared dependencies: the database store, signed demo tokens, error mapping.

No passwords. A token is the member id plus an expiry time, signed with HMAC, so the server can
check it without a session table. Tokens last SESSION_TTL_HOURS (default 12). The signing secret
is SESSION_SECRET if set; otherwise it is generated once and saved to database/.session_secret
(git-ignored) so a server restart does not sign everyone out.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
import time
from collections.abc import Callable
from pathlib import Path
from typing import Annotated, Any

from fastapi import Depends, Header, HTTPException

from ..db import AccessDenied, NotFound, Store
from ..db.core import REPO_ROOT, seed_if_empty

SECRET_FILE = REPO_ROOT / "database" / ".session_secret"


def _load_secret() -> str:
    env = os.environ.get("SESSION_SECRET")
    if env:
        return env
    try:
        saved = SECRET_FILE.read_text(encoding="utf-8").strip()
        if saved:
            return saved
    except OSError:
        pass
    fresh = secrets.token_hex(32)
    try:
        Path(SECRET_FILE).parent.mkdir(parents=True, exist_ok=True)
        SECRET_FILE.write_text(fresh, encoding="utf-8")
    except OSError:
        pass  # read-only disk: the secret then lasts for this process only
    return fresh


_SECRET = _load_secret()
_store: Store | None = None


def _now() -> float:
    """Current time in seconds (tests replace this to check expiry)."""
    return time.time()


def _ttl_seconds() -> float:
    try:
        return float(os.environ.get("SESSION_TTL_HOURS", "12")) * 3600
    except ValueError:
        return 12 * 3600.0


def get_store() -> Store:
    """One Store per process (tests override it with app.dependency_overrides)."""
    global _store
    if _store is None:
        _store = Store()
        seed_if_empty(_store.path)
    return _store


def _sign(body: str) -> str:
    return hmac.new(_SECRET.encode(), body.encode(), hashlib.sha256).hexdigest()[:32]


def make_token(member_id: str) -> str:
    payload = f"{member_id}|{int(_now() + _ttl_seconds())}"
    body = base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=")
    return f"{body}.{_sign(body)}"


def read_token(token: str) -> str | None:
    """The member id if the token is genuine and not expired, else None."""
    body, _, sig = token.partition(".")
    if not body or not hmac.compare_digest(sig, _sign(body)):
        return None
    try:
        payload = base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)).decode()
        member_id, _, exp = payload.rpartition("|")
        if not member_id or _now() >= int(exp):
            return None
    except Exception:  # noqa: BLE001
        return None
    return member_id


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
