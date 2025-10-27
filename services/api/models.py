<<<<<<< HEAD
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
=======
"""Pydantic models shared by API routes."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class OCRFields(BaseModel):
    vendor: str | None = None
    date: str | None = None
    amount: float | None = None
    tax: float | None = None
    category: str | None = None


class OCRResultModel(BaseModel):
    text: str
    fields: OCRFields


class JournalEntryModel(BaseModel):
    vendor: str
    account: str
    memo: str
    amount_gross: float
    amount_net: float
    tax: float
    currency: str = "JPY"
    document_type: str
    recorded_at: datetime


class JobModel(BaseModel):
    id: str
    file_name: str = Field(..., alias="fileName")
    document_type: str = Field(..., alias="documentType")
    status: str
    classification: str | None = None
    submitted_at: datetime = Field(..., alias="submittedAt")
    updated_at: datetime = Field(..., alias="updatedAt")
    error: str | None = None

    ocr: OCRResultModel | None = None
    journal_entry: JournalEntryModel | None = Field(None, alias="journalEntry")

    class Config:
        allow_population_by_field_name = True


class UploadResponse(BaseModel):
    job: JobModel


class JobsResponse(BaseModel):
    jobs: list[JobModel]


class SummaryBucket(BaseModel):
    label: str
    amount: float


class SummaryResponse(BaseModel):
    month: str
    total_spend: float
    journal_count: int
    breakdown: list[SummaryBucket]


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class Credentials(BaseModel):
    email: str
    password: str


class AccountingPostRequest(BaseModel):
    job_id: str
    document_type: str
    ocr_fields: dict[str, Any]
    classification: dict[str, Any]


class AccountingPostResponse(BaseModel):
    journal_entry: JournalEntryModel
>>>>>>> 5501a9a (feat(auth): improve local dev login defaults)
