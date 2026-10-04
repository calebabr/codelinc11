"""The login screen needs to know who is still waiting for approval."""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_demo_accounts_include_member_status():
    accounts = client.get("/auth/demo-accounts").json()
    status = {a["display_name"].split()[0]: a["status"] for a in accounts}
    assert status == {"Marc": "active", "AC": "active", "Hannah": "pending"}


def test_sandbox_accounts_keep_the_pending_status():
    login = client.post("/auth/demo-login", json={"member_id": "m-jordan", "sandbox": True}).json()
    hid = login["sandbox"]["household_id"]
    accounts = client.get("/auth/demo-accounts", params={"household_id": hid}).json()
    pending = [a["display_name"].split()[0] for a in accounts if a["status"] == "pending"]
    assert pending == ["Hannah"]
