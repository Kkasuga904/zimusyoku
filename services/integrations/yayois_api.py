"""Stub client representing Yayoi's accounting SaaS API."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any


@dataclass(slots=True)
class YayoiToken:
    token: str
    issued_at: datetime

    def to_dict(self) -> dict[str, Any]:
        return {"token": self.token, "issued_at": self.issued_at.isoformat()}

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> YayoiToken:
        return cls(
            token=payload["token"],
            issued_at=datetime.fromisoformat(payload["issued_at"]),
        )


class YayoiSaaSClient:
    """Lightweight persistence layer for mocked Yayoi integration."""

    def __init__(self, base_dir: Path):
        self._base_dir = base_dir
        self._base_dir.mkdir(parents=True, exist_ok=True)
        self._token_path = self._base_dir / "yayoi_token.json"
        self._ledger_path = self._base_dir / "yayoi_ledger.json"

    def _write(self, path: Path, payload: Any) -> None:
        path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    def ensure_token(self) -> YayoiToken:
        if self._token_path.exists():
            data = json.loads(self._token_path.read_text(encoding="utf-8"))
            return YayoiToken.from_dict(data)
        token = YayoiToken(token="yayoi-demo-token", issued_at=datetime.utcnow())
        self._write(self._token_path, token.to_dict())
        return token

    def post_journal_entry(self, payload: dict[str, Any]) -> dict[str, Any]:
        entries = []
        if self._ledger_path.exists():
            entries = json.loads(self._ledger_path.read_text(encoding="utf-8"))
        entry_id = f"yayoi-{len(entries) + 1:05d}"
        entries.append(
            {
                "id": entry_id,
                "payload": payload,
                "posted_at": datetime.utcnow().isoformat(),
            }
        )
        self._write(self._ledger_path, entries)
        return {"id": entry_id, "status": "accepted"}


__all__ = ["YayoiSaaSClient", "YayoiToken"]
