"""Pydantic models shared by API routes."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class LineItemModel(BaseModel):
    description: str
    quantity: float | None = None
    unit_price: float | None = Field(None, alias="unitPrice")
    amount: float | None = None

    class Config:
        allow_population_by_field_name = True


class TotalsModel(BaseModel):
    subtotal: float | None = None
    tax: float | None = None
    total: float | None = None


class OCRFields(BaseModel):
    vendor: str | None = None
    date: str | None = None
    issue_date: str | None = Field(None, alias="issueDate")
    due_date: str | None = Field(None, alias="dueDate")
    amount: float | None = None
    tax: float | None = None
    category: str | None = None
    line_items: list[LineItemModel] = Field(default_factory=list, alias="lineItems")
    totals: TotalsModel | None = None

    class Config:
        allow_population_by_field_name = True


class OCRResultModel(BaseModel):
    text: str
    fields: OCRFields


class JournalLineModel(BaseModel):
    account: str
    debit: float
    credit: float
    description: str | None = None


class JournalEntryModel(BaseModel):
    vendor: str
    account: str
    memo: str
    description: str | None = None
    amount: float
    amount_gross: float
    amount_net: float
    tax: float
    debit_account: str | None = Field(None, alias="debitAccount")
    credit_account: str | None = Field(None, alias="creditAccount")
    tax_account: str | None = Field(None, alias="taxAccount")
    journal_lines: list[JournalLineModel] = Field(
        default_factory=list, alias="journalLines"
    )
    currency: str = "JPY"
    document_type: str
    recorded_at: datetime

    class Config:
        allow_population_by_field_name = True


class ApprovalEventModel(BaseModel):
    action: Literal["approved", "rejected", "pending"]
    actor: str
    recorded_at: datetime = Field(..., alias="recordedAt")
    note: str | None = None

    class Config:
        allow_population_by_field_name = True


class ApprovalRecordModel(BaseModel):
    job_id: str = Field(..., alias="jobId")
    status: Literal["pending", "approved", "rejected"]
    updated_at: datetime = Field(..., alias="updatedAt")
    history: list[ApprovalEventModel] = Field(default_factory=list)

    class Config:
        allow_population_by_field_name = True


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
    approval_status: Literal["pending", "approved", "rejected"] = Field(
        "pending", alias="approvalStatus"
    )
    approval_history: list[ApprovalEventModel] = Field(
        default_factory=list, alias="approvalHistory"
    )

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


class SummaryCategoryBreakdown(BaseModel):
    label: str
    ratio: float


class SummaryMonthlyTotal(BaseModel):
    month: str
    total: float


class SummaryAccountTotal(BaseModel):
    account: str
    amount: float


class SummaryResponse(BaseModel):
    month: str
    total_spend: float
    journal_count: int
    breakdown: list[SummaryBucket]
    category_ratios: list[SummaryCategoryBreakdown] = Field(default_factory=list)
    approval_rate: float = 0.0
    monthly_totals: list[SummaryMonthlyTotal] = Field(default_factory=list)
    top_accounts: list[SummaryAccountTotal] = Field(default_factory=list)


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


class ApprovalActionRequest(BaseModel):
    note: str | None = None


class ApprovalsResponse(BaseModel):
    approvals: list[ApprovalRecordModel]


class SyncRequest(BaseModel):
    job_ids: list[str] = Field(default_factory=list, alias="jobIds")

    class Config:
        allow_population_by_field_name = True


class SyncResponse(BaseModel):
    processed: list[str] = Field(default_factory=list)
    receipts: list[dict[str, Any]] = Field(default_factory=list)


class PaymentExecutionRequest(BaseModel):
    job_ids: list[str] = Field(default_factory=list, alias="jobIds")

    class Config:
        allow_population_by_field_name = True


class PaymentExecutionResponse(BaseModel):
    batch_id: str
    processed: list[str]
    requested_at: datetime
