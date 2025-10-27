from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .repo import Repo
from .routes import create_router

_ALLOWED_ORIGINS = ["http://localhost:5173"]


def _default_data_dir() -> Path:
    base = os.getenv("API_DATA_DIR")
    if base:
        return Path(base)
    return Path(__file__).resolve().parents[2] / "data"


def create_app(repo: Repo | None = None) -> FastAPI:
    instance = repo or Repo(_default_data_dir())
    app = FastAPI(title="Zimusyoku API")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(create_router(instance), prefix="/api")
    return app


app = create_app()


__all__ = ["app", "create_app"]
