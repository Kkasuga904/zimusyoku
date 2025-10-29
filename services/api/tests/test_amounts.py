from __future__ import annotations

from services.api.ocr.amounts import extract_amounts, extract_amounts_from_text
from services.api.ocr.recognize import OCRSpan


def _span(text: str, x: int, y: int, confidence: float = 0.92) -> OCRSpan:
    bbox = [(x, y), (x + 80, y), (x + 80, y + 20), (x, y + 20)]
    return OCRSpan(text=text, confidence=confidence, bbox=bbox)


def test_text_fallback_detects_total_subtotal_tax() -> None:
    text = "\n".join(["合計 123,456", "小計 110,000", "消費税 13,456"])
    result = extract_amounts_from_text(text)

    assert result["total"] == 123456
    assert result["subtotal"] == 110000
    assert result["tax"] == 13456


def test_text_fallback_infers_total_when_missing() -> None:
    text = "\n".join(["小計 99,800", "税額 9,980"])
    result = extract_amounts_from_text(text)

    assert result["subtotal"] == 99800
    assert result["tax"] == 9980
    assert result["total"] == 109780


def test_text_fallback_accepts_full_width_digits() -> None:
    text = "請求金額\n１２３４５円"
    result = extract_amounts_from_text(text)

    assert result["total"] == 12345


def test_text_fallback_accepts_plain_number_without_comma() -> None:
    text = "合計 12345 円"
    result = extract_amounts_from_text(text)

    assert result["total"] == 12345


def test_text_fallback_accepts_negative_totals() -> None:
    text = "合計 -12,000円"
    result = extract_amounts_from_text(text)

    assert result["total"] == -12000


def test_text_fallback_handles_tax_inclusive_and_exclusive() -> None:
    text = "\n".join(["小計 10000円", "消費税 1000円", "税込 11000円"])
    result = extract_amounts_from_text(text)

    assert result["subtotal"] == 10000
    assert result["tax"] == 1000
    assert result["total"] == 11000


def test_extract_amounts_prefers_rightmost_high_confidence_candidate() -> None:
    spans = [
        _span("合計 10000", 10, 10, confidence=0.60),
        _span("合計 20000", 420, 10, confidence=0.65),
        _span("小計 18000", 420, 40, confidence=0.70),
        _span("消費税 2000", 420, 70, confidence=0.68),
    ]
    result = extract_amounts(spans)

    assert result["total"] == 20000
    assert result["subtotal"] == 18000
    assert result["tax"] == 2000
    assert result["fields"]["confidence"] is not None
