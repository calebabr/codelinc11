"""Demo sign-in: GET /auth/demo-accounts, POST /auth/demo-login."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..models import DemoAccount, DemoLoginRequest, DemoLoginResponse
from .households import household_model, member_model
from .session import StoreDep, guarded, make_token

router = APIRouter(tags=["auth"])


@router.get("/auth/demo-accounts", response_model=list[DemoAccount])
def demo_accounts(store: StoreDep) -> list[DemoAccount]:
    return [DemoAccount(**a) for a in store.list_demo_accounts()]


@router.post("/auth/demo-login", response_model=DemoLoginResponse)
def demo_login(req: DemoLoginRequest, store: StoreDep) -> DemoLoginResponse:
    account = next((a for a in store.list_demo_accounts() if a["member_id"] == req.member_id), None)
    if account is None:
        raise HTTPException(status_code=404, detail="No demo account for that member.")
    member = guarded(lambda: store.get_account_member(account["account_id"]))
    household = guarded(lambda: store.get_household(member["id"], member["household_id"]))
    return DemoLoginResponse(token=make_token(member["id"]), member=member_model(member),
                             household=household_model(household))
