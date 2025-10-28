"""Application factory for FastAPI."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routes_accounting import router as accounting_router
from .routes_auth import router as auth_router
from .routes_jobs import router as jobs_router
from .routes_ocr import router as ocr_router
from .routes_summary import router as summary_router


def create_app() -> FastAPI:
    settings = get_settings()
    settings.ensure_directories()

    app = FastAPI(
        title="zimusyoku API",
        version="1.0.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_origin_regex=settings.cors_origin_regex,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth_router)
    app.include_router(ocr_router)
    app.include_router(accounting_router)
    app.include_router(jobs_router)
    app.include_router(summary_router)

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app
