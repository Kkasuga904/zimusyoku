"""Job persistence helpers."""

from __future__ import annotations

import csv
import json
from collections.abc import Iterable
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from threading import Lock
from typing import Any
from uuid import uuid4

ISO_FORMAT = "%Y-%m-%dT%H:%M:%S.%fZ"


def _now() -> datetime:
    return datetime.utcnow()


def _iso(dt: datetime) -> str:
    return dt.strftime(ISO_FORMAT)


def _parse_datetime(value: str) -> datetime:
    return datetime.strptime(value, ISO_FORMAT)


@dataclass
class Job:
    id: str
    file_name: str
    document_type: str
    status: str
    submitted_at: datetime
    updated_at: datetime
    classification: str | None = None
    ocr_text: str | None = None
    ocr_fields: dict[str, Any] | None = None
    error: str | None = None
    journal_entry: dict[str, Any] | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["submitted_at"] = _iso(self.submitted_at)
        payload["updated_at"] = _iso(self.updated_at)
        return payload

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Job:
        return cls(
            id=data["id"],
            file_name=data["file_name"],
            document_type=data["document_type"],
            status=data["status"],
            submitted_at=_parse_datetime(data["submitted_at"]),
            updated_at=_parse_datetime(data["updated_at"]),
            classification=data.get("classification"),
            ocr_text=data.get("ocr_text"),
            ocr_fields=data.get("ocr_fields"),
            error=data.get("error"),
            journal_entry=data.get("journal_entry"),
            metadata=data.get("metadata") or {},
        )


class JobStore:
    """Lightweight file-backed job store."""

    def __init__(self, path: Path):
        self._path = path
        self._lock = Lock()

    def _load(self) -> list[Job]:
        if not self._path.exists():
            return []
        with self._path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
        return [Job.from_dict(item) for item in data]

    def _dump(self, jobs: Iterable[Job]) -> None:
        items = [job.to_dict() for job in jobs]
        self._path.parent.mkdir(parents=True, exist_ok=True)
        with self._path.open("w", encoding="utf-8") as handle:
            json.dump(items, handle, ensure_ascii=False, indent=2)

    def create_job(self, file_name: str, document_type: str) -> Job:
        with self._lock:
            jobs = self._load()
            job = Job(
                id=f"JOB-{uuid4().hex[:8].upper()}",
                file_name=file_name,
                document_type=document_type,
                status="queued",
                submitted_at=_now(),
                updated_at=_now(),
            )
            jobs.append(job)
            self._dump(jobs)
            return job

    def _update(self, job_id: str, mutate) -> Job:
        with self._lock:
            jobs = self._load()
            for idx, job in enumerate(jobs):
                if job.id == job_id:
                    mutate(job)
                    job.updated_at = _now()
                    jobs[idx] = job
                    self._dump(jobs)
                    return job
        raise KeyError(job_id)

    def update_status(self, job_id: str, status: str, *, error: str | None = None) -> Job:
        def mutate(job: Job) -> None:
            job.status = status
            job.error = error

        return self._update(job_id, mutate)

    def store_result(
        self,
        job_id: str,
        *,
        classification: str | None,
        ocr_text: str | None,
        ocr_fields: dict[str, Any] | None,
        journal_entry: dict[str, Any] | None,
    ) -> Job:
        def mutate(job: Job) -> None:
            job.classification = classification
            job.ocr_text = ocr_text
            job.ocr_fields = ocr_fields
            job.journal_entry = journal_entry

        return self._update(job_id, mutate)

    def set_metadata(self, job_id: str, **metadata: Any) -> Job:
        def mutate(job: Job) -> None:
            job.metadata.update(metadata)

        return self._update(job_id, mutate)

    def list_jobs(self) -> list[Job]:
        with self._lock:
            return sorted(self._load(), key=lambda job: job.submitted_at, reverse=True)

    def get_job(self, job_id: str) -> Job:
        with self._lock:
            for job in self._load():
                if job.id == job_id:
                    return job
        raise KeyError(job_id)

    def export_csv(self) -> str:
        """Return CSV string of completed jobs."""
        jobs = self.list_jobs()
        fieldnames = [
            "id",
            "file_name",
            "document_type",
            "status",
            "classification",
            "amount",
            "tax",
            "vendor",
            "submitted_at",
            "updated_at",
        ]
        from io import StringIO

        buffer = StringIO()
        writer = csv.DictWriter(buffer, fieldnames=fieldnames)
        writer.writeheader()
        for job in jobs:
            entry = job.journal_entry or {}
            writer.writerow(
                {
                    "id": job.id,
                    "file_name": job.file_name,
                    "document_type": job.document_type,
                    "status": job.status,
                    "classification": job.classification or "",
                    "amount": entry.get("amount_gross", ""),
                    "tax": entry.get("tax", ""),
                    "vendor": entry.get("vendor", ""),
                    "submitted_at": _iso(job.submitted_at),
                    "updated_at": _iso(job.updated_at),
                }
            )
        return buffer.getvalue()
