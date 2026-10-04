"""Demo sign-in: GET /auth/demo-accounts, POST /auth/demo-login.

With `sandbox: true` the visitor gets their own copy of the demo family (see db/sandbox.py)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from .. import ratelimit
from ..db import sandbox as sandboxes
from ..models import DemoAccount, DemoLoginRequest, DemoLoginResponse, SandboxInfo
from .households import household_model, member_model
from .session import StoreDep, guarded, make_token

router = APIRouter(tags=["auth"])

GONE = "That demo family has expired or no longer exists. Start a new one."


def _find_sandbox(store, request: Request, household_id: str) -> dict:
    """The live sandbox, or 410. Misses are counted per caller so ids cannot be guessed."""
    ratelimit.check_probe_allowed(request)
    info = store.get_sandbox(household_id)
    if info is None:
        ratelimit.record_probe_failure(request)
        raise HTTPException(status_code=410, detail=GONE)
    return info


@router.get("/auth/demo-accounts", response_model=list[DemoAccount])
def demo_accounts(store: StoreDep, request: Request, household_id: str | None = None) -> list[DemoAccount]:
    """The shared template accounts, or (with `household_id`) one sandbox's own accounts.
    410 if that sandbox is unknown or expired (the same answer for both). Callers who miss more
    than RATE_PROBE_PER_MINUTE family ids a minute get 429."""
    if household_id is not None:
        _find_sandbox(store, request, household_id)
    return [DemoAccount(**a) for a in store.list_demo_accounts(household_id)]


@router.post("/auth/demo-login", response_model=DemoLoginResponse)
def demo_login(req: DemoLoginRequest, store: StoreDep, request: Request) -> DemoLoginResponse:
    info = None
    member_id = req.member_id
    if req.sandbox and req.household_id:
        info = _find_sandbox(store, request, req.household_id)
        mapped = sandboxes.member_in_sandbox(req.member_id, req.household_id)
        if mapped is None:
            raise HTTPException(status_code=404, detail="No demo account for that member.")
        member_id = mapped
    elif req.sandbox:
        base, _ = sandboxes.split_id(req.member_id)
        if not any(a["member_id"] == base for a in store.list_demo_accounts()):
            raise HTTPException(status_code=404, detail="No demo account for that member.")
        ratelimit.check_sandbox_login(request)  # only creating a sandbox is limited
        info = store.create_sandbox()
        member_id = sandboxes.member_in_sandbox(base, info["household_id"]) or base
    account = next((a for a in store.list_demo_accounts(info["household_id"] if info else None)
                    if a["member_id"] == member_id), None)
    if account is None:
        raise HTTPException(status_code=404, detail="No demo account for that member.")
    member = guarded(lambda: store.get_account_member(account["account_id"]))
    household = guarded(lambda: store.get_household(member["id"], member["household_id"]))
    return DemoLoginResponse(token=make_token(member["id"]), member=member_model(member),
                             household=household_model(household),
                             sandbox=SandboxInfo(**info) if info else None)
