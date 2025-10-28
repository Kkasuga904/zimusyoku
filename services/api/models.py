"""Pydantic models shared by API routes."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

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
    metadata: dict[str, Any] = Field(default_factory=dict)

    class Config:
        allow_population_by_field_name = True


class UploadResponse(BaseModel):
    job: JobModel


class AmountCandidateModel(BaseModel):
    type: Literal["total", "subtotal", "tax"]
    value: int
    score: float
    text: str
    bbox: list[tuple[int, int]]


class AmountFieldsModel(BaseModel):
    currency: str = "JPY"
    subtotal: int | None = None
    tax: int | None = None
    total: int | None = None
    conf: float | None = None


class AmountExtractionResponse(BaseModel):
    ok: bool
    fields: AmountFieldsModel | None = None
    candidates: list[AmountCandidateModel] = Field(default_factory=list)
    debug: dict[str, Any] | None = None
    reason: str | None = None


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
