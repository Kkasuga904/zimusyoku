"""Stub client mimicking the Freee accounting API."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any


@dataclass(slots=True)
class OAuthToken:
    access_token: str
    refresh_token: str
    expires_at: datetime

    def to_dict(self) -> dict[str, Any]:
        return {
            "access_token": self.access_token,
            "refresh_token": self.refresh_token,
            "expires_at": self.expires_at.isoformat(),
        }

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> OAuthToken:
        return cls(
            access_token=payload["access_token"],
            refresh_token=payload["refresh_token"],
            expires_at=datetime.fromisoformat(payload["expires_at"]),
        )


class FreeeAPIClient:
    """Mocked client that persists OAuth tokens and journal entry payloads."""

    def __init__(self, base_dir: Path):
        self._base_dir = base_dir
        self._base_dir.mkdir(parents=True, exist_ok=True)
        self._token_path = self._base_dir / "freee_token.json"
        self._journal_path = self._base_dir / "freee_journal_entries.json"

    def _generate_token(self) -> OAuthToken:
        seed = os.environ.get("FREEE_API_KEY", "freee-dev")
        access_token = f"{seed}-access"
        refresh_token = f"{seed}-refresh"
        expires_at = datetime.utcnow() + timedelta(hours=2)
        token = OAuthToken(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_at=expires_at,
        )
        self.save_token(token)
        return token

    def load_token(self) -> OAuthToken:
        if not self._token_path.exists():
            return self._generate_token()
        payload = json.loads(self._token_path.read_text(encoding="utf-8"))
        token = OAuthToken.from_dict(payload)
        if token.expires_at <= datetime.utcnow():
            return self.refresh_token(token.refresh_token)
        return token

    def save_token(self, token: OAuthToken) -> None:
        self._token_path.write_text(
            json.dumps(token.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8"
        )

    def refresh_token(self, refresh_token: str) -> OAuthToken:
        # We don't validate refresh tokens in the stub, simply issue a new pair.
        new_token = OAuthToken(
            access_token=f"{refresh_token}-new",
            refresh_token=refresh_token,
            expires_at=datetime.utcnow() + timedelta(hours=2),
        )
        self.save_token(new_token)
        return new_token

    def post_journal_entry(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Persist payload into a ledger file and return a stub response."""
        entries = []
        if self._journal_path.exists():
            entries = json.loads(self._journal_path.read_text(encoding="utf-8"))
        entry_id = f"freee-{len(entries) + 1:05d}"
        record = {
            "id": entry_id,
            "payload": payload,
            "posted_at": datetime.utcnow().isoformat(),
        }
        entries.append(record)
        self._journal_path.write_text(
            json.dumps(entries, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        return {"id": entry_id, "status": "queued"}


__all__ = ["FreeeAPIClient", "OAuthToken"]
