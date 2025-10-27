"""Job management routes."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status

from .dependencies import get_current_user_token, get_job_store
from .jobs import JobStore
from .models import JobModel, JobsResponse
from .utils import job_to_model

router = APIRouter(prefix="/api/jobs", tags=["jobs"])

JobStoreDep = Annotated[JobStore, Depends(get_job_store)]
AuthDep = Annotated[str, Depends(get_current_user_token)]


@router.get("", response_model=JobsResponse)
def list_jobs(
    job_store: JobStoreDep,
    _: AuthDep,
) -> JobsResponse:
    jobs = [job_to_model(job) for job in job_store.list_jobs()]
    return JobsResponse(jobs=jobs)


@router.get("/export.csv")
def export_jobs(
    job_store: JobStoreDep,
    _: AuthDep,
) -> Response:
    csv_blob = job_store.export_csv()
    return Response(
        content=csv_blob,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="jobs.csv"'},
    )


@router.get("/{job_id}", response_model=JobModel)
def get_job(
    job_id: str,
    job_store: JobStoreDep,
    _: AuthDep,
) -> JobModel:
    try:
        job = job_store.get_job(job_id)
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found") from None

    return job_to_model(job)
