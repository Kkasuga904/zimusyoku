"""Accounting integration stubs."""

from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

from services.api.approvals import ApprovalStore
from services.api.config import get_settings

settings = get_settings()


def _load_entries(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _dump_entries(path: Path, entries: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(entries, handle, ensure_ascii=False, indent=2, default=str)


def post_journal_entry(
    *,
    ocr_fields: dict[str, Any],
    classification: dict[str, Any],
    document_type: str,
    job_id: str,
) -> dict[str, Any]:
    """Persist a journal entry and mimic posting to accounting SaaS."""
    recorded_at = datetime.utcnow().isoformat(timespec="seconds") + "Z"

    journal_lines = classification.get("journal_lines") or []
    if not journal_lines:
        amount = float(
            classification.get("amount") or classification.get("amount_gross") or 0.0
        )
        net = float(
            classification.get("net_amount")
            or classification.get("amount_net")
            or amount
        )
        tax = float(classification.get("tax") or 0.0)
        debit_account = (
            classification.get("debit_account")
            or classification.get("account")
            or "雑費"
        )
        credit_account = classification.get("credit_account") or "未払金"
        if net:
            journal_lines.append(
                {
                    "account": debit_account,
                    "debit": round(net, 2),
                    "credit": 0.0,
                    "description": classification.get("description"),
                }
            )
        if tax:
            journal_lines.append(
                {
                    "account": classification.get("tax_account") or "仮払消費税等",
                    "debit": round(tax, 2),
                    "credit": 0.0,
                    "description": "消費税",
                }
            )
        if amount:
            journal_lines.append(
                {
                    "account": credit_account,
                    "debit": 0.0,
                    "credit": round(amount, 2),
                    "description": classification.get("description"),
                }
            )

    entry = {
        "job_id": job_id,
        "vendor": classification["vendor"],
        "account": classification["account"],
        "category": classification["category"],
        "description": classification.get("description") or classification.get("memo"),
        "memo": classification["memo"],
        "amount": classification.get("amount") or classification.get("amount_gross"),
        "amount_gross": classification["amount_gross"],
        "amount_net": classification["amount_net"],
        "tax": classification["tax"],
        "debit_account": classification.get("debit_account"),
        "credit_account": classification.get("credit_account"),
        "tax_account": classification.get("tax_account"),
        "journal_lines": journal_lines,
        "currency": "JPY",
        "document_type": document_type,
        "ocr_fields": ocr_fields,
        "recorded_at": recorded_at,
    }

    entries = _load_entries(settings.journal_path)
    entries.append(entry)
    _dump_entries(settings.journal_path, entries)
    return entry


def read_journal_entries() -> list[dict[str, Any]]:
    return _load_entries(settings.journal_path)


def compute_summary() -> dict[str, Any]:
    entries = read_journal_entries()
    if not entries:
        current_month = datetime.utcnow().strftime("%Y-%m")
        return {
            "month": current_month,
            "total_spend": 0.0,
            "journal_count": 0,
            "breakdown": [],
            "category_ratios": [],
            "approval_rate": 0.0,
            "monthly_totals": [],
            "top_accounts": [],
        }

    first_entry = datetime.fromisoformat(entries[0]["recorded_at"].replace("Z", ""))
    month_key = first_entry.strftime("%Y-%m")

    total = 0.0
    bucket_totals: defaultdict[str, float] = defaultdict(float)
    account_totals: defaultdict[str, float] = defaultdict(float)
    monthly_totals: defaultdict[str, float] = defaultdict(float)

    for entry in entries:
        amount = float(entry.get("amount") or entry.get("amount_gross") or 0.0)
        total += amount
        category = entry.get("category") or "不明"
        bucket_totals[category] += amount
        account = entry.get("debit_account") or entry.get("account") or "雑費"
        account_totals[account] += amount
        recorded = datetime.fromisoformat(entry.get("recorded_at", "").replace("Z", ""))
        month = recorded.strftime("%Y-%m")
        monthly_totals[month] += amount

    breakdown = [
        {"label": category, "amount": round(value, 2)}
        for category, value in sorted(
            bucket_totals.items(), key=lambda item: item[1], reverse=True
        )
    ]
    category_ratios = [
        {"label": category, "ratio": round(value / total, 4) if total else 0.0}
        for category, value in sorted(
            bucket_totals.items(), key=lambda item: item[1], reverse=True
        )
    ]
    monthly_data = [
        {"month": month, "total": round(value, 2)}
        for month, value in sorted(monthly_totals.items())
    ]
    top_accounts = [
        {"account": account, "amount": round(value, 2)}
        for account, value in sorted(
            account_totals.items(), key=lambda item: item[1], reverse=True
        )[:5]
    ]

    approval_rate = 0.0
    try:
        approvals = ApprovalStore(settings.approvals_path).list_all()
    except Exception:
        approvals = []
    if approvals:
        approved = sum(1 for record in approvals if record.status == "approved")
        approval_rate = round(approved / len(approvals), 4)

    return {
        "month": month_key,
        "total_spend": round(total, 2),
        "journal_count": len(entries),
        "breakdown": breakdown,
        "category_ratios": category_ratios,
        "approval_rate": approval_rate,
        "monthly_totals": monthly_data,
        "top_accounts": top_accounts,
    }
