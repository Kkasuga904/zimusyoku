"""Utility functions for cleaning extracted tables."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass


@dataclass(frozen=True)
class NormalizedRow:
    """Materialized, normalized row payload with canonical keys."""

    account: str
    amount: float
    currency: str


def normalize_record(record: Mapping[str, object]) -> NormalizedRow:
    """Normalize raw row dictionaries from the extractor.

    Ensures canonical field names, strips surrounding whitespace, and
    coerces numeric fields to floats while guarding against missing data.
    """

    if "account" not in record and "acct" not in record:
        raise KeyError("record missing account/acct field")

    account = str(record.get("account") or record.get("acct")).strip()
    if not account:
        raise ValueError("account identifier is empty")

    raw_amount = record.get("amount") or record.get("amt")
    if raw_amount is None:
        raise KeyError("record missing amount/amt field")

    try:
        amount = float(raw_amount)
    except (TypeError, ValueError) as exc:  # pragma: no cover - defensive
        raise ValueError("amount is not numeric") from exc

    currency = str(record.get("currency", "USD")).strip().upper() or "USD"

    return NormalizedRow(account=account, amount=amount, currency=currency)


def batch_normalize(records: Iterable[Mapping[str, object]]) -> list[NormalizedRow]:
    """Normalize a collection of rows, discarding duplicates by account."""

    seen: dict[str, NormalizedRow] = {}
    for record in records:
        normalized = normalize_record(record)
        seen[normalized.account] = normalized
    return list(seen.values())

