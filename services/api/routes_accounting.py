"""Accounting API endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from services.accounting.main import post_journal_entry
from services.api.approvals import ApprovalStore

from .dependencies import get_approval_store, get_current_user_token, get_job_store
from .jobs import JobStore
from .models import AccountingPostRequest, AccountingPostResponse, JournalEntryModel
from .utils import job_to_model

router = APIRouter(prefix="/api/accounting", tags=["accounting"])

JobStoreDep = Annotated[JobStore, Depends(get_job_store)]
AuthDep = Annotated[str, Depends(get_current_user_token)]
ApprovalStoreDep = Annotated[ApprovalStore, Depends(get_approval_store)]


@router.post("/post", response_model=AccountingPostResponse)
def post_accounting_record(
    payload: AccountingPostRequest,
    job_store: JobStoreDep,
    approval_store: ApprovalStoreDep,
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
        ocr_text=(
            "\n".join(payload.ocr_fields.get("lines", []))
            if isinstance(payload.ocr_fields.get("lines"), list)
            else None
        ),
        ocr_fields=payload.ocr_fields,
        journal_entry=entry,
    )
    try:
        record = approval_store.get(payload.job_id)
    except KeyError:
        record = approval_store.record(payload.job_id, actor="system", action="pending")
    job_store.set_approval(
        payload.job_id,
        status=record.status,
        history=[event.to_dict() for event in record.history],
    )
    job_store.update_status(payload.job_id, "pending_approval")

    # Return the updated job data for convenience
    job = job_store.get_job(payload.job_id)
    _ = job_to_model(job)  # ensures serialization shape, discard result

    return AccountingPostResponse(journal_entry=JournalEntryModel(**entry))
