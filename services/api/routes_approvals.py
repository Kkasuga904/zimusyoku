"""Approvals workflow endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from services.api.approvals import ApprovalEvent, ApprovalRecord, ApprovalStore

from .dependencies import (
    get_approval_store,
    get_current_user_token,
    get_job_store,
)
from .jobs import JobStore
from .models import (
    ApprovalActionRequest,
    ApprovalEventModel,
    ApprovalRecordModel,
    ApprovalsResponse,
)

router = APIRouter(prefix="/api/approvals", tags=["approvals"])

ApprovalStoreDep = Annotated[ApprovalStore, Depends(get_approval_store)]
JobStoreDep = Annotated[JobStore, Depends(get_job_store)]
AuthDep = Annotated[str, Depends(get_current_user_token)]


def _to_event_model(event: ApprovalEvent) -> ApprovalEventModel:
    return ApprovalEventModel(
        action=event.action,  # type: ignore[arg-type]
        actor=event.actor,
        recordedAt=event.recorded_at,
        note=event.note,
    )


def _to_record_model(record: ApprovalRecord) -> ApprovalRecordModel:
    return ApprovalRecordModel(
        jobId=record.job_id,
        status=record.status,  # type: ignore[arg-type]
        updatedAt=record.updated_at,
        history=[_to_event_model(event) for event in record.history],
    )


def _sync_job(job_store: JobStore, record: ApprovalRecord) -> None:
    job_store.set_approval(
        record.job_id,
        status=record.status,
        history=[event.to_dict() for event in record.history],
    )
    if record.status == "approved":
        job_store.update_status(record.job_id, "approved")
    elif record.status == "rejected":
        job_store.update_status(record.job_id, "rejected")


@router.get("", response_model=ApprovalsResponse)
def list_approvals(
    store: ApprovalStoreDep,
    _: AuthDep,
) -> ApprovalsResponse:
    records = store.list_all()
    return ApprovalsResponse(approvals=[_to_record_model(record) for record in records])


@router.post("/{job_id}/approve", response_model=ApprovalRecordModel)
def approve_job(
    job_id: str,
    payload: ApprovalActionRequest,
    store: ApprovalStoreDep,
    job_store: JobStoreDep,
    actor: AuthDep,
) -> ApprovalRecordModel:
    try:
        job_store.get_job(job_id)
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Job not found"
        ) from None

    record = store.record(job_id, actor=actor, action="approved", note=payload.note)
    _sync_job(job_store, record)
    return _to_record_model(record)


@router.post("/{job_id}/reject", response_model=ApprovalRecordModel)
def reject_job(
    job_id: str,
    payload: ApprovalActionRequest,
    store: ApprovalStoreDep,
    job_store: JobStoreDep,
    actor: AuthDep,
) -> ApprovalRecordModel:
    try:
        job_store.get_job(job_id)
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Job not found"
        ) from None

    record = store.record(job_id, actor=actor, action="rejected", note=payload.note)
    _sync_job(job_store, record)
    return _to_record_model(record)
