"""Image preprocessing helpers for OCR."""

from __future__ import annotations

import io
from collections.abc import Iterable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from PIL import Image, ImageOps

Rotation = int


@dataclass(slots=True)
class PreprocessedOrientation:
    """Container for a single orientation variant produced by the preprocessing pipeline."""

    rotation: Rotation
    processed: np.ndarray
    binary: np.ndarray
    angle_correction: float
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def debug(self) -> dict[str, Any]:
        """Shallow debug snapshot safe for JSON serialisation."""
        return {
            "rotation": self.rotation,
            "angle": float(self.angle_correction),
            "digits": int(self.metadata.get("digit_candidates", 0)),
        }


@dataclass(slots=True)
class PreprocessResult:
    """Aggregated preprocessing result for an upload."""

    orientations: list[PreprocessedOrientation]
    enhanced: bool

    def best_orientation(self) -> PreprocessedOrientation:
        """Return the orientation with the highest digit score (ties favour lower rotation)."""
        if not self.orientations:
            raise ValueError("no orientations preprocessed")
        return max(
            self.orientations,
            key=lambda item: (
                item.metadata.get("score", 0.0),
                -abs(item.angle_correction),
            ),
        )


def _load_source(source: str | Path | np.ndarray | bytes) -> np.ndarray:
    if isinstance(source, np.ndarray):
        image = source
    else:
        if isinstance(source, str | Path):
            path = Path(source)
            if not path.exists():
                raise FileNotFoundError(path)
            pil = Image.open(path)
        elif isinstance(source, (bytes | bytearray)):
            pil = Image.open(io.BytesIO(source))
        else:
            raise TypeError(f"Unsupported source type: {type(source)!r}")
        pil = ImageOps.exif_transpose(pil)
        image = cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)
    return image


def _rotate(image: np.ndarray, rotation: Rotation) -> np.ndarray:
    if rotation == 0:
        return image
    if rotation == 90:
        return cv2.rotate(image, cv2.ROTATE_90_CLOCKWISE)
    if rotation == 180:
        return cv2.rotate(image, cv2.ROTATE_180)
    if rotation == 270:
        return cv2.rotate(image, cv2.ROTATE_90_COUNTERCLOCKWISE)
    raise ValueError(f"Unsupported rotation {rotation}")


def _deskew(gray: np.ndarray) -> tuple[np.ndarray, float]:
    coords = np.column_stack(np.where(gray < 250))
    if coords.size == 0:
        return gray, 0.0
    rect = cv2.minAreaRect(coords)
    angle = rect[-1]
    if angle < -45:
        angle = 90 + angle
    center = (gray.shape[1] / 2, gray.shape[0] / 2)
    matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(
        gray,
        matrix,
        (gray.shape[1], gray.shape[0]),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )
    return rotated, angle


def _auto_contrast(image: np.ndarray) -> np.ndarray:
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    lightness_channel, channel_a, channel_b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    lightness_channel = clahe.apply(lightness_channel)
    merged = cv2.merge((lightness_channel, channel_a, channel_b))
    return cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)


def _gamma_correction(image: np.ndarray, gamma: float = 1.1) -> np.ndarray:
    gamma = max(gamma, 0.1)
    inv_gamma = 1.0 / gamma
    table = np.array(
        [(i / 255.0) ** inv_gamma * 255 for i in np.arange(0, 256)]
    ).astype("uint8")
    return cv2.LUT(image, table)


def _enhance_low_resolution(image: np.ndarray) -> np.ndarray:
    height, width = image.shape[:2]
    if max(height, width) >= 1600:
        return image
    scale = 1600 / max(height, width)
    if scale <= 1.1:
        return image
    resized = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]], dtype=np.float32)
    return cv2.filter2D(resized, -1, kernel)


def _adaptive_threshold(gray: np.ndarray) -> np.ndarray:
    try:
        from cv2 import ximgproc  # type: ignore
    except ImportError:
        ximgproc = None

    if ximgproc is not None:
        try:
            return ximgproc.niBlackThreshold(
                gray,
                255,
                cv2.THRESH_BINARY,
                41,
                -0.2,
                binarizationMethod=ximgproc.BINARIZATION_SAUVOLA,
            )
        except Exception:  # pragma: no cover - safety fallback
            pass

    adaptive = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 35, 15
    )
    _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return cv2.bitwise_or(adaptive, otsu)


def _morphology(binary: np.ndarray) -> np.ndarray:
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    closed = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=1)
    opened = cv2.morphologyEx(closed, cv2.MORPH_OPEN, kernel, iterations=1)
    return opened


def _trim_whitespace(image: np.ndarray) -> np.ndarray:
    coords = cv2.findNonZero(255 - image)
    if coords is None:
        return image
    x, y, w, h = cv2.boundingRect(coords)
    margin = 4
    x = max(x - margin, 0)
    y = max(y - margin, 0)
    w = min(w + 2 * margin, image.shape[1] - x)
    h = min(h + 2 * margin, image.shape[0] - y)
    return image[y : y + h, x : x + w]


def _estimate_digit_candidates(binary: np.ndarray) -> tuple[int, float]:
    contours, _ = cv2.findContours(
        255 - binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    digit_like = 0
    total_area = 0
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        if h < 12 or w < 6:
            continue
        aspect = w / float(h)
        if 0.15 <= aspect <= 1.2:
            digit_like += 1
            total_area += w * h
    density = total_area / (binary.shape[0] * binary.shape[1])
    return digit_like, density


def preprocess_image(
    source: str | Path | np.ndarray | bytes,
    *,
    enhance: bool = False,
    rotations: Iterable[Rotation] = (0, 90, 180, 270),
) -> PreprocessResult:
    """Prepare an image for OCR, generating orientation candidates and optional enhancement."""
    original = _load_source(source)
    if enhance:
        original = _enhance_low_resolution(original)
        original = _auto_contrast(original)
        original = _gamma_correction(original, gamma=1.1)

    orientations: list[PreprocessedOrientation] = []
    for rotation in rotations:
        rotated = _rotate(original, rotation)
        gray = cv2.cvtColor(rotated, cv2.COLOR_BGR2GRAY)
        denoised = cv2.fastNlMeansDenoising(
            gray, h=15, templateWindowSize=7, searchWindowSize=21
        )
        binary = _adaptive_threshold(denoised)
        morphed = _morphology(binary)
        trimmed = _trim_whitespace(morphed)
        deskewed, angle = _deskew(trimmed)
        final = deskewed
        digits, density = _estimate_digit_candidates(final)
        score = digits + density * 10
        orientations.append(
            PreprocessedOrientation(
                rotation=rotation,
                processed=final,
                binary=final,
                angle_correction=angle,
                metadata={
                    "digit_candidates": digits,
                    "density": density,
                    "score": score,
                    "enhance": enhance,
                },
            )
        )

    orientations.sort(key=lambda item: item.metadata.get("score", 0.0), reverse=True)
    return PreprocessResult(orientations=orientations, enhanced=enhance)


__all__ = [
    "PreprocessResult",
    "PreprocessedOrientation",
    "preprocess_image",
]
