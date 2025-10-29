"""Tests for structured OCR detail extraction."""

from __future__ import annotations

from services.api.ocr.details import extract_structured_fields
from services.api.ocr.recognize import OCRSpan


def _span(text: str, x: int, y: int, w: int = 100, h: int = 20) -> OCRSpan:
    bbox = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
    return OCRSpan(text=text, confidence=0.95, bbox=bbox)


def test_extract_structured_fields_invoice():
    spans = [
        _span("株式会社テスト商事", 10, 10, 180, 28),
        _span("請求書", 220, 10, 80, 28),
        _span("発行日 2024/04/01", 10, 60, 220, 24),
        _span("支払期日 2024/04/30", 10, 90, 240, 24),
        _span("品目", 10, 140, 60, 20),
        _span("数量", 120, 140, 60, 20),
        _span("単価", 220, 140, 60, 20),
        _span("金額", 320, 140, 60, 20),
        _span("設計サービス", 10, 180, 140, 20),
        _span("10", 160, 180, 30, 20),
        _span("5,000", 220, 180, 60, 20),
        _span("50,000", 320, 180, 80, 20),
        _span("保守サポート", 10, 210, 160, 20),
        _span("1", 160, 210, 30, 20),
        _span("30,000", 220, 210, 80, 20),
        _span("30,000", 320, 210, 80, 20),
        _span("小計 80,000", 10, 260, 140, 20),
        _span("消費税 8,000", 10, 290, 140, 20),
        _span("合計 88,000", 10, 320, 160, 20),
    ]

    structured = extract_structured_fields(spans)

    assert structured["vendor"] == "株式会社テスト商事"
    assert structured["issue_date"] == "2024-04-01"
    assert structured["due_date"] == "2024-04-30"

    line_items = structured["line_items"]
    assert len(line_items) == 2
    assert line_items[0]["description"].startswith("設計サービス")
    assert line_items[0]["quantity"] == 10
    assert line_items[0]["unit_price"] == 5000
    assert line_items[0]["amount"] == 50000

    totals = structured["totals"]
    assert totals["subtotal"] == 80000
    assert totals["tax"] == 8000
    assert totals["total"] == 88000


def test_extract_structured_fields_handles_missing_spans():
    structured = extract_structured_fields([])
    assert structured["vendor"] is None
    assert structured["line_items"] == []
