from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

JobStatus = Literal["queued", "running", "ok", "failed"]


class JobBase(BaseModel):
    id: str
    title: str
    status: JobStatus
    created_at: datetime
    updated_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None


class Job(JobBase):
    """Summary view returned by job listing."""


class JobDetail(JobBase):
    logs: list[str] = Field(default_factory=list)


class JobCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)


class UploadResult(BaseModel):
    job_id: str
    stored_name: str
