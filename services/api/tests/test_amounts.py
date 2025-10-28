from __future__ import annotations

from typing import List

from services.api.ocr.amounts import extract_amounts
from services.api.ocr.recognize import OCRSpan


def make_span(text: str, x: int, y: int, width: int = 120, height: int = 24, conf: float = 0.9) -> OCRSpan:
    bbox = [(x, y), (x + width, y), (x + width, y + height), (x, y + height)]
    return OCRSpan(text=text, confidence=conf, bbox=bbox)


def test_extract_amounts_prefers_keyword_alignment() -> None:
    spans: List[OCRSpan] = [
        make_span("合計", 50, 10),
        make_span("¥123,456", 220, 10),
        make_span("小計 110,000", 40, 60),
        make_span("税 13,456", 40, 90),
    ]

    result = extract_amounts(spans)

    assert result["total"] == 123456
    assert result["subtotal"] == 110000
    assert result["tax"] == 13456


def test_extract_amounts_infers_total_from_subtotal_tax() -> None:
    spans = [
        make_span("小計", 20, 20),
        make_span("99,800", 200, 20),
        make_span("税額", 20, 60),
        make_span("9,980", 200, 60),
    ]

    result = extract_amounts(spans)

    assert result["subtotal"] == 99800
    assert result["tax"] == 9980
    # total is inferred
    assert result["total"] == 109780


def test_extract_amounts_handles_plain_digits_and_currency_word() -> None:
    spans = [
        make_span("請求金額", 10, 10),
        make_span("123456 円", 210, 10),
    ]

    result = extract_amounts(spans)

    assert result["total"] == 123456


def test_extract_amounts_returns_candidates_even_when_missing_total() -> None:
    spans = [
        make_span("小計", 20, 20),
        make_span("5,000", 220, 20),
        make_span("調整額", 20, 60),
        make_span("500", 220, 60),
    ]

    result = extract_amounts(spans)

    assert result["total"] is None
    assert len(result["candidates"]) > 0

