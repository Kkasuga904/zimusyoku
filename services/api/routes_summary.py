"""Summary dashboard API."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from services.accounting.main import compute_summary

from .dependencies import get_current_user_token
from .models import (
    SummaryAccountTotal,
    SummaryBucket,
    SummaryCategoryBreakdown,
    SummaryMonthlyTotal,
    SummaryResponse,
)

router = APIRouter(prefix="/api/summary", tags=["summary"])


@router.get("", response_model=SummaryResponse)
def get_summary(_: str = Depends(get_current_user_token)) -> SummaryResponse:
    data = compute_summary()
    breakdown = [SummaryBucket(**item) for item in data.get("breakdown", [])]
    monthly = [SummaryMonthlyTotal(**item) for item in data.get("monthly_totals", [])]
    ratios = [
        SummaryCategoryBreakdown(**item) for item in data.get("category_ratios", [])
    ]
    top_accounts = [
        SummaryAccountTotal(**item) for item in data.get("top_accounts", [])
    ]
    return SummaryResponse(
        month=data["month"],
        total_spend=data["total_spend"],
        journal_count=data["journal_count"],
        breakdown=breakdown,
        category_ratios=ratios,
        approval_rate=data.get("approval_rate", 0.0),
        monthly_totals=monthly,
        top_accounts=top_accounts,
    )
