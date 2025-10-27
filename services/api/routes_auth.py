"""Authentication endpoints."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt

from .config import Settings, get_settings
from .models import Credentials, TokenResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _verify_credentials(credentials: Credentials, settings: Settings) -> None:
    if not settings.auth_enabled:
        return
    if (
        credentials.email != settings.default_user_email
        or credentials.password != settings.default_user_password
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        ) from None


SettingsDep = Annotated[Settings, Depends(get_settings)]


@router.post("/token", response_model=TokenResponse)
def issue_token(
    credentials: Credentials,
    settings: SettingsDep,
) -> TokenResponse:
    _verify_credentials(credentials, settings)
    expires_delta = timedelta(minutes=settings.access_token_minutes)
    expire = datetime.utcnow() + expires_delta
    payload = {"sub": settings.default_user_email, "exp": expire}
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return TokenResponse(access_token=token)
