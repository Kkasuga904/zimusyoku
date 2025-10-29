"""FastAPI dependency providers."""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from services.api.approvals import ApprovalStore
from services.integrations import BankAPIClient, FreeeAPIClient, YayoiSaaSClient

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


@lru_cache(maxsize=1)
def _approval_store() -> ApprovalStore:
    settings = get_settings()
    return ApprovalStore(settings.approvals_path)


def get_approval_store() -> ApprovalStore:
    return _approval_store()


@lru_cache(maxsize=1)
def _freee_client() -> FreeeAPIClient:
    settings = get_settings()
    return FreeeAPIClient(settings.integrations_dir / "freee")


def get_freee_client() -> FreeeAPIClient:
    return _freee_client()


@lru_cache(maxsize=1)
def _yayoi_client() -> YayoiSaaSClient:
    settings = get_settings()
    return YayoiSaaSClient(settings.integrations_dir / "yayoi")


def get_yayoi_client() -> YayoiSaaSClient:
    return _yayoi_client()


@lru_cache(maxsize=1)
def _bank_client() -> BankAPIClient:
    settings = get_settings()
    return BankAPIClient(settings.integrations_dir / "bank")


def get_bank_client() -> BankAPIClient:
    return _bank_client()


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
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
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
