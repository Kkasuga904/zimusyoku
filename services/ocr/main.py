"""OCR helpers using PaddleOCR / Tesseract with safe fallbacks."""

from __future__ import annotations

import json
import logging
import re
from collections.abc import Callable, Iterable
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


class OCRProcessingError(RuntimeError):
    """Raised when OCR cannot be completed."""


@dataclass
class OCRResult:
    text: str
    fields: dict[str, Any]

    def to_json(self) -> str:
        return json.dumps(asdict(self), ensure_ascii=False, indent=2)


ExtractFn = Callable[[Path, str], str | None]


def _with_paddle(path: Path, language: str) -> str | None:
    try:
        from paddleocr import PaddleOCR  # type: ignore
    except Exception:  # pragma: no cover - optional dependency
        return None

    try:
        ocr = PaddleOCR(
            lang="japan" if language.startswith("jp") else "en",
            use_angle_cls=True,
            show_log=False,
        )
        result = ocr.ocr(str(path), cls=True)  # type: ignore[call-arg]
    except Exception as exc:  # pragma: no cover - runtime guard
        logger.debug("PaddleOCR failed: %s", exc)
        return None

    lines: list[str] = []
    for page in result or []:
        for entry in page or []:
            try:
                lines.append(entry[1][0])
            except Exception:
                continue
    text = "\n".join(lines).strip()
    return text or None


def _with_tesseract(path: Path, language: str) -> str | None:
    try:
        import pytesseract
        from PIL import Image
    except Exception:  # pragma: no cover - optional dependency
        return None

    try:
        image = Image.open(path)
    except Exception as exc:  # pragma: no cover - runtime guard
        logger.debug("Failed reading image for tesseract: %s", exc)
        return None

    try:
        text = pytesseract.image_to_string(image, lang=language)
    except Exception as exc:  # pragma: no cover - runtime guard
        logger.debug("Tesseract extraction failed: %s", exc)
        return None

    return text.strip() or None


def _with_rapidocr(path: Path, _: str) -> str | None:
    try:
        from rapidocr_onnxruntime import RapidOCR
    except Exception:  # pragma: no cover - optional dependency
        return None

    try:
        ocr = RapidOCR()
    except Exception as exc:  # pragma: no cover - runtime guard
        logger.debug("RapidOCR initialization failed: %s", exc)
        return None

    try:
        result, _ = ocr(str(path))
    except Exception as exc:  # pragma: no cover - runtime guard
        logger.debug("RapidOCR extraction failed: %s", exc)
        return None

    lines: list[str] = []
    for entry in result or []:
        try:
            text = entry[1]
        except (IndexError, TypeError):
            continue
        if text:
            lines.append(str(text))
    content = "\n".join(lines).strip()
    return content or None


def _from_metadata(path: Path, _: str) -> str | None:
    try:
        from PIL import Image
    except Exception:  # pragma: no cover - optional dependency
        return None

    try:
        image = Image.open(path)
    except Exception as exc:  # pragma: no cover - runtime guard
        logger.debug("Metadata reader failed to open image: %s", exc)
        return None

    info = getattr(image, "info", {}) or {}
    candidates = []
    for key in ("description", "text", "comment", "ocr", "note"):
        if key in info:
            candidates.append(str(info[key]))
    text = "\n".join(candidates).strip()
    return text or None


def _from_sidecar(path: Path, _: str) -> str | None:
    sidecar = path.with_suffix(".txt")
    if sidecar.exists():
        return sidecar.read_text(encoding="utf-8").strip()
    return None


EXTRACTORS: tuple[ExtractFn, ...] = (
    _with_paddle,
    _with_tesseract,
    _with_rapidocr,
    _from_metadata,
    _from_sidecar,
)


def extract_text(path: Path, *, language: str = "jpn") -> str:
    """Extract raw text from an image using available strategies."""
    for extractor in EXTRACTORS:
        text = extractor(path, language)
        if text:
            return text
    raise OCRProcessingError(f"OCR extraction failed for {path}")


def _to_float(value: str | None) -> float | None:
    if value is None:
        return None
    cleaned = value.replace(",", "").strip()
    try:
        return float(cleaned)
    except ValueError:
        return None


DATE_PATTERN = re.compile(r"(\d{4}[/-]\d{1,2}[/-]\d{1,2})")
NUMBER_PATTERN = re.compile(r"(\d[\d,]*\.?\d*)")


def _match_line(patterns: Iterable[str], lines: Iterable[str]) -> str | None:
    for pattern in patterns:
        regex = re.compile(pattern, re.IGNORECASE)
        for line in lines:
            match = regex.search(line)
            if match:
                groups = match.groups()
                if groups:
                    return groups[0].strip()
                return match.group().strip()
    return None


def extract_fields(text: str) -> dict[str, Any]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]

    vendor = _match_line(
        (r"(?:Vendor|取引先|会社名)[:：]\s*(.+)", r"^([^\d]+株式会社|有限会社[^\d]+)"),
        lines,
    )

    date_match = DATE_PATTERN.search(text)
    date = date_match.group(1) if date_match else None

    amount_line = _match_line((r"(?:Total|Amount|合計|金額)[:：]?\s*([\d,\.]+)",), lines)
    amount_value = amount_line
    if amount_value is None:
        number_match = NUMBER_PATTERN.search(text or "")
        if number_match:
            amount_value = number_match.group(1)
    amount = _to_float(amount_value)

    tax_line = _match_line(
        (r"(?:Tax|消費税)[:：]?\s*([\d,\.]+)",),
        lines,
    )
    tax = _to_float(tax_line)

    category_line = _match_line(
        (r"(?:Category|区分)[:：]\s*(.+)",),
        lines,
    )

    return {
        "vendor": vendor,
        "date": date,
        "amount": amount,
        "tax": tax,
        "category": category_line,
    }


def perform_ocr(path: Path, *, language: str = "jpn") -> OCRResult:
    """Run OCR and return structured result."""
    text = extract_text(path, language=language)
    fields = extract_fields(text)
    return OCRResult(text=text, fields=fields)


def save_result(result: OCRResult, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(result.to_json(), encoding="utf-8")
