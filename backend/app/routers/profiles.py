"""Profiles and family members (sprint 2, B1), demo family only.

PATCH  /members/{id}/profile                    edit name, dob, email, phone, zip, notes
POST   /households/{id}/members                 add a person (primary only)
DELETE /households/{id}/members/{member_id}     remove a person and all their data (primary only)

Checks run in this order: who you are (403/404), then the body (422), then the rules that need
the database (422 plain messages). Contact details are never logged and never sent to the model.
"""
from __future__ import annotations

import re
from datetime import date
from typing import Any

from fastapi import APIRouter, HTTPException

from ..db import DEMO_TODAY
from ..db.store import age_on
from ..models import Member, NewMember, ProfilePatch
from .households import clean_name, member_model
from .session import StoreDep, Viewer, guarded

router = APIRouter(tags=["profiles"])

DOB_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
EMAIL_RE = re.compile(r"^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$")
PHONE_PUNCT = set(" ()-.+")
MAX_AGE = 110


def _bad(msg: str) -> HTTPException:
    return HTTPException(status_code=422, detail=msg)


def clean_dob(raw: str) -> str:
    raw = raw.strip()
    try:
        if not DOB_RE.match(raw):
            raise ValueError
        d = date.fromisoformat(raw)
    except ValueError:
        raise _bad("Enter a date of birth like 1985-03-14 (year, month, day).") from None
    if d > DEMO_TODAY:
        raise _bad("A date of birth can't be in the future.")
    if age_on(d) > MAX_AGE:
        raise _bad(f"Enter a date of birth within the last {MAX_AGE} years.")
    return d.isoformat()


def clean_email(raw: str | None) -> str | None:
    if raw is None or not raw.strip():
        return None
    v = raw.strip()
    if len(v) > 80:
        raise _bad("An email address can be up to 80 characters.")
    if not EMAIL_RE.match(v):
        raise _bad("Enter an email address like name@example.test.")
    return v


def clean_phone(raw: str | None) -> str | None:
    """Digits only, 10 to 15. Spaces, dashes, dots, parentheses and a leading plus are allowed."""
    if raw is None or not raw.strip():
        return None
    v = raw.strip()
    digits = "".join(c for c in v if c not in PHONE_PUNCT)
    if not (digits.isascii() and digits.isdigit()) or not 10 <= len(digits) <= 15:
        raise _bad("Enter a phone number with 10 to 15 digits, like 334-555-0142.")
    return digits


def clean_zip(raw: str | None) -> str | None:
    if raw is None or not raw.strip():
        return None
    v = raw.strip()
    if not (len(v) == 5 and v.isascii() and v.isdigit()):
        raise _bad("A ZIP code has 5 digits, like 36830.")
    return v


def clean_notes(raw: str | None) -> str | None:
    if raw is None or not raw.strip():
        return None
    v = raw.strip()
    if len(v) > 200:
        raise _bad("Notes can be up to 200 characters.")
    if "<" in v or ">" in v:
        raise _bad("Notes can't contain the characters < or >.")
    return v


@router.patch("/members/{member_id}/profile", response_model=Member)
def patch_profile(member_id: str, req: ProfilePatch, viewer: Viewer, store: StoreDep) -> Member:
    """Edit one person's profile. A primary may edit anyone in the household; an adult only
    themself. 403 in the shared template family. 422 with a plain message for a bad value, an empty
    request, or a date of birth change the rules do not allow (for example an adult with a login
    can't become under 18). Changing the date of birth updates `age` (demo clock) and the role."""
    guarded(lambda: store.check_profile_access(viewer, member_id))
    sent = req.model_fields_set
    if not sent:
        raise _bad("Send at least one field to change.")
    changes: dict[str, Any] = {}
    if "name" in sent:
        if req.name is None:
            raise _bad("A name is required.")
        changes["name"] = clean_name(req.name, "A name", 24)
    if "dob" in sent:
        if req.dob is None:
            raise _bad("A date of birth is required.")
        changes["dob"] = clean_dob(req.dob)
    for key, fn in (("email", clean_email), ("phone", clean_phone), ("zip", clean_zip),
                    ("notes", clean_notes)):
        if key in sent:
            changes[key] = fn(getattr(req, key))
    return member_model(guarded(lambda: store.update_member_profile(viewer, member_id, changes)))


@router.post("/households/{household_id}/members", response_model=Member, status_code=201)
def add_member(household_id: str, req: NewMember, viewer: Viewer, store: StoreDep) -> Member:
    """Primary adds a person to their own demo family (up to 8). Under 18 becomes a managed member;
    18 or older becomes an adult without a login. 403 for non-primary or the template family."""
    guarded(lambda: store.check_family_access(viewer, household_id))
    m = guarded(lambda: store.add_member(
        viewer, household_id, clean_name(req.name, "A name", 24), req.relationship,
        clean_dob(req.dob), clean_email(req.email), clean_phone(req.phone), clean_zip(req.zip)))
    return member_model(m)


@router.delete("/households/{household_id}/members/{member_id}")
def remove_member(household_id: str, member_id: str, viewer: Viewer, store: StoreDep) -> dict[str, Any]:
    """Primary removes a person (never themself) and everything stored for them. 403 for
    non-primary or the template family, 404 for someone not in this household."""
    guarded(lambda: store.remove_member(viewer, household_id, member_id))
    return {"ok": True, "member_id": member_id}
