from __future__ import annotations

from pathlib import Path

from PIL import Image, PngImagePlugin
from services.ocr.main import OCRResult, extract_fields, perform_ocr


def _create_png(path: Path, text: str) -> None:
    image = Image.new("RGB", (120, 120), color="white")
    info = PngImagePlugin.PngInfo()
    info.add_text("description", text)
    image.save(path, "PNG", pnginfo=info)


def test_perform_ocr_extracts_key_fields(tmp_path: Path) -> None:
    payload = "\n".join(
        [
            "Vendor: Metro Transport",
            "Total: 12,345",
            "Tax: 1,234",
            "Date: 2025-08-01",
            "Category: 交通費",
        ]
    )
    image_path = tmp_path / "invoice.png"
    _create_png(image_path, payload)

    result = perform_ocr(image_path, language="eng")

    assert isinstance(result, OCRResult)
    assert "Metro Transport" in result.text
    assert result.fields["vendor"] == "Metro Transport"
    assert result.fields["amount"] == 12345.0
    assert result.fields["tax"] == 1234.0
    assert result.fields["date"] == "2025-08-01"
    assert result.fields["category"] == "交通費"


def test_extract_fields_handles_missing_values() -> None:
    text = "Vendor: Example Corp\nTotal: 1000"
    fields = extract_fields(text)

    assert fields["vendor"] == "Example Corp"
    assert fields["amount"] == 1000.0
    assert fields["tax"] is None
