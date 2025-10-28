"""FastAPI dependency providers."""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from .config import Settings, get_settings
from .jobs import JobStore

logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")


@lru_cache(maxsize=1)
def _job_store() -> JobStore:
    settings = get_settings()
    return JobStore(settings.jobs_path)


def get_job_store() -> JobStore:
    return _job_store()


def get_settings_dep() -> Settings:
    return get_settings()


TokenDep = Annotated[str, Depends(oauth2_scheme)]
SettingsDep = Annotated[Settings, Depends(get_settings_dep)]

def get_current_user_token(
    token: TokenDep,
    settings: SettingsDep,
) -> str:
    if not settings.auth_enabled:
        return "anonymous"

    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        logger.warning("JWT decode failed for token: %s", token)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        ) from None

    email = payload.get("sub")
    if email != settings.default_user_email:
        logger.warning(
            "JWT subject mismatch: expected=%s actual=%s",
            settings.default_user_email,
            email,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        ) from None
    return email
