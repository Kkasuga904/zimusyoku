"""Accounting integration stubs."""

from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

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

    entry = {
        "job_id": job_id,
        "vendor": classification["vendor"],
        "account": classification["account"],
        "category": classification["category"],
        "memo": classification["memo"],
        "amount_gross": classification["amount_gross"],
        "amount_net": classification["amount_net"],
        "tax": classification["tax"],
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
        }

    first_entry = datetime.fromisoformat(entries[0]["recorded_at"].replace("Z", ""))
    month_key = first_entry.strftime("%Y-%m")

    total = 0.0
    bucket_totals: defaultdict[str, float] = defaultdict(float)

    for entry in entries:
        amount = float(entry.get("amount_gross") or 0.0)
        total += amount
        bucket_totals[entry["category"]] += amount

    breakdown = [
        {"label": category, "amount": round(value, 2)}
        for category, value in sorted(bucket_totals.items(), key=lambda item: item[1], reverse=True)
    ]

    return {
        "month": month_key,
        "total_spend": round(total, 2),
        "journal_count": len(entries),
        "breakdown": breakdown,
    }
