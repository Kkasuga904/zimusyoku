"""Classification heuristics for journal entries."""

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any

CATEGORY_KEYWORDS: Mapping[str, str] = {
    "交通": "交通費",
    "train": "交通費",
    "transport": "交通費",
    "traffic": "交通費",
    "taxi": "交通費",
    "travel": "旅費交通費",
    "hotel": "旅費交通費",
    "通信": "通信費",
    "network": "通信費",
    "phone": "通信費",
    "internet": "通信費",
    "software": "ソフトウェア",
    "subscription": "ソフトウェア",
    "office": "事務用品費",
    "stationery": "事務用品費",
    "consulting": "外注費",
}

ACCOUNT_BY_CATEGORY: Mapping[str, str] = {
    "交通費": "旅費交通費",
    "旅費交通費": "旅費交通費",
    "通信費": "通信費",
    "ソフトウェア": "ソフトウェア使用料",
    "事務用品費": "消耗品費",
    "外注費": "外注費",
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
    return "その他経費"


AMOUNT_REGEX = re.compile(r"(?:amount|total|sum|invoice|合計|金額|請求)[^\d]*(\d[\d,]*\.?\d*)", re.IGNORECASE)
CURRENCY_AMOUNT_REGEX = re.compile(r"[¥￥]\s*(\d[\d,]*\.?\d*)")


def classify_document(
    *,
    text: str,
    fields: Mapping[str, Any],
    document_type: str,
) -> dict[str, Any]:
    """Return structured classification output expected by accounting pipeline."""
    vendor = fields.get("vendor") or ""
    category = infer_category(text, explicit=fields.get("category"))
    account = ACCOUNT_BY_CATEGORY.get(category, "その他経費")

    raw_amount = fields.get("amount")
    if raw_amount in (None, "", 0):
        amount_match = AMOUNT_REGEX.search(text)
        if not amount_match:
            amount_match = CURRENCY_AMOUNT_REGEX.search(text)
        if amount_match:
            raw_amount = amount_match.group(1)
    amount_value = float(str(raw_amount).replace(",", "")) if raw_amount not in (None, "") else 0.0

    tax_value = fields.get("tax")
    if tax_value in (None, "", 0) and amount_value:
        tax_value = round(amount_value * 0.1, 2)
    tax = float(tax_value or 0.0)
    net = round(amount_value - tax, 2) if amount_value else 0.0

    memo = f"{document_type.capitalize()} - {vendor}".strip(" -")

    return {
        "vendor": vendor or "不明",
        "category": category,
        "account": account,
        "memo": memo,
        "amount_gross": amount_value,
        "amount_net": net if net >= 0 else amount_value,
        "tax": tax,
    }
