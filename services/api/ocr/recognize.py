"""Multi-backend OCR orchestration."""

from __future__ import annotations

import os
from collections.abc import Iterable
from dataclasses import dataclass, field
from typing import Any

import cv2
import numpy as np
import pytesseract

from .preprocess import PreprocessedOrientation, PreprocessResult, preprocess_image


@dataclass(slots=True)
class OCRSpan:
    text: str
    confidence: float
    bbox: list[tuple[int, int]]


@dataclass(slots=True)
class RecognitionCandidate:
    orientation: PreprocessedOrientation
    spans: list[OCRSpan]
    score: float
    backend_scores: dict[str, float] = field(default_factory=dict)

    def debug(self) -> dict[str, Any]:
        return {
            "rotation": self.orientation.rotation,
            "angle": self.orientation.angle_correction,
            "score": self.score,
            "backend_scores": self.backend_scores,
            "span_count": len(self.spans),
        }


@dataclass(slots=True)
class RecognitionResult:
    candidate: RecognitionCandidate
    preprocess: PreprocessResult

    @property
    def spans(self) -> list[OCRSpan]:
        return self.candidate.spans

    def to_debug(self) -> dict[str, Any]:
        return {
            "orientation": self.candidate.debug(),
            "preprocess": [
                orientation.debug for orientation in self.preprocess.orientations
            ],
        }


def _ensure_rgb(image: np.ndarray) -> np.ndarray:
    if len(image.shape) == 2:
        return cv2.cvtColor(image, cv2.COLOR_GRAY2RGB)
    return cv2.cvtColor(image, cv2.COLOR_BGR2RGB)


def _recognize_paddle(image: np.ndarray) -> list[OCRSpan]:
    backend_env = os.environ.get("OCR_BACKEND", "").lower()
    if backend_env and "paddle" not in backend_env:
        return []
    try:
        from paddleocr import PaddleOCR  # type: ignore
    except Exception:
        return []

    try:
        ocr = PaddleOCR(
            lang="japan",
            use_angle_cls=True,
            show_log=False,
            det=True,
            rec=True,
        )
        results = ocr.ocr(image, cls=True)
    except Exception:
        return []

    spans: list[OCRSpan] = []
    for page in results or []:
        for entry in page or []:
            try:
                bbox = [(int(pt[0]), int(pt[1])) for pt in entry[0]]
                text, confidence = entry[1]
            except (TypeError, IndexError, ValueError):
                continue
            conf_value = float(confidence or 0.0)
            if conf_value < 0.5:
                continue
            spans.append(
                OCRSpan(
                    text=text.strip(),
                    confidence=conf_value,
                    bbox=bbox,
                )
            )
    return spans


def _recognize_tesseract(image: np.ndarray, *, psm: int) -> list[OCRSpan]:
    rgb = _ensure_rgb(image)
    config = f"--oem 1 --psm {psm} -l jpn+eng tessedit_char_whitelist=0123456789.,¥￥円ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    data = pytesseract.image_to_data(
        rgb, config=config, output_type=pytesseract.Output.DICT
    )
    spans: list[OCRSpan] = []
    for text, conf, x, y, w, h in zip(
        data.get("text", []),
        data.get("conf", []),
        data.get("left", []),
        data.get("top", []),
        data.get("width", []),
        data.get("height", []), strict=False,
    ):
        if not text or float(conf) < 0:
            continue
        conf_value = float(conf) / 100.0
        if conf_value < 0.6:
            continue
        bbox = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
        spans.append(OCRSpan(text=text.strip(), confidence=conf_value, bbox=bbox))
    return spans


def _merge_spans(spans: Iterable[OCRSpan]) -> list[OCRSpan]:
    merged: list[OCRSpan] = []
    for span in spans:
        if not span.text:
            continue
        key = span.text
        duplicate = next(
            (existing for existing in merged if existing.text == key), None
        )
        if duplicate:
            duplicate.confidence = max(duplicate.confidence, span.confidence)
        else:
            merged.append(span)
    return merged


def _score_candidate(
    spans: list[OCRSpan], orientation: PreprocessedOrientation
) -> tuple[float, dict[str, float]]:
    if not spans:
        return (orientation.metadata.get("score", 0.0) * 0.2, {"base": 0.0})
    confidences = [span.confidence for span in spans if span.confidence > 0]
    avg_conf = sum(confidences) / len(confidences) if confidences else 0.2
    digit_weight = orientation.metadata.get("digit_candidates", 0)
    total_score = avg_conf * 10 + digit_weight
    return total_score, {"avg_conf": avg_conf, "digit_weight": float(digit_weight)}


def recognize_text(
    source: str | np.ndarray | bytes,
    *,
    enhance: bool = False,
    rotations: Iterable[int] | None = None,
) -> RecognitionResult:
    preprocess = preprocess_image(
        source, enhance=enhance, rotations=rotations or (0, 90, 180, 270)
    )
    candidates: list[RecognitionCandidate] = []
    for orientation in preprocess.orientations:
        image = orientation.processed
        spans: list[OCRSpan] = []

        paddle_spans = _recognize_paddle(image)
        if paddle_spans:
            spans.extend(paddle_spans)

        tesseract_spans = _recognize_tesseract(image, psm=6)
        if not tesseract_spans:
            tesseract_spans = _recognize_tesseract(image, psm=7)
        spans.extend(tesseract_spans)

        merged = _merge_spans(spans)
        score, backend_scores = _score_candidate(merged, orientation)
        candidate = RecognitionCandidate(
            orientation=orientation,
            spans=merged,
            score=score,
            backend_scores=backend_scores,
        )
        candidates.append(candidate)

    if not candidates:
        raise RuntimeError("OCR recognition failed")

    best = max(candidates, key=lambda item: item.score)
    return RecognitionResult(candidate=best, preprocess=preprocess)


__all__ = [
    "recognize_text",
    "RecognitionResult",
    "OCRSpan",
]
