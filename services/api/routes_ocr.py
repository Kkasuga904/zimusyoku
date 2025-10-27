"""OCR related API endpoints."""

from __future__ import annotations

from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from services.ocr.worker import process_document

from .config import get_settings
from .dependencies import get_current_user_token, get_job_store
from .jobs import JobStore
from .models import UploadResponse
from .utils import job_to_model

router = APIRouter(prefix="/api/ocr", tags=["ocr"])

ALLOWED_TYPES = {"invoice", "receipt", "estimate"}

JobStoreDep = Annotated[JobStore, Depends(get_job_store)]
AuthDep = Annotated[str, Depends(get_current_user_token)]
UploadDep = Annotated[UploadFile, File(...)]


@router.post("/upload", response_model=UploadResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    document: UploadDep,
    job_store: JobStoreDep,
    _: AuthDep,
    document_type: str = "invoice",
) -> UploadResponse:
    document_type_normalized = document_type.lower()
    if document_type_normalized not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported document type")

    settings = get_settings()
    settings.ensure_directories()

    job = job_store.create_job(document.filename, document_type_normalized)

    target_dir = settings.ocr_dir / job.id
    target_dir.mkdir(parents=True, exist_ok=True)
    original_path = target_dir / f"original{Path(document.filename).suffix or '.bin'}"

    content = await document.read()
    original_path.write_bytes(content)

    # Trigger async pipeline (runs eagerly in tests/dev)
    process_document.delay(job.id, str(original_path), document_type_normalized)

    return UploadResponse(job=job_to_model(job))
