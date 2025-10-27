from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient
from services.api.main import create_app
from services.api.repo import Repo


def _client(tmp_path: Path) -> TestClient:
    repo = Repo(tmp_path)
    app = create_app(repo)
    return TestClient(app)


def test_create_list_and_get_job(tmp_path: Path) -> None:
    client = _client(tmp_path)

    create_response = client.post("/api/jobs", json={"title": "Sample job"})
    assert create_response.status_code == 201
    job = create_response.json()
    job_id = job["id"]
    assert job["status"] == "queued"

    list_response = client.get("/api/jobs")
    assert list_response.status_code == 200
    jobs = list_response.json()
    assert any(entry["id"] == job_id for entry in jobs)

    detail_response = client.get(f"/api/jobs/{job_id}")
    assert detail_response.status_code == 200
    detail = detail_response.json()
    assert detail["id"] == job_id
    assert detail["logs"], "Job details should include an audit trail"


def test_upload_creates_job_and_stores_file(tmp_path: Path) -> None:
    client = _client(tmp_path)

    upload_response = client.post(
        "/api/uploads",
        files={"file": ("demo.txt", b"payload", "text/plain")},
    )
    assert upload_response.status_code == 200
    payload = upload_response.json()
    stored = tmp_path / "uploads" / payload["stored_name"]
    assert stored.exists(), "Upload should be written to the data directory"

    detail_response = client.get(f"/api/jobs/{payload['job_id']}")
    assert detail_response.status_code == 200
    assert detail_response.json()["title"].startswith("process:")
