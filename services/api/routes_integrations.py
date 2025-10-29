"""Integration sync endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from services.integrations import BankAPIClient, FreeeAPIClient, YayoiSaaSClient

from .dependencies import (
    get_bank_client,
    get_current_user_token,
    get_freee_client,
    get_job_store,
    get_yayoi_client,
)
from .jobs import JobStore
from .models import (
    PaymentExecutionRequest,
    PaymentExecutionResponse,
    SyncRequest,
    SyncResponse,
)

router = APIRouter(prefix="/api", tags=["integrations"])

JobStoreDep = Annotated[JobStore, Depends(get_job_store)]
AuthDep = Annotated[str, Depends(get_current_user_token)]
FreeeDep = Annotated[FreeeAPIClient, Depends(get_freee_client)]
YayoiDep = Annotated[YayoiSaaSClient, Depends(get_yayoi_client)]
BankDep = Annotated[BankAPIClient, Depends(get_bank_client)]


def _select_jobs(job_store: JobStore, job_ids: list[str]) -> list:
    if job_ids:
        jobs = []
        missing = []
        for job_id in job_ids:
            try:
                jobs.append(job_store.get_job(job_id))
            except KeyError:
                missing.append(job_id)
        if missing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Jobs not found: {', '.join(missing)}",
            )
    else:
        jobs = [
            job for job in job_store.list_jobs() if job.approval_status == "approved"
        ]
    if not jobs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No approved jobs available for syncing",
        )
    return jobs


def _ensure_approved(jobs: list) -> None:
    not_ready = [job.id for job in jobs if job.approval_status != "approved"]
    if not_ready:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Jobs require approval before sync: {', '.join(not_ready)}",
        )


@router.post("/sync/freee", response_model=SyncResponse)
def sync_freee(
    payload: SyncRequest,
    job_store: JobStoreDep,
    freee: FreeeDep,
    _: AuthDep,
) -> SyncResponse:
    jobs = _select_jobs(job_store, payload.job_ids)
    _ensure_approved(jobs)

    receipts: list[dict[str, str]] = []
    processed: list[str] = []
    for job in jobs:
        if not job.journal_entry:
            continue
        response = freee.post_journal_entry(job.journal_entry)
        processed.append(job.id)
        receipts.append({"job_id": job.id, "integration": "freee", **response})
        metadata = job.metadata or {}
        sync_meta = metadata.get("sync") or {}
        sync_meta["freee"] = response
        job_store.set_metadata(job.id, sync=sync_meta)
    return SyncResponse(processed=processed, receipts=receipts)


@router.post("/sync/yayoi", response_model=SyncResponse)
def sync_yayoi(
    payload: SyncRequest,
    job_store: JobStoreDep,
    yayoi: YayoiDep,
    _: AuthDep,
) -> SyncResponse:
    jobs = _select_jobs(job_store, payload.job_ids)
    _ensure_approved(jobs)

    receipts: list[dict[str, str]] = []
    processed: list[str] = []
    for job in jobs:
        if not job.journal_entry:
            continue
        response = yayoi.post_journal_entry(job.journal_entry)
        processed.append(job.id)
        receipts.append({"job_id": job.id, "integration": "yayoi", **response})
        metadata = job.metadata or {}
        sync_meta = metadata.get("sync") or {}
        sync_meta["yayoi"] = response
        job_store.set_metadata(job.id, sync=sync_meta)
    return SyncResponse(processed=processed, receipts=receipts)


@router.post("/payments/execute", response_model=PaymentExecutionResponse)
def execute_payments(
    payload: PaymentExecutionRequest,
    job_store: JobStoreDep,
    bank: BankDep,
    _: AuthDep,
) -> PaymentExecutionResponse:
    jobs = _select_jobs(job_store, payload.job_ids)
    _ensure_approved(jobs)

    payments = []
    processed = []
    for job in jobs:
        entry = job.journal_entry or {}
        payments.append(
            {
                "job_id": job.id,
                "vendor": entry.get("vendor"),
                "amount": entry.get("amount") or entry.get("amount_gross"),
                "account": entry.get("credit_account"),
            }
        )
        processed.append(job.id)
    receipt = bank.execute_payments(payments)
    return PaymentExecutionResponse(
        batch_id=receipt["batch_id"],
        processed=processed,
        requested_at=datetime.fromisoformat(receipt["requested_at"]),
    )
