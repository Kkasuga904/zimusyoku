"""Persistence helpers for the approvals workflow."""

from __future__ import annotations

import json
from collections.abc import Iterable
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from threading import Lock
from typing import Any

ISO_FORMAT = "%Y-%m-%dT%H:%M:%SZ"


def _now() -> datetime:
    return datetime.utcnow()


def _iso(dt: datetime) -> str:
    return dt.strftime(ISO_FORMAT)


@dataclass
class ApprovalEvent:
    action: str
    actor: str
    recorded_at: datetime
    note: str | None = None

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["recorded_at"] = _iso(self.recorded_at)
        return payload

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ApprovalEvent:
        recorded_at = datetime.strptime(data["recorded_at"], ISO_FORMAT)
        return cls(
            action=data["action"],
            actor=data["actor"],
            recorded_at=recorded_at,
            note=data.get("note"),
        )


@dataclass
class ApprovalRecord:
    job_id: str
    status: str = "pending"
    updated_at: datetime = field(default_factory=_now)
    history: list[ApprovalEvent] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "job_id": self.job_id,
            "status": self.status,
            "updated_at": _iso(self.updated_at),
            "history": [event.to_dict() for event in self.history],
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ApprovalRecord:
        history = [ApprovalEvent.from_dict(item) for item in data.get("history", [])]
        updated_at = datetime.strptime(data["updated_at"], ISO_FORMAT)
        return cls(
            job_id=data["job_id"],
            status=data["status"],
            updated_at=updated_at,
            history=history,
        )

    def append(self, event: ApprovalEvent) -> None:
        self.history.append(event)
        self.status = event.action
        self.updated_at = event.recorded_at


class ApprovalStore:
    """Thread-safe file backed storage for approvals."""

    def __init__(self, path: Path):
        self._path = path
        self._lock = Lock()

    def _load(self) -> list[ApprovalRecord]:
        if not self._path.exists():
            return []
        with self._path.open("r", encoding="utf-8") as handle:
            items = json.load(handle)
        return [ApprovalRecord.from_dict(item) for item in items]

    def _dump(self, records: Iterable[ApprovalRecord]) -> None:
        payload = [record.to_dict() for record in records]
        self._path.parent.mkdir(parents=True, exist_ok=True)
        with self._path.open("w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)

    def _upsert(self, job_id: str, mutate) -> ApprovalRecord:
        with self._lock:
            records = self._load()
            for index, record in enumerate(records):
                if record.job_id == job_id:
                    mutate(record)
                    records[index] = record
                    self._dump(records)
                    return record
            record = ApprovalRecord(job_id=job_id)
            mutate(record)
            records.append(record)
            self._dump(records)
            return record

    def record(
        self, job_id: str, *, actor: str, action: str, note: str | None = None
    ) -> ApprovalRecord:
        if action not in {"approved", "rejected", "pending"}:
            raise ValueError(f"Unsupported approval action: {action}")

        def mutate(record: ApprovalRecord) -> None:
            event = ApprovalEvent(
                action=action, actor=actor, recorded_at=_now(), note=note
            )
            record.append(event)

        return self._upsert(job_id, mutate)

    def get(self, job_id: str) -> ApprovalRecord:
        with self._lock:
            for record in self._load():
                if record.job_id == job_id:
                    return record
        raise KeyError(job_id)

    def get_status(self, job_id: str) -> str:
        try:
            record = self.get(job_id)
            return record.status
        except KeyError:
            return "pending"

    def list_all(self) -> list[ApprovalRecord]:
        with self._lock:
            records = self._load()
        return sorted(records, key=lambda rec: rec.updated_at, reverse=True)
