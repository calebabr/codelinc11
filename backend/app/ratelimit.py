"""Rate limiting: in-memory sliding windows (one server process), applied as FastAPI dependencies.

Over the limit a request gets HTTP 429, a `Retry-After` header and the JSON body
`{"detail": "<friendly sentence>", "retry_after": <seconds>}`.

The key is the caller's household id (from the signed token), falling back to the client IP.
The client IP is the socket address, or the first hop of `X-Forwarded-For` when TRUST_PROXY=1.

Environment (read on every request, so tests and operators can change them live):
  RATE_LIMIT_ENABLED (1)   RATE_LOGIN_PER_MINUTE (10)  RATE_LOGIN_PER_HOUR (60)
  RATE_CHAT_PER_MINUTE (12)  RATE_CHAT_PER_DAY (200)  CHAT_GLOBAL_DAILY_CAP (3000)
  RATE_ATTACH_PER_MINUTE (5)  RATE_COMPUTE_PER_MINUTE (60)  RATE_RESET_PER_MINUTE (5)
  TRUST_PROXY (0)
"""
from __future__ import annotations

import math
import os
import threading
import time
from collections import deque
from collections.abc import Callable

from fastapi import FastAPI, Header, Request
from fastapi.responses import JSONResponse

MINUTE, HOUR, DAY = 60.0, 3600.0, 86400.0


class RateLimited(Exception):
    def __init__(self, retry_after: int, message: str):
        super().__init__(message)
        self.retry_after = retry_after
        self.message = message


class SlidingWindowLimiter:
    """Counts hits per key inside sliding windows. Thread-safe; the clock can be replaced."""

    def __init__(self, clock: Callable[[], float] = time.monotonic):
        self.clock = clock
        self._lock = threading.Lock()
        self._hits: dict[tuple[str, str], deque[float]] = {}

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()

    def hit(self, name: str, key: str, limits: list[tuple[int, float]]) -> int:
        """Record one hit if every (count, seconds) limit allows it. Returns 0 if allowed, else the
        whole seconds to wait. A refused hit is not recorded."""
        now = self.clock()
        with self._lock:
            bucket = self._hits.setdefault((name, key), deque())
            horizon = max((w for _, w in limits), default=0.0)
            while bucket and bucket[0] <= now - horizon:
                bucket.popleft()
            wait = 0.0
            for count, window in limits:
                recent = [t for t in bucket if t > now - window]
                if len(recent) >= count:
                    wait = max(wait, recent[len(recent) - count] + window - now)
            if wait > 0:
                return max(1, math.ceil(wait))
            bucket.append(now)
            return 0


limiter = SlidingWindowLimiter()


def reset_for_tests() -> None:
    limiter.reset()


def _env_int(name: str, default: int) -> int:
    try:
        return max(0, int(os.environ.get(name, default)))
    except ValueError:
        return default


def enabled() -> bool:
    return os.environ.get("RATE_LIMIT_ENABLED", "1").strip().lower() not in ("0", "false", "no", "off")


def client_ip(request: Request) -> str:
    if os.environ.get("TRUST_PROXY", "0") == "1":
        fwd = request.headers.get("x-forwarded-for", "")
        first = fwd.split(",")[0].strip()
        if first:
            return first
    return request.client.host if request.client else "unknown"


def _wait_text(seconds: int) -> str:
    return f"{seconds} second{'s' if seconds != 1 else ''}" if seconds < 90 else f"{math.ceil(seconds / 60)} minutes"


def enforce(name: str, key: str, limits: list[tuple[int, float]], what: str) -> None:
    """Raise RateLimited if any limit is used up. Limits of 0 or less are skipped."""
    if not enabled():
        return
    limits = [(c, w) for c, w in limits if c > 0]
    if not limits:
        return
    wait = limiter.hit(name, key, limits)
    if wait:
        raise RateLimited(wait, f"You're doing that a little too fast ({what}). Please wait {_wait_text(wait)} and try again.")


def household_key(request: Request, authorization: str | None) -> str:
    """'hh:<household id>' for a valid token, else 'ip:<client ip>'."""
    from .routers.session import (  # late import: avoids an import cycle
        get_store,
        read_token,
    )
    if authorization and authorization.lower().startswith("bearer "):
        member_id = read_token(authorization[7:].strip())
        if member_id:
            try:
                store = request.app.dependency_overrides.get(get_store, get_store)()
                return "hh:" + store.get_member(member_id, member_id)["household_id"]
            except Exception:  # noqa: BLE001, S110 - any problem falls back to the IP
                pass
    return "ip:" + client_ip(request)


def check_sandbox_login(request: Request) -> None:
    """Limit creating demo households per client IP. Call it only when a sandbox is being created."""
    enforce("login", "ip:" + client_ip(request),
            [(_env_int("RATE_LOGIN_PER_MINUTE", 10), MINUTE), (_env_int("RATE_LOGIN_PER_HOUR", 60), HOUR)],
            "creating demo families")


def limit_chat(request: Request, authorization: str | None = Header(default=None)) -> None:
    enforce("chat", household_key(request, authorization),
            [(_env_int("RATE_CHAT_PER_MINUTE", 12), MINUTE), (_env_int("RATE_CHAT_PER_DAY", 200), DAY)],
            "too many chat messages")
    enforce("chat-global", "all", [(_env_int("CHAT_GLOBAL_DAILY_CAP", 3000), DAY)],
            "the assistant is very busy today")


def limit_attachments(request: Request, authorization: str | None = Header(default=None)) -> None:
    enforce("attach", household_key(request, authorization),
            [(_env_int("RATE_ATTACH_PER_MINUTE", 5), MINUTE)], "too many uploads")


def limit_compute(request: Request, authorization: str | None = Header(default=None)) -> None:
    enforce("compute", household_key(request, authorization),
            [(_env_int("RATE_COMPUTE_PER_MINUTE", 60), MINUTE)], "too many requests")


def limit_reset(request: Request, authorization: str | None = Header(default=None)) -> None:
    enforce("reset", household_key(request, authorization),
            [(_env_int("RATE_RESET_PER_MINUTE", 5), MINUTE)], "too many resets")


def install(app: FastAPI) -> None:
    """Register the 429 handler (JSON body with retry_after, plus the Retry-After header)."""
    @app.exception_handler(RateLimited)
    async def _handle(_: Request, exc: RateLimited) -> JSONResponse:
        return JSONResponse(status_code=429, content={"detail": exc.message, "retry_after": exc.retry_after},
                            headers={"Retry-After": str(exc.retry_after)})
