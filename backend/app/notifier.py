"""Delivery of notifications outside the app (email and text).

NOTHING IS EVER SENT. The default `PreviewNotifier` only writes a row to the `outbox` table with
status 'preview', so the app can show "Email preview, not sent". The database locks the status to
'preview' with a CHECK constraint.

Where a real sender plugs in later:
1. Write a class with the same `deliver` method (for example `SesNotifier` using Amazon SES, or
   `TwilioNotifier` using Twilio). It receives an `OutboundMessage` and returns the outbox row.
2. Add a migration that widens `outbox.status` (for example 'queued', 'sent', 'failed') and any
   provider message id column.
3. Return that class from `get_notifier()` when its credentials are set in the environment
   (keys only in `.env`, never in code). Keep `PreviewNotifier` as the default and for tests.
Real contact details and consent (opt-in, unsubscribe) must be handled before step 3.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

from .db import Store


@dataclass(frozen=True)
class OutboundMessage:
    member_id: str
    channel: str                 # "email" or "sms"
    to_address: str              # the member's stored email or phone
    subject: str | None
    body: str


class Notifier(Protocol):
    def deliver(self, message: OutboundMessage) -> dict[str, Any]:
        """Hand one message to a delivery channel and return its outbox row."""
        ...


class PreviewNotifier:
    """Writes an outbox row with status 'preview'. Never sends anything."""

    def __init__(self, store: Store) -> None:
        self.store = store

    def deliver(self, message: OutboundMessage) -> dict[str, Any]:
        return self.store.add_outbox(message.member_id, message.channel, message.to_address,
                                     message.subject, message.body)


def get_notifier(store: Store) -> Notifier:
    """The notifier the app uses. Always the preview notifier today."""
    return PreviewNotifier(store)
