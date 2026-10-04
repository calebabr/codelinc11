"""Reports (sprint 2, B4): the synthetic sample documents, the template parser and the plain-language
explanation of a claim, an EOB or a copay-style visit.

Everything here is deterministic code. No model is involved: the parser reads one fixed template and
the explanation is built from the stored fields. Amounts are shown exactly as stored (integer cents,
formatted as dollars); the only arithmetic is the "do the lines add up" check in engine/reports.py.
Raw uploaded text is never echoed back, never logged and never sent to a model: every parse failure
gives the same fixed message.
"""
from __future__ import annotations

import re
from datetime import date
from typing import Any

from .db import DEMO_TODAY
from .engine.estimate import money
from .engine.reports import lines_problems, parse_amount_cents, to_dollars
from .models import (
    ReportData,
    ReportExplanation,
    ReportItem,
    ReportLine,
    ReportSample,
    ReportStep,
)

HEADER = "MOLAR MONEY SAMPLE DOCUMENT"
DEMO_ONLY = "Demo accepts the sample documents only."
MAX_UPLOAD_BYTES = 20 * 1024
MAX_VALUE = 120
MAX_REMARK = 200
DISCLAIMER = "This is an estimate. Your actual cost depends on your dentist's charges and claim review."
SYNTHETIC_NOTICE = "This is a made-up demo document. Nothing in it is real and nothing is sent to anyone."
URGENT = "If you have pain or something urgent, call your dentist now; don't wait."
KINDS = ("claim", "eob", "copay", "other")
KIND_LABEL = {"claim": "Claim", "eob": "EOB", "copay": "Copay visit", "other": "Document"}


class ReportParseError(ValueError):
    """The text is not one of the sample documents. The message is always the same fixed sentence."""

    def __init__(self) -> None:
        super().__init__(DEMO_ONLY)


# ---------------------------------------------------------------------------------------------
# Samples (also the template the upload accepts)
# ---------------------------------------------------------------------------------------------

def _doc(*pairs: tuple[str, str]) -> str:
    return "\n".join([HEADER, *(f"{k}: {v}" for k, v in pairs)]) + "\n"


_SAMPLES: list[ReportSample] = [
    ReportSample(
        id="sample-paid-claim", title="Paid claim: cleaning", kind="claim",
        description="A claim your plan has already processed and paid.",
        text=_doc(("Type", "Claim"), ("Date", "2026-09-09"), ("Provider", "Plainsman Family Dental"),
                  ("Code", "D1110"), ("Description", "Cleaning (adult)"), ("Claim number", "SYN-CLM-100901"),
                  ("Billed", "120.00"), ("Status", "paid"),
                  ("Remark", "Processed. Your plan covers cleanings in full."))),
    ReportSample(
        id="sample-eob-deductible", title="EOB: filling with a deductible", kind="eob",
        description="An explanation of benefits where the yearly deductible was applied first.",
        text=_doc(("Type", "EOB"), ("Date", "2026-09-22"), ("Provider", "Loblolly Smiles"),
                  ("Code", "D2392"), ("Description", "Filling, 2 surfaces (composite)"),
                  ("Claim number", "SYN-CLM-100922"), ("EOB number", "SYN-EOB-200922"),
                  ("Billed", "260.00"), ("Allowed", "200.00"), ("Deductible", "50.00"),
                  ("Coinsurance", "30.00"), ("Plan paid", "120.00"), ("Balance billing", "0.00"),
                  ("You owe", "80.00"), ("Remark", "Your $50 deductible was applied first."))),
    ReportSample(
        id="sample-eob-out-of-network", title="EOB: out-of-network crown", kind="eob",
        description="An explanation of benefits where the dentist is out of network, so there is balance billing.",
        text=_doc(("Type", "EOB"), ("Date", "2026-10-05"), ("Provider", "Tarheel Crossing Dental Arts"),
                  ("Code", "D2740"), ("Description", "Crown, porcelain/ceramic"),
                  ("Claim number", "SYN-CLM-101005"), ("EOB number", "SYN-EOB-201005"),
                  ("Billed", "1500.00"), ("Allowed", "1200.00"), ("Deductible", "50.00"),
                  ("Coinsurance", "575.00"), ("Plan paid", "575.00"), ("Balance billing", "300.00"),
                  ("You owe", "925.00"),
                  ("Remark", "Out-of-network dentist. The plan paid on the allowed amount."))),
    ReportSample(
        id="sample-denied-claim", title="Denied claim: third cleaning", kind="claim",
        description="A claim the plan did not pay, with the reason.",
        text=_doc(("Type", "Claim"), ("Date", "2026-10-12"), ("Provider", "Plainsman Family Dental"),
                  ("Code", "D1110"), ("Description", "Cleaning (adult)"), ("Claim number", "SYN-CLM-101012"),
                  ("Billed", "120.00"), ("Status", "denied"),
                  ("Remark", "Not covered: this plan covers 2 cleanings per plan year."))),
    ReportSample(
        id="sample-copay-visit", title="Copay visit: exam", kind="copay",
        description="A visit where you pay a flat fee (a copay) and the plan pays the rest.",
        text=_doc(("Type", "Copay"), ("Date", "2026-10-02"), ("Provider", "Auburn Hollow Smile Studio"),
                  ("Description", "Exam visit (flat copay)"), ("Billed", "150.00"), ("Allowed", "150.00"),
                  ("Plan paid", "125.00"), ("Copay", "25.00"), ("You owe", "25.00"),
                  ("Remark", "Flat $25 copay for this visit."))),
]


def list_samples() -> list[ReportSample]:
    return [s.model_copy() for s in _SAMPLES]


def get_sample(sample_id: str) -> ReportSample | None:
    return next((s.model_copy() for s in _SAMPLES if s.id == sample_id), None)


# ---------------------------------------------------------------------------------------------
# Parser
# ---------------------------------------------------------------------------------------------

_KEYS = {"type", "date", "provider", "code", "description", "title", "claim_number", "eob_number", "status",
         "billed", "allowed", "deductible", "coinsurance", "copay", "plan_paid", "balance_billing",
         "you_owe", "paid", "remark"}
_AMOUNT_KEYS = {"billed": "billed_cents", "allowed": "allowed_cents", "deductible": "deductible_applied_cents",
                "coinsurance": "coinsurance_cents", "copay": "copay_cents", "plan_paid": "plan_paid_cents",
                "balance_billing": "balance_billing_cents", "you_owe": "you_owe_cents"}
_REQUIRED = {
    "claim": ("date", "provider", "description", "claim_number", "billed", "status"),
    "eob": ("date", "provider", "description", "eob_number", "claim_number", "billed", "allowed",
            "coinsurance", "plan_paid", "you_owe"),
    "copay": ("date", "provider", "description", "billed", "allowed", "plan_paid", "copay", "you_owe"),
    "other": ("date", "provider", "description"),
}
_LINE_RE = re.compile(r"^([A-Za-z][A-Za-z ]{0,30}):\s*(.*)$")
_NUMBER_RE = re.compile(r"^[A-Za-z0-9-]{3,30}$")
_CODE_RE = re.compile(r"^D\d{4}$")
_BAD_CHARS = re.compile(r"[<>\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def _norm_name(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def parse_document(text: str, providers: list[dict[str, Any]], expected_kind: str | None = None) -> dict[str, Any]:
    """Read one sample-template document into the dict `Store.add_report_item` saves (amounts in
    cents). Raises ReportParseError for anything that is not the template or does not add up."""
    if _BAD_CHARS.search(text):
        raise ReportParseError()
    lines = [ln.strip() for ln in text.replace("\r\n", "\n").replace("\r", "\n").split("\n")]
    lines = [ln for ln in lines if ln]
    if not lines or lines[0] != HEADER:
        raise ReportParseError()
    f: dict[str, str] = {}
    for ln in lines[1:]:
        m = _LINE_RE.match(ln)
        if m is None:
            raise ReportParseError()
        key = re.sub(r"[ -]+", "_", m.group(1).strip().lower())
        val = m.group(2).strip()
        limit = MAX_REMARK if key == "remark" else MAX_VALUE
        if key not in _KEYS or key in f or not val or len(val) > limit:
            raise ReportParseError()
        f[key] = val
    kind = f.get("type", "").lower()
    if kind not in KINDS or (expected_kind is not None and kind != expected_kind):
        raise ReportParseError()
    if any(k not in f for k in _REQUIRED[kind]):
        raise ReportParseError()

    try:
        service_date = date.fromisoformat(f["date"])
    except ValueError:
        raise ReportParseError() from None
    if not date(2000, 1, 1) <= service_date <= DEMO_TODAY:
        raise ReportParseError()
    code = f.get("code")
    if code is not None and not _CODE_RE.match(code):
        raise ReportParseError()

    data: dict[str, Any] = {}
    for key, field in _AMOUNT_KEYS.items():
        if key in f:
            cents = parse_amount_cents(f[key])
            if cents is None:
                raise ReportParseError()
            data[field] = cents
    if kind in ("eob",):
        data.setdefault("deductible_applied_cents", 0)
        data.setdefault("balance_billing_cents", 0)
    for key in ("claim_number", "eob_number"):
        if key in f:
            if not _NUMBER_RE.match(f[key]):
                raise ReportParseError()
            data[key] = f[key]
    if kind == "claim":
        if f["status"].lower() not in ("paid", "denied", "pending"):
            raise ReportParseError()
        data["status"] = f["status"].lower()
    elif "status" in f:
        raise ReportParseError()
    if "remark" in f:
        data["remark"] = f["remark"]
    if lines_problems(kind, data):
        raise ReportParseError()

    owe = data.get("you_owe_cents", 0)
    paid_flag = f.get("paid", "").lower()
    if paid_flag not in ("", "yes", "no"):
        raise ReportParseError()
    if kind == "claim" or owe == 0:
        paid_status = "not_applicable"
    else:
        paid_status = "paid" if paid_flag == "yes" else "unpaid"

    name = f["provider"]
    hit = next((p for p in providers if _norm_name(p["practice_name"]) == _norm_name(name)), None)
    description = f["description"]
    return {
        "kind": kind, "service_date": service_date.isoformat(),
        "title": f.get("title") or f"{KIND_LABEL[kind]}: {description}",
        "provider_id": hit["id"] if hit else None,
        "provider_name": hit["practice_name"] if hit else name,
        "code": code, "description": description, "data": data, "paid_status": paid_status,
    }


# ---------------------------------------------------------------------------------------------
# Output models
# ---------------------------------------------------------------------------------------------

_DATA_OUT = {"billed_cents": "billed", "allowed_cents": "allowed", "deductible_applied_cents": "deductible_applied",
             "coinsurance_cents": "coinsurance_amount", "copay_cents": "copay_amount",
             "plan_paid_cents": "plan_paid", "you_owe_cents": "you_owe", "balance_billing_cents": "balance_billing"}


def data_out(data: dict[str, Any]) -> ReportData:
    out: dict[str, Any] = {k: data[k] for k in ("claim_number", "eob_number", "status", "remark") if k in data}
    for cents_key, name in _DATA_OUT.items():
        if cents_key in data:
            out[name] = to_dollars(data[cents_key])
    return ReportData(**out)


def item_out(row: dict[str, Any]) -> ReportItem:
    return ReportItem(
        id=row["id"], member_id=row["member_id"], kind=row["kind"], service_date=row["service_date"],
        title=row["title"], provider_id=row["provider_id"], provider_name=row["provider_name"],
        code=row["code"], description=row["description"], data=data_out(row["data"]),
        paid_status=row["paid_status"], created_at=row["created_at"])


# ---------------------------------------------------------------------------------------------
# Explanation
# ---------------------------------------------------------------------------------------------

def _m(data: dict[str, Any], key: str) -> str:
    return money((data.get(key) or 0) / 100)


def _what_it_is(row: dict[str, Any]) -> str:
    d, kind = row["data"], row["kind"]
    where = f"{row['provider_name']} for {row['description'].lower()} on {row['service_date']}"
    if kind == "claim":
        status = {"paid": "Your plan has processed it and paid its share.",
                  "denied": "Your plan did not pay this claim.",
                  "pending": "Your plan is still reviewing it."}[d.get("status", "pending")]
        return ("A claim is the bill your dentist sends to your plan. "
                f"This one is from {where}. {status}")
    if kind == "eob":
        return ("An explanation of benefits (EOB) is a notice from your plan. It is not a bill. "
                f"It shows how your plan handled one claim from {where}.")
    if kind == "copay":
        return ("A copay is a flat fee you pay at the visit, and your plan pays the rest. "
                f"This is the record of your visit to {where}.")
    return f"This is a saved document from {where}."


def _lines(row: dict[str, Any]) -> list[ReportLine]:
    d = row["data"]
    out: list[ReportLine] = []

    def add(key: str, label: str, plain: str) -> None:
        if key in d:
            out.append(ReportLine(label=label, amount=to_dollars(d[key]), plain=plain))

    add("billed_cents", "Billed", "What your dentist charged for this service.")
    add("allowed_cents", "Allowed amount",
        "The most your plan counts for this service. Your plan works out its payment from this amount.")
    if "deductible_applied_cents" in d:
        out.append(ReportLine(
            label="Deductible", amount=to_dollars(d["deductible_applied_cents"]),
            plain=("The part you pay first each year, before your plan starts sharing the cost."
                   if d["deductible_applied_cents"] else "No deductible was taken from this one.")))
    add("coinsurance_cents", "Your share (coinsurance)",
        "Your share of the allowed amount after the deductible. Your plan sets the percent.")
    add("copay_cents", "Copay", "A flat fee you pay for the visit.")
    add("plan_paid_cents", "Plan paid", "What your plan paid to the dentist.")
    if d.get("balance_billing_cents"):
        add("balance_billing_cents", "Balance billing",
            "The part of the dentist's charge above the allowed amount. An out-of-network dentist can bill you for it.")
    add("you_owe_cents", "You owe", "What you owe the dentist's office for this visit.")
    if d.get("claim_number"):
        out.append(ReportLine(label="Claim number", amount=None, plain=f"{d['claim_number']} (made-up number)."))
    if d.get("eob_number"):
        out.append(ReportLine(label="EOB number", amount=None, plain=f"{d['eob_number']} (made-up number)."))
    if d.get("remark"):
        out.append(ReportLine(label="Note on the document", amount=None, plain=str(d["remark"])))
    return out


def _steps(row: dict[str, Any]) -> list[ReportStep]:
    d = row["data"]
    spec = [
        ("billed", "billed_cents", "Billed", "Your dentist charged {v}."),
        ("allowed", "allowed_cents", "Allowed amount", "Your plan allows {v} for this service."),
        ("deductible", "deductible_applied_cents", "Deductible",
         "{v} went toward your yearly deductible. You pay this part first."),
        ("plan_paid", "plan_paid_cents", "Plan paid", "Your plan paid {v}."),
        ("you_owe", "you_owe_cents", "You owe", "You owe {v}."),
    ]
    out: list[ReportStep] = []
    for key, field, label, tmpl in spec:
        if field not in d:
            continue
        plain = tmpl.format(v=_m(d, field))
        if key == "you_owe" and d.get("balance_billing_cents"):
            plain += f" That includes {_m(d, 'balance_billing_cents')} of balance billing."
        if key == "you_owe" and row["kind"] == "copay":
            plain = f"You owe {_m(d, field)}, which is your copay."
        out.append(ReportStep(key=key, label=label, amount=to_dollars(d[field]) or 0.0, plain=plain))  # type: ignore[arg-type]
    return out


def _next_steps(row: dict[str, Any]) -> list[str]:
    d, kind = row["data"], row["kind"]
    out: list[str] = []
    if kind == "claim":
        status = d.get("status", "pending")
        if status == "paid":
            out.append("Nothing to do. Look for the EOB that goes with this claim to see what you owe.")
        elif status == "denied":
            out += ["Read the note on the document to see why the plan did not pay.",
                    "Call your plan or your dentist's office and ask what can be done. You can ask for a review (an appeal).",
                    "Ask the office if the claim can be sent again with more information."]
        else:
            out += ["Nothing to do yet. Reviews can take a few weeks.",
                    "If you have not heard back in a month, call your plan and ask about the claim."]
        if status != "paid":
            out.append(URGENT)
        return out
    owe = d.get("you_owe_cents", 0)
    if owe and row["paid_status"] == "unpaid":
        out.append(f"Pay the {_m(d, 'you_owe_cents')} you owe to your dentist's office, or ask about a payment plan.")
        out.append("Check that your dentist's bill matches this amount before you pay.")
    elif owe:
        out.append("You marked this as paid. Keep it with your records.")
    else:
        out.append("You owe nothing for this visit. Keep it with your records.")
    if d.get("balance_billing_cents"):
        out.append("Ask the office if it can lower the balance, and look for in-network dentists next time.")
    return out


def _balance_note(row: dict[str, Any]) -> str | None:
    d = row["data"]
    if not d.get("balance_billing_cents"):
        return None
    return ("Your dentist is out of network. Your plan paid based on the allowed amount of "
            f"{_m(d, 'allowed_cents')}, and the dentist bills you the difference of "
            f"{_m(d, 'balance_billing_cents')}. This is called balance billing. In-network dentists "
            "agree not to bill you for that difference.")


def explain(row: dict[str, Any]) -> ReportExplanation:
    """The plain-language explanation of one stored document (a row from Store.get_report_item)."""
    return ReportExplanation(
        id=row["id"], kind=row["kind"], title=row["title"], what_it_is=_what_it_is(row),
        lines=_lines(row), steps=_steps(row), what_to_do_next=_next_steps(row),
        balance_billing_note=_balance_note(row),
        lines_add_up=not lines_problems(row["kind"], row["data"]),
        synthetic_notice=SYNTHETIC_NOTICE, disclaimer=DISCLAIMER)
