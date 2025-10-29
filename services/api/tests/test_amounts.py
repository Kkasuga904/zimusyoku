from __future__ import annotations

from services.api.ocr.amounts import extract_amounts_from_text

TOTAL = "合計"  # 合計
SUBTOTAL = "小計"  # 小計
TAX = "税額"  # 税額


def test_text_fallback_detects_total_subtotal_tax() -> None:
    text = "\n".join([TOTAL, "\u00a5123,456", f"{SUBTOTAL} 110,000", f"{TAX} 13,456"])
    result = extract_amounts_from_text(text)

    assert result["total"] == 123456
    assert result["subtotal"] == 110000
    assert result["tax"] == 13456


def test_text_fallback_infers_total_when_missing() -> None:
    text = "\n".join([SUBTOTAL, "99,800", f"{TAX} 9,980"])
    result = extract_amounts_from_text(text)

    assert result["subtotal"] == 99800
    assert result["tax"] == 9980
    assert result["total"] == 109780


def test_text_fallback_handles_currency_suffix() -> None:
    text = "\u8acb\u6c42\u91d1\u984d\n123456 \u5186"
    result = extract_amounts_from_text(text)

    assert result["total"] == 123456


def test_text_fallback_skips_small_numbers_without_total() -> None:
    text = "\n".join([SUBTOTAL, "5,000", "\u8abf\u6574\u984d", "500"])
    result = extract_amounts_from_text(text)

    assert result["total"] is None


def test_text_fallback_accepts_full_width_digits() -> None:
    text = "\uff11\uff12\uff13\uff14\uff15\u5186"
    result = extract_amounts_from_text(text)

    assert result["total"] == 12345
