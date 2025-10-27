"""Celery worker orchestrating the OCR pipeline."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from services.accounting.classify import classify_document
from services.accounting.main import post_journal_entry
from services.api.celery_app import celery_app
from services.api.config import get_settings
from services.api.jobs import JobStore
from services.ocr.main import OCRProcessingError, perform_ocr, save_result

logger = logging.getLogger(__name__)

settings = get_settings()
job_store = JobStore(settings.jobs_path)


@celery_app.task(name="pipeline.process_document")
def process_document(job_id: str, file_path: str, document_type: str) -> dict[str, Any]:
    """Celery entry point that runs OCR -> classification -> accounting."""
    job_store.update_status(job_id, "running")
    target_dir = settings.ocr_dir / job_id
    result_path = target_dir / "result.json"

    try:
        ocr_result = perform_ocr(Path(file_path))
        save_result(ocr_result, result_path)

        classification = classify_document(
            text=ocr_result.text,
            fields=ocr_result.fields,
            document_type=document_type,
        )
        journal_entry = post_journal_entry(
            ocr_fields=ocr_result.fields,
            classification=classification,
            document_type=document_type,
            job_id=job_id,
        )

        job_store.store_result(
            job_id,
            classification=classification.get("category"),
            ocr_text=ocr_result.text,
            ocr_fields=ocr_result.fields,
            journal_entry=journal_entry,
        )
        job_store.update_status(job_id, "ok")

        return {
            "job_id": job_id,
            "ocr": ocr_result.fields,
            "classification": classification,
            "journal_entry": journal_entry,
        }
    except OCRProcessingError as exc:
        logger.exception("OCR failed for job %s", job_id)
        job_store.update_status(job_id, "failed", error=str(exc))
        raise
    except Exception as exc:  # pragma: no cover - safety net
        logger.exception("Processing failed for job %s", job_id)
        job_store.update_status(job_id, "failed", error=str(exc))
        raise
