from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from threading import Lock
from typing import Any
from uuid import uuid4

from .models import Job, JobDetail, JobStatus


class Repo:
    """Minimal JSON-backed repository for job state and uploads."""

    def __init__(self, base_dir: Path | str):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.jobs_file = self.base_dir / "jobs.json"
        self.upload_dir = self.base_dir / "uploads"
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self._lock = Lock()
        if not self.jobs_file.exists():
            self.jobs_file.write_text("[]", encoding="utf-8")

    def _load_jobs(self) -> list[dict[str, Any]]:
        raw = self.jobs_file.read_text(encoding="utf-8") or "[]"
        return json.loads(raw)

    def _save_jobs(self, jobs: list[dict[str, Any]]) -> None:
        self.jobs_file.write_text(
            json.dumps(jobs, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    def _now(self) -> str:
        return datetime.now(UTC).isoformat()

    def _to_job(self, payload: dict[str, Any]) -> Job:
        filtered = {key: payload.get(key) for key in Job.model_fields.keys()}
        return Job.model_validate(filtered)

    def _to_detail(self, payload: dict[str, Any]) -> JobDetail:
        relevant = {key: payload.get(key) for key in JobDetail.model_fields.keys()}
        return JobDetail.model_validate(relevant)

    def _find(self, jobs: list[dict[str, Any]], job_id: str) -> dict[str, Any]:
        for item in jobs:
            if item["id"] == job_id:
                return item
        raise KeyError(job_id)

    def create_job(self, title: str) -> Job:
        timestamp = self._now()
        record = {
            "id": str(uuid4()),
            "title": title,
            "status": "queued",
            "created_at": timestamp,
            "updated_at": timestamp,
            "started_at": None,
            "finished_at": None,
            "logs": [f"{timestamp} Job queued"],
        }
        with self._lock:
            jobs = self._load_jobs()
            jobs.insert(0, record)
            self._save_jobs(jobs)
        return self._to_job(record)

    def list_jobs(self, limit: int, offset: int) -> list[Job]:
        with self._lock:
            jobs = sorted(
                self._load_jobs(), key=lambda item: item["created_at"], reverse=True
            )
        sliced = jobs[offset : offset + limit]
        return [self._to_job(item) for item in sliced]

    def get_detail(self, job_id: str) -> JobDetail:
        with self._lock:
            jobs = self._load_jobs()
            record = self._find(jobs, job_id)
            return self._to_detail(record)

    def update_status(self, job_id: str, status: JobStatus) -> None:
        timestamp = self._now()
        with self._lock:
            jobs = self._load_jobs()
            record = self._find(jobs, job_id)
            record["status"] = status
            record["updated_at"] = timestamp
            if status == "running" and record.get("started_at") is None:
                record["started_at"] = timestamp
            if status in {"ok", "failed"}:
                record["finished_at"] = timestamp
            self._save_jobs(jobs)

    def append_log(self, job_id: str, message: str) -> None:
        timestamp = self._now()
        with self._lock:
            jobs = self._load_jobs()
            record = self._find(jobs, job_id)
            record.setdefault("logs", []).append(f"{timestamp} {message}")
            record["updated_at"] = timestamp
            self._save_jobs(jobs)

    def save_upload(self, filename: str) -> Path:
        safe_name = Path(filename).name or "upload.bin"
        stored_name = f"{uuid4().hex}_{safe_name}"
        target = self.upload_dir / stored_name
        target.parent.mkdir(parents=True, exist_ok=True)
        return target
