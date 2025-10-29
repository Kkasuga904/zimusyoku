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
    backend: str = "unknown"


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
                    backend="paddle",
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
        data.get("height", []),
        strict=False,
    ):
        if not text or float(conf) < 0:
            continue
        conf_value = float(conf) / 100.0
        if conf_value < 0.6:
            continue
        bbox = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
        spans.append(
            OCRSpan(
                text=text.strip(),
                confidence=conf_value,
                bbox=bbox,
                backend="tesseract",
            )
        )
    return spans


def _best_tesseract_spans(image: np.ndarray) -> tuple[list[OCRSpan], dict[str, float]]:
    best_spans: list[OCRSpan] = []
    best_score = -1.0
    backend_scores: dict[str, float] = {}
    for psm in (6, 7, 11):
        spans = _recognize_tesseract(image, psm=psm)
        if not spans:
            continue
        confidences = [span.confidence for span in spans if span.confidence > 0]
        avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
        backend_scores[f"tesseract_psm_{psm}"] = avg_conf
        if avg_conf > best_score:
            best_score = avg_conf
            best_spans = spans
    if best_score >= 0:
        backend_scores["tesseract_avg_conf"] = best_score
    return best_spans, backend_scores


def _bbox_metrics(bbox: Iterable[tuple[int, int]]) -> tuple[float, float, float, float]:
    points = list(bbox)
    if not points:
        return 0.0, 0.0, 0.0, 0.0
    xs = [float(pt[0]) for pt in points]
    ys = [float(pt[1]) for pt in points]
    return min(xs), min(ys), max(xs), max(ys)


def _bbox_center_and_span(
    bbox: Iterable[tuple[int, int]]
) -> tuple[tuple[float, float], float, float]:
    x_min, y_min, x_max, y_max = _bbox_metrics(bbox)
    return (
        ((x_min + x_max) / 2.0, (y_min + y_max) / 2.0),
        max(x_max - x_min, 1.0),
        max(y_max - y_min, 1.0),
    )


def _is_near(existing: OCRSpan, candidate: OCRSpan) -> bool:
    center_a, width_a, height_a = _bbox_center_and_span(existing.bbox)
    center_b, width_b, height_b = _bbox_center_and_span(candidate.bbox)
    if width_a == 0 or height_a == 0:
        return False
    dx = center_a[0] - center_b[0]
    dy = center_a[1] - center_b[1]
    threshold = max(width_a, height_a, width_b, height_b) * 0.6 + 8.0
    return (dx * dx + dy * dy) ** 0.5 <= threshold


def _merge_spans(spans: Iterable[OCRSpan]) -> list[OCRSpan]:
    merged: list[OCRSpan] = []
    for span in sorted(spans, key=lambda item: item.confidence, reverse=True):
        if not span.text:
            continue
        duplicate = next(
            (
                existing
                for existing in merged
                if existing.text == span.text and _is_near(existing, span)
            ),
            None,
        )
        if duplicate is None:
            merged.append(span)
            continue
        if span.confidence > duplicate.confidence:
            duplicate.confidence = span.confidence
            duplicate.bbox = span.bbox
            duplicate.backend = span.backend
    return merged


def _score_candidate(
    spans: list[OCRSpan],
    orientation: PreprocessedOrientation,
    backend_avgs: dict[str, float],
) -> tuple[float, dict[str, float]]:
    orientation_score = float(orientation.metadata.get("score", 0.0))
    if not spans:
        return (
            max(orientation_score * 0.2, 0.0),
            {"orientation": orientation_score, **backend_avgs},
        )
    confidences = [span.confidence for span in spans if span.confidence > 0]
    avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
    total_score = orientation_score + avg_conf * 10.0
    metrics = {"orientation": orientation_score, "avg_conf": avg_conf}
    metrics.update(backend_avgs)
    return total_score, metrics


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

        tesseract_spans, tess_scores = _best_tesseract_spans(image)
        spans.extend(tesseract_spans)

        merged = _merge_spans(spans)
        paddle_avg = (
            sum(span.confidence for span in paddle_spans) / len(paddle_spans)
            if paddle_spans
            else 0.0
        )
        backend_metrics = dict(tess_scores)
        if paddle_spans:
            backend_metrics["paddle_avg_conf"] = paddle_avg
        score, backend_scores = _score_candidate(merged, orientation, backend_metrics)
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
