"""Accounting API endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from services.accounting.main import post_journal_entry

from .dependencies import get_current_user_token, get_job_store
from .jobs import JobStore
from .models import AccountingPostRequest, AccountingPostResponse, JournalEntryModel
from .utils import job_to_model

router = APIRouter(prefix="/api/accounting", tags=["accounting"])

JobStoreDep = Annotated[JobStore, Depends(get_job_store)]
AuthDep = Annotated[str, Depends(get_current_user_token)]


@router.post("/post", response_model=AccountingPostResponse)
def post_accounting_record(
    payload: AccountingPostRequest,
    job_store: JobStoreDep,
    _: AuthDep,
) -> AccountingPostResponse:
    entry = post_journal_entry(
        ocr_fields=payload.ocr_fields,
        classification=payload.classification,
        document_type=payload.document_type,
        job_id=payload.job_id,
    )

    job_store.store_result(
        payload.job_id,
        classification=payload.classification.get("category"),
        ocr_text="\n".join(payload.ocr_fields.get("lines", []))
        if isinstance(payload.ocr_fields.get("lines"), list)
        else None,
        ocr_fields=payload.ocr_fields,
        journal_entry=entry,
    )
    job_store.update_status(payload.job_id, "ok")

    # Return the updated job data for convenience
    job = job_store.get_job(payload.job_id)
    _ = job_to_model(job)  # ensures serialization shape, discard result

    return AccountingPostResponse(journal_entry=JournalEntryModel(**entry))
