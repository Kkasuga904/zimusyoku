"""Classification heuristics for journal entries."""

from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
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
    "弁当": "会議費",
    "lunch": "会議費",
}

ACCOUNT_BY_CATEGORY: Mapping[str, str] = {
    "交通費": "旅費交通費",
    "旅費交通費": "旅費交通費",
    "通信費": "通信費",
    "ソフトウェア": "ソフトウェア使用料",
    "事務用品費": "消耗品費",
    "外注費": "外注費",
    "会議費": "会議費",
    "その他経費": "雑費",
}

CREDIT_BY_DOCUMENT_TYPE: Mapping[str, str] = {
    "invoice": "未払金",
    "receipt": "現金",
    "estimate": "未払金",
}

TAX_ACCOUNT = "仮払消費税等"


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


def _coerce_float(value: Any) -> float | None:
    if value in (None, "", 0):
        return None
    if isinstance(value, int | float):
        return float(value)
    as_str = str(value).strip()
    if not as_str:
        return None
    cleaned = (
        as_str.replace(",", "").replace("¥", "").replace("￥", "").replace("円", "")
    )
    cleaned = cleaned.replace("−", "-")
    try:
        return float(cleaned)
    except ValueError:
        return None


def _sum_line_items(items: Sequence[Mapping[str, Any]]) -> float | None:
    amounts = [
        _coerce_float(item.get("amount"))
        for item in items
        if item.get("amount") is not None
    ]
    clean_amounts = [amt for amt in amounts if amt is not None]
    if not clean_amounts:
        return None
    return float(sum(clean_amounts))


AMOUNT_REGEX = re.compile(
    r"(?:amount|total|sum|invoice|合計|金額|請求)[^\d]*(\d[\d,]*\.?\d*)", re.IGNORECASE
)
CURRENCY_AMOUNT_REGEX = re.compile(r"[¥￥]\s*(\d[\d,]*\.?\d*)")


def build_journal_lines(classification: Mapping[str, Any]) -> list[dict[str, Any]]:
    """Return journal lines for the given classification payload."""
    amount = (
        _coerce_float(
            classification.get("amount")
            or classification.get("amount_gross")
            or classification.get("gross_amount")
        )
        or 0.0
    )
    net = _coerce_float(
        classification.get("net_amount")
        or classification.get("amount_net")
        or classification.get("net")
    ) or max(amount - (_coerce_float(classification.get("tax")) or 0.0), 0.0)
    tax_value = _coerce_float(classification.get("tax")) or 0.0
    debit_account = (
        classification.get("debit_account")
        or classification.get("account")
        or ACCOUNT_BY_CATEGORY["その他経費"]
    )
    credit_account = classification.get(
        "credit_account"
    ) or CREDIT_BY_DOCUMENT_TYPE.get(
        classification.get("document_type", "invoice"), "未払金"
    )
    description = classification.get("description") or classification.get("memo")

    lines: list[dict[str, Any]] = []
    if net:
        lines.append(
            {
                "account": debit_account,
                "debit": round(net, 2),
                "credit": 0.0,
                "description": description,
            }
        )
    if tax_value:
        lines.append(
            {
                "account": classification.get("tax_account") or TAX_ACCOUNT,
                "debit": round(tax_value, 2),
                "credit": 0.0,
                "description": "消費税",
            }
        )
    if amount:
        lines.append(
            {
                "account": credit_account,
                "debit": 0.0,
                "credit": round(amount, 2),
                "description": description,
            }
        )
    return lines


def classify_document(
    *,
    text: str,
    fields: Mapping[str, Any],
    document_type: str,
) -> dict[str, Any]:
    """Return structured classification output expected by accounting pipeline."""
    vendor = str(fields.get("vendor") or "").strip()
    category = infer_category(text, explicit=fields.get("category"))
    debit_account = ACCOUNT_BY_CATEGORY.get(category, ACCOUNT_BY_CATEGORY["その他経費"])
    credit_account = CREDIT_BY_DOCUMENT_TYPE.get(document_type, "未払金")

    totals = fields.get("totals") if isinstance(fields.get("totals"), Mapping) else {}
    amount_value = _coerce_float(fields.get("amount"))
    if amount_value is None and totals:
        amount_value = _coerce_float(totals.get("total"))
    if amount_value is None:
        line_items = fields.get("line_items")
        if isinstance(line_items, Sequence):
            amount_value = _sum_line_items(line_items)
    if amount_value is None:
        amount_match = AMOUNT_REGEX.search(text)
        if not amount_match:
            amount_match = CURRENCY_AMOUNT_REGEX.search(text)
        if amount_match:
            amount_value = _coerce_float(amount_match.group(1))
    amount_value = float(amount_value or 0.0)

    tax_raw = fields.get("tax")
    if tax_raw is None and totals:
        tax_raw = totals.get("tax")
    tax_value = _coerce_float(tax_raw)
    if tax_value is None and amount_value:
        tax_value = round(amount_value * 0.1, 2)
    tax_value = float(tax_value or 0.0)
    net = round(amount_value - tax_value, 2) if amount_value else 0.0

    description_parts = []
    if vendor:
        description_parts.append(vendor)
    primary_item = None
    if isinstance(fields.get("line_items"), Sequence) and fields["line_items"]:
        first_item = fields["line_items"][0]
        primary_item = first_item.get("description")
        if primary_item:
            description_parts.append(str(primary_item))
    if fields.get("issue_date"):
        description_parts.append(str(fields.get("issue_date")))
    description = (
        " / ".join(description_parts)
        if description_parts
        else f"{category} ({document_type})"
    )

    debit_net = round(max(net, 0.0), 2)
    confidence = 0.6
    if vendor and primary_item:
        confidence = 0.85

    memo = description

    journal_lines = build_journal_lines(
        {
            "amount": amount_value,
            "net_amount": debit_net,
            "tax": tax_value,
            "debit_account": debit_account,
            "credit_account": credit_account,
            "tax_account": TAX_ACCOUNT if tax_value else None,
            "description": description,
            "memo": memo,
            "document_type": document_type,
        }
    )

    return {
        "vendor": vendor or "不明",
        "category": category,
        "description": description,
        "line_items": list(fields.get("line_items") or []),
        "amount": amount_value,
        "tax": tax_value,
        "net_amount": debit_net if debit_net >= 0 else amount_value,
        "debit_account": debit_account,
        "credit_account": credit_account,
        "tax_account": TAX_ACCOUNT if tax_value else None,
        "journal_lines": journal_lines,
        "confidence": confidence,
        # Legacy keys used elsewhere in the pipeline
        "account": debit_account,
        "memo": memo,
        "amount_gross": amount_value,
        "amount_net": debit_net if debit_net >= 0 else amount_value,
    }
