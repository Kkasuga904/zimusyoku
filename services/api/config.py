"""Configuration helpers for the API service."""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


def _as_bool(value: str | None, *, default: bool) -> bool:
    if value is None:
        return default

    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False

    return default


@dataclass(frozen=True)
class Settings:
    """Runtime configuration values."""

    data_dir: Path
    ocr_dir: Path
    journal_path: Path
    jobs_path: Path
    celery_broker_url: str
    celery_result_backend: str
    celery_task_always_eager: bool
    jwt_secret: str
    jwt_algorithm: str
    access_token_minutes: int
    auth_enabled: bool
    default_user_email: str
    default_user_password: str

    def ensure_directories(self) -> None:
        """Create required directories when missing."""
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.ocr_dir.mkdir(parents=True, exist_ok=True)
        self.journal_path.parent.mkdir(parents=True, exist_ok=True)
        self.jobs_path.parent.mkdir(parents=True, exist_ok=True)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Load settings once per process."""
    data_root = Path(os.environ.get("DATA_DIR", "data")).resolve()

    broker = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")
    backend = os.environ.get("CELERY_RESULT_BACKEND", broker)

    return Settings(
        data_dir=data_root,
        ocr_dir=(data_root / "ocr"),
        journal_path=(data_root / "journal.json"),
        jobs_path=(data_root / "jobs.json"),
        celery_broker_url=broker,
        celery_result_backend=backend,
        celery_task_always_eager=_as_bool(
            os.environ.get("CELERY_TASK_ALWAYS_EAGER"),
            default=_as_bool(os.environ.get("API_FORCE_EAGER"), default=True),
        ),
        jwt_secret=os.environ.get("API_JWT_SECRET", "dev-secret"),
        jwt_algorithm=os.environ.get("API_JWT_ALGORITHM", "HS256"),
        access_token_minutes=int(os.environ.get("API_JWT_EXPIRES_MINUTES", "60")),
        auth_enabled=_as_bool(os.environ.get("API_AUTH_ENABLED"), default=True),
        default_user_email=os.environ.get("API_DEFAULT_USER_EMAIL", "admin@example.com"),
        default_user_password=os.environ.get("API_DEFAULT_USER_PASSWORD", "adminpass"),
    )
