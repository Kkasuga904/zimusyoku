"""OCR related API endpoints."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Annotated

import cv2
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status

from services.ocr.worker import process_document

from .config import get_settings
from .dependencies import get_current_user_token, get_job_store
from .jobs import JobStore
from .models import (
    AmountCandidateModel,
    AmountExtractionResponse,
    AmountFieldsModel,
    UploadResponse,
)
from .ocr.amounts import extract_amounts
from .ocr.recognize import RecognitionResult, recognize_text
from .utils import job_to_model

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ocr", tags=["ocr"])

ALLOWED_TYPES = {"invoice", "receipt", "estimate"}

JobStoreDep = Annotated[JobStore, Depends(get_job_store)]
AuthDep = Annotated[str, Depends(get_current_user_token)]
UploadDep = Annotated[UploadFile, File(...)]


def _store_debug_crop(
    result: RecognitionResult, amounts: dict[str, object], filename: str
) -> list[str]:
    settings = get_settings()
    debug_dir = settings.ocr_dir / "debug"
    debug_dir.mkdir(parents=True, exist_ok=True)
    saved: list[str] = []
    keyword_regions = (
        (amounts.get("debug") or {}).get("keyword_regions")
        if isinstance(amounts, dict)
        else None
    )
    if not keyword_regions:
        return saved
    orientation = result.candidate.orientation
    image = orientation.processed
    for index, region in enumerate(keyword_regions[:3]):
        bbox = region.get("bbox") or []
        xs = [pt[0] for pt in bbox if isinstance(pt, list | tuple) and len(pt) == 2]
        ys = [pt[1] for pt in bbox if isinstance(pt, list | tuple) and len(pt) == 2]
        if not xs or not ys:
            continue
        x0 = max(min(xs) - 20, 0)
        y0 = max(min(ys) - 20, 0)
        x1 = min(max(xs) + 20, image.shape[1])
        y1 = min(max(ys) + 20, image.shape[0])
        crop = image[y0:y1, x0:x1]
        if crop.size == 0:
            continue
        debug_path = debug_dir / f"{Path(filename).stem}_kw{index}.png"
        cv2.imwrite(str(debug_path), crop)
        saved.append(str(debug_path))
    return saved


def _build_amount_response(
    result: RecognitionResult, amounts: dict[str, object]
) -> AmountExtractionResponse:
    amount_confidence = None
    fields_info = amounts.get("fields")
    if isinstance(fields_info, dict):
        amount_confidence = fields_info.get("confidence")
    if amount_confidence is None:
        amount_confidence = result.candidate.backend_scores.get("avg_conf")
    fields = AmountFieldsModel(
        currency=amounts.get("currency", "JPY"),
        subtotal=amounts.get("subtotal"),
        tax=amounts.get("tax"),
        total=amounts.get("total"),
        confidence=amount_confidence,
    )
    candidate_models = [
        AmountCandidateModel(
            type=item.get("type", "total"),
            value=item.get("value"),
            score=item.get("score", 0.0),
            text=item.get("text", ""),
            bbox=item.get("bbox") or [],
        )
        for item in amounts.get("candidates", [])
    ]
    debug_payload = {
        "orientation": result.to_debug(),
        "amount_debug": amounts.get("debug"),
    }
    return AmountExtractionResponse(
        ok=True,
        fields=fields,
        candidates=candidate_models,
        debug=debug_payload,
    )


@router.post("/parse", response_model=AmountExtractionResponse)
async def parse_document(
    document: UploadDep,
    enhance: bool = Query(
        default=False, description="Apply aggressive enhancement heuristics"
    ),
) -> AmountExtractionResponse:
    content = await document.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Empty payload"
        )

    try:
        recognition = recognize_text(content, enhance=enhance)
        amounts = extract_amounts(recognition.spans)
    except Exception as exc:
        logger.exception("Parse failed for %s: %s", document.filename, exc)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="OCR parsing failed",
        ) from exc

    if not amounts.get("total"):
        saved = _store_debug_crop(recognition, amounts, document.filename or "capture")
        amounts.setdefault("debug", {}).update({"debug_paths": saved})

    return _build_amount_response(recognition, amounts)


@router.post(
    "/upload", response_model=UploadResponse, status_code=status.HTTP_202_ACCEPTED
)
async def upload_document(
    document: UploadDep,
    job_store: JobStoreDep,
    user_email: AuthDep,
    document_type: str = "invoice",
    enhance: bool = Query(default=False),
) -> UploadResponse:
    document_type_normalized = document_type.lower()
    if document_type_normalized not in ALLOWED_TYPES:
        logger.warning(
            "Upload rejected: unsupported type '%s' requested by %s",
            document_type,
            user_email,
        )
        raise HTTPException(status_code=400, detail="Unsupported document type")

    settings = get_settings()
    settings.ensure_directories()

    job = job_store.create_job(document.filename, document_type_normalized)

    target_dir = settings.ocr_dir / job.id
    target_dir.mkdir(parents=True, exist_ok=True)
    original_path = target_dir / f"original{Path(document.filename).suffix or '.bin'}"

    content = await document.read()
    original_path.write_bytes(content)

    logger.info(
        "Stored upload job_id=%s filename=%s size=%d type=%s user=%s path=%s",
        job.id,
        document.filename,
        len(content),
        document_type_normalized,
        user_email,
        original_path,
    )

    try:
        recognition = recognize_text(content, enhance=enhance)
        amounts = extract_amounts(recognition.spans)
        job_store.set_metadata(
            job.id,
            amounts={
                "currency": amounts.get("currency", "JPY"),
                "subtotal": amounts.get("subtotal"),
                "tax": amounts.get("tax"),
                "total": amounts.get("total"),
                "confidence": (
                    (amounts.get("fields") or {}).get("confidence")
                    if isinstance(amounts.get("fields"), dict)
                    else None
                )
                or recognition.candidate.backend_scores.get("avg_conf"),
            },
            amount_candidates=amounts.get("candidates", []),
            ocr_debug=recognition.to_debug(),
        )
    except Exception as exc:
        logger.warning("Inline OCR failed for job_id=%s: %s", job.id, exc)

    try:
        process_document.delay(job.id, str(original_path), document_type_normalized)
        logger.info("Dispatched OCR pipeline for job_id=%s", job.id)
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.exception("Failed to dispatch OCR pipeline for job_id=%s", job.id)
        if settings.celery_task_always_eager:
            job_store.update_status(job.id, "failed", error=str(exc))
            snapshot = job_store.get_job(job.id)
            return UploadResponse(job=job_to_model(snapshot))
        raise HTTPException(
            status_code=500,
            detail="Failed to queue OCR processing",
        ) from exc

    refreshed = job_store.get_job(job.id)
    return UploadResponse(job=job_to_model(refreshed))
