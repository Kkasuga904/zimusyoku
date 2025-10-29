from __future__ import annotations

import shutil
import threading
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status

from .models import Job, JobCreate, JobDetail, UploadResult
from .repo import Repo

_DEFAULT_RUNNING_DELAY = 0.5
_DEFAULT_COMPLETE_DELAY = 1.5


def _schedule_simulation(repo: Repo, job_id: str) -> None:
    def to_running() -> None:
        try:
            repo.update_status(job_id, "running")
            repo.append_log(job_id, "Job picked up by worker")
        except KeyError:
            return

    def to_ok() -> None:
        try:
            repo.update_status(job_id, "ok")
            repo.append_log(job_id, "Job completed successfully")
        except KeyError:
            return

    threading.Timer(_DEFAULT_RUNNING_DELAY, to_running).start()
    threading.Timer(_DEFAULT_RUNNING_DELAY + _DEFAULT_COMPLETE_DELAY, to_ok).start()


def create_router(repo: Repo) -> APIRouter:
    router = APIRouter()

    @router.post("/jobs", response_model=Job, status_code=status.HTTP_201_CREATED)
    def create_job(payload: JobCreate) -> Job:
        job = repo.create_job(payload.title)
        _schedule_simulation(repo, job.id)
        return job

    @router.get("/jobs", response_model=list[Job])
    def list_jobs(
        limit: int = Query(default=50, ge=1, le=200),
        offset: int = Query(default=0, ge=0),
    ) -> list[Job]:
        return repo.list_jobs(limit=limit, offset=offset)

    @router.get("/jobs/{job_id}", response_model=JobDetail)
    def get_job(job_id: str) -> JobDetail:
        try:
            return repo.get_detail(job_id)
        except KeyError as exc:  # pragma: no cover - defensive guard
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Job not found"
            ) from exc

    @router.post("/uploads", response_model=UploadResult)
    def upload(file: UploadFile = File(...)) -> UploadResult:  # noqa: B008
        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Filename is required",
            )
        target: Path = repo.save_upload(file.filename)
        with target.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        job = repo.create_job(f"process:{file.filename}")
        repo.append_log(job.id, f"Stored upload at {target.name}")
        _schedule_simulation(repo, job.id)
        return UploadResult(job_id=job.id, stored_name=target.name)

    return router


__all__ = ["create_router"]
