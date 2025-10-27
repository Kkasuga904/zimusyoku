"""Classification heuristics for journal entries."""

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any

CATEGORY_KEYWORDS: Mapping[str, str] = {
    "交通": "\u4ea4\u901a\u8cbb",
    "train": "\u4ea4\u901a\u8cbb",
    "transport": "\u4ea4\u901a\u8cbb",
    "traffic": "\u4ea4\u901a\u8cbb",
    "taxi": "\u4ea4\u901a\u8cbb",
    "travel": "\u65c5\u8cbb\u4ea4\u901a\u8cbb",
    "hotel": "\u65c5\u8cbb\u4ea4\u901a\u8cbb",
    "通信": "\u901a\u4fe1\u8cbb",
    "network": "\u901a\u4fe1\u8cbb",
    "phone": "\u901a\u4fe1\u8cbb",
    "internet": "\u901a\u4fe1\u8cbb",
    "software": "\u30bd\u30d5\u30c8\u30a6\u30a7\u30a2",
    "subscription": "\u30bd\u30d5\u30c8\u30a6\u30a7\u30a2",
    "office": "\u4e8b\u52d9\u7528\u54c1\u8cbb",
    "stationery": "\u4e8b\u52d9\u7528\u54c1\u8cbb",
    "consulting": "\u5916\u6ce8\u8cbb",
}

ACCOUNT_BY_CATEGORY: Mapping[str, str] = {
    "\u4ea4\u901a\u8cbb": "\u65c5\u8cbb\u4ea4\u901a\u8cbb",
    "\u65c5\u8cbb\u4ea4\u901a\u8cbb": "\u65c5\u8cbb\u4ea4\u901a\u8cbb",
    "\u901a\u4fe1\u8cbb": "\u901a\u4fe1\u8cbb",
    "\u30bd\u30d5\u30c8\u30a6\u30a7\u30a2": "\u30bd\u30d5\u30c8\u30a6\u30a7\u30a2\u4f7f\u7528\u6599",
    "\u4e8b\u52d9\u7528\u54c1\u8cbb": "\u6d88\u8017\u54c1\u8cbb",
    "\u5916\u6ce8\u8cbb": "\u5916\u6ce8\u8cbb",
}


def _normalize(text: str) -> str:
    return text.lower()


def infer_category(text: str, explicit: str | None = None) -> str:
    if explicit:
        return explicit

    normalized = _normalize(text)
    for keyword, category in CATEGORY_KEYWORDS.items():
        if keyword in normalized:
            return category
    return "\u305d\u306e\u4ed6\u7d4c\u8cbb"


AMOUNT_REGEX = re.compile(r"amount[^\d]*(\d[\d,]*\.?\d*)", re.IGNORECASE)


def classify_document(
    *,
    text: str,
    fields: Mapping[str, Any],
    document_type: str,
) -> dict[str, Any]:
    """Return structured classification output expected by accounting pipeline."""
    vendor = fields.get("vendor") or ""
    category = infer_category(text, explicit=fields.get("category"))
    account = ACCOUNT_BY_CATEGORY.get(category, "\u305d\u306e\u4ed6\u7d4c\u8cbb")

    raw_amount = fields.get("amount")
    if raw_amount is None:
        amount_match = AMOUNT_REGEX.search(text)
        if amount_match:
            raw_amount = amount_match.group(1)
    amount = float(str(raw_amount).replace(",", "")) if raw_amount else 0.0

    tax_value = fields.get("tax")
    if tax_value is None and amount:
        tax_value = round(amount * 0.1, 2)
    tax = float(tax_value or 0.0)
    net = round(amount - tax, 2) if amount else 0.0

    memo = f"{document_type.capitalize()} - {vendor}".strip(" -")

    return {
        "vendor": vendor or "\u4e0d\u660e",
        "category": category,
        "account": account,
        "memo": memo,
        "amount_gross": amount,
        "amount_net": net if net >= 0 else amount,
        "tax": tax,
    }
