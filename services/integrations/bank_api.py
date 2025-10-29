"""Bank API stub for simulating payment execution."""

from __future__ import annotations

import json
from collections.abc import Iterable, Sequence
from datetime import datetime
from pathlib import Path
from typing import Any


class BankAPIClient:
    """Persist payment requests to a local log to mimic bank transfers."""

    def __init__(self, base_dir: Path):
        self._base_dir = base_dir
        self._base_dir.mkdir(parents=True, exist_ok=True)
        self._payments_path = self._base_dir / "bank_payments.json"

    def _write(self, records: Sequence[dict[str, Any]]) -> None:
        self._payments_path.write_text(
            json.dumps(list(records), ensure_ascii=False, indent=2), encoding="utf-8"
        )

    def execute_payments(self, payments: Iterable[dict[str, Any]]) -> dict[str, Any]:
        """Append payment requests to the ledger and return a receipt."""
        existing = []
        if self._payments_path.exists():
            existing = json.loads(self._payments_path.read_text(encoding="utf-8"))
        batch_id = f"batch-{len(existing) + 1:05d}"
        timestamp = datetime.utcnow().isoformat()
        payload = {
            "id": batch_id,
            "requested_at": timestamp,
            "payments": list(payments),
        }
        existing.append(payload)
        self._write(existing)
        return {"batch_id": batch_id, "status": "processed", "requested_at": timestamp}


__all__ = ["BankAPIClient"]
