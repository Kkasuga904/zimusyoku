"""Utility helpers for API routes."""

from __future__ import annotations

from datetime import datetime

from .jobs import Job
from .models import JobModel, OCRFields, OCRResultModel


def _to_datetime(value) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        return datetime.fromisoformat(value.replace("Z", ""))
    raise TypeError(f"Unsupported datetime value: {value!r}")


def job_to_model(job: Job) -> JobModel:
    ocr_model = None
    if job.ocr_text:
        ocr_model = OCRResultModel(
            text=job.ocr_text,
            fields=OCRFields(**(job.ocr_fields or {})),
        )

    return JobModel(
        id=job.id,
        fileName=job.file_name,
        documentType=job.document_type,
        status=job.status.title(),
        classification=job.classification,
        submittedAt=_to_datetime(job.submitted_at),
        updatedAt=_to_datetime(job.updated_at),
        error=job.error,
        ocr=ocr_model,
        journalEntry=job.journal_entry,
    )
