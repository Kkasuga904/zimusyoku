from __future__ import annotations

import importlib
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image, PngImagePlugin
from services.accounting.classify import classify_document


def _reset_service_modules() -> None:
    for module_name in list(sys.modules):
        if module_name.startswith("services.api") or module_name.startswith("services.ocr") or module_name.startswith("services.accounting"):
            sys.modules.pop(module_name)


def _create_sample_image(path: Path, *, vendor: str, amount: int, tax: int, category: str) -> None:
    payload = "\n".join(
        [
            f"Vendor: {vendor}",
            f"Total: {amount}",
            f"Tax: {tax}",
            "Date: 2025-08-01",
            f"Category: {category}",
        ]
    )

    image = Image.new("RGB", (160, 160), color="white")
    info = PngImagePlugin.PngInfo()
    info.add_text("description", payload)
    image.save(path, "PNG", pnginfo=info)


def _create_drawn_image(path: Path, *, vendor: str, amount: int, tax: int, category: str) -> None:
    from PIL import Image, ImageDraw

    image = Image.new("RGB", (480, 240), color="white")
    draw = ImageDraw.Draw(image)
    lines = [
        f"Vendor: {vendor}",
        f"Total: {amount}",
        f"Tax: {tax}",
        "Date: 2025-08-15",
        f"Category: {category}",
    ]

    y = 24
    for line in lines:
        draw.text((20, y), line, fill="black")
        y += 32

    image.save(path, "PNG")


@pytest.fixture()
def api_client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    data_dir = tmp_path / "data"
    monkeypatch.setenv("DATA_DIR", str(data_dir))
    monkeypatch.setenv("API_FORCE_EAGER", "1")
    monkeypatch.setenv("API_AUTH_ENABLED", "1")
    monkeypatch.setenv("API_DEFAULT_USER_EMAIL", "admin@example.com")
    monkeypatch.setenv("API_DEFAULT_USER_PASSWORD", "adminpass")

    _reset_service_modules()

    from services.api import config as config_module

    config_module.get_settings.cache_clear()  # type: ignore[attr-defined]

    import services.accounting.main as accounting_main
    import services.api.celery_app as celery_app
    import services.api.dependencies as dependencies
    import services.ocr.worker as ocr_worker

    importlib.reload(config_module)
    importlib.reload(accounting_main)
    importlib.reload(dependencies)
    importlib.reload(celery_app)
    importlib.reload(ocr_worker)

    dependencies._job_store.cache_clear()  # type: ignore[attr-defined]

    from services.api.app import create_app

    app = create_app()
    return TestClient(app)


def _authenticate(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/api/auth/token",
        json={"email": "admin@example.com", "password": "adminpass"},
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_full_pipeline_flow(api_client: TestClient, tmp_path: Path) -> None:
    headers = _authenticate(api_client)

    image_path = tmp_path / "receipt.png"
    _create_sample_image(
        image_path,
        vendor="Metro Transport",
        amount=12345,
        tax=1123,
        category="交通費",
    )

    with image_path.open("rb") as handle:
        response = api_client.post(
            "/api/ocr/upload",
            data={"document_type": "invoice"},
            files={"document": ("receipt.png", handle, "image/png")},
            headers=headers,
        )

    assert response.status_code == 202
    payload = response.json()
    job_id = payload["job"]["id"]

    jobs_response = api_client.get("/api/jobs", headers=headers)
    assert jobs_response.status_code == 200
    jobs_payload = jobs_response.json()["jobs"]
    assert jobs_payload
    job_entry = jobs_payload[0]
    assert job_entry["classification"]

    csv_response = api_client.get("/api/jobs/export.csv", headers=headers)
    assert csv_response.status_code == 200
    assert job_id in csv_response.text

    summary_response = api_client.get("/api/summary", headers=headers)
    assert summary_response.status_code == 200
    summary = summary_response.json()
    assert summary["journal_count"] == 1
    assert summary["total_spend"] >= 12345


def test_classification_rules() -> None:
    text = "Taxi fare for Osaka client visit"
    fields = {"vendor": "Osaka Taxi", "amount": 1200, "tax": 120}
    result = classify_document(text=text, fields=fields, document_type="receipt")

    assert result["category"] in {"交通費", "旅費交通費"}
    assert result["amount_gross"] == 1200
    assert result["tax"] == 120


def test_pipeline_uses_rapidocr_when_metadata_missing(
    api_client: TestClient,
    tmp_path: Path,
) -> None:
    rapidocr = pytest.importorskip("rapidocr_onnxruntime")
    assert rapidocr is not None  # appease linters

    headers = _authenticate(api_client)
    image_path = tmp_path / "drawn.png"
    vendor = "Kyoto Taxi"
    amount = 6789
    tax = 678
    _create_drawn_image(
        image_path,
        vendor=vendor,
        amount=amount,
        tax=tax,
        category="交通費",
    )

    with image_path.open("rb") as handle:
        response = api_client.post(
            "/api/ocr/upload",
            data={"document_type": "receipt"},
            files={"document": ("drawn.png", handle, "image/png")},
            headers=headers,
        )

    assert response.status_code == 202
    jobs_response = api_client.get("/api/jobs", headers=headers)
    assert jobs_response.status_code == 200
    jobs_payload = jobs_response.json()["jobs"]
    assert jobs_payload
    job_entry = next((item for item in jobs_payload if item["fileName"] == "drawn.png"), None)
    assert job_entry is not None
    journal = job_entry["journalEntry"]
    assert journal is not None
    assert pytest.approx(journal["amount_gross"], rel=0.01) == float(amount)
    assert pytest.approx(journal["tax"], rel=0.05) == float(tax)
