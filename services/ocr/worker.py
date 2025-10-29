"""Celery worker orchestrating the OCR pipeline."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from services.accounting.classify import build_journal_lines, classify_document
from services.accounting.main import post_journal_entry
from services.api.approvals import ApprovalStore
from services.api.celery_app import celery_app
from services.api.config import get_settings
from services.api.jobs import JobStore
from services.api.ocr.amounts import extract_amounts_from_text
from services.ocr.main import OCRProcessingError, perform_ocr, save_result

logger = logging.getLogger(__name__)

settings = get_settings()
job_store = JobStore(settings.jobs_path)
approval_store = ApprovalStore(settings.approvals_path)


@celery_app.task(name="pipeline.process_document")
def process_document(job_id: str, file_path: str, document_type: str) -> dict[str, Any]:
    """Celery entry point that runs OCR -> classification -> accounting."""
    job_store.update_status(job_id, "running")
    target_dir = settings.ocr_dir / job_id
    result_path = target_dir / "result.json"

    try:
        ocr_result = perform_ocr(Path(file_path))
        save_result(ocr_result, result_path)

        metadata_updates: dict[str, Any] = {}

        structured_fields = ocr_result.fields.get("structured")
        if structured_fields:
            metadata_updates["structured_fields"] = structured_fields
            metadata_updates["line_items"] = structured_fields.get("line_items", [])

        amounts_hint = extract_amounts_from_text(ocr_result.text)
        total_amount = amounts_hint.get("total")
        tax_amount = amounts_hint.get("tax")
        subtotal_amount = amounts_hint.get("subtotal")

        if total_amount is not None:
            ocr_result.fields["amount"] = float(total_amount)
        if tax_amount is not None:
            ocr_result.fields["tax"] = float(tax_amount)

        if any(
            value is not None for value in (total_amount, subtotal_amount, tax_amount)
        ):
            metadata_updates["amounts"] = amounts_hint

        if metadata_updates:
            job_store.set_metadata(job_id, **metadata_updates)

        classification = classify_document(
            text=ocr_result.text,
            fields=ocr_result.fields,
            document_type=document_type,
        )

        if total_amount is not None:
            amount_value = float(total_amount)
            classification["amount"] = amount_value
            classification["amount_gross"] = amount_value
            if tax_amount is not None:
                tax_value = float(tax_amount)
                classification["tax"] = tax_value
                net_val = amount_value - tax_value
                classification["amount_net"] = net_val
                classification["net_amount"] = net_val
        if subtotal_amount is not None and classification.get("amount_net") is None:
            net_val = float(subtotal_amount)
            classification["amount_net"] = net_val
            classification["net_amount"] = net_val
        if (
            subtotal_amount is not None
            and classification.get("amount_gross") is None
            and tax_amount is not None
        ):
            gross_val = float(subtotal_amount + tax_amount)
            classification["amount_gross"] = gross_val
            classification["amount"] = gross_val
        classification["document_type"] = document_type
        classification["journal_lines"] = build_journal_lines(classification)

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
        try:
            record = approval_store.get(job_id)
        except KeyError:
            record = approval_store.record(job_id, actor="system", action="pending")
        job_store.set_approval(
            job_id,
            status=record.status,
            history=[event.to_dict() for event in record.history],
        )
        job_store.update_status(job_id, "pending_approval")
        job_store.set_metadata(
            job_id,
            approval={
                "status": record.status,
                "history": [event.to_dict() for event in record.history],
            },
        )

        return {
            "job_id": job_id,
            "ocr": ocr_result.fields,
            "classification": classification,
            "journal_entry": journal_entry,
            "approval": {
                "status": record.status,
                "history": [event.to_dict() for event in record.history],
            },
        }
    except OCRProcessingError as exc:
        logger.exception("OCR failed for job %s", job_id)
        job_store.update_status(job_id, "failed", error=str(exc))
        raise
    except Exception as exc:  # pragma: no cover - safety net
        logger.exception("Processing failed for job %s", job_id)
        job_store.update_status(job_id, "failed", error=str(exc))
        raise
