"""Structured field extraction from OCR spans."""

from __future__ import annotations

import re
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from typing import Any

from .recognize import OCRSpan

_LINE_TOLERANCE_PX = 14

COMPANY_KEYWORDS = (
    "株式会社",
    "有限会社",
    "合同会社",
    "Inc",
    "Co.",
    "Company",
    "Corporation",
)

ISSUE_DATE_LABELS = ("発行日", "発行年月日", "請求日", "Invoice Date")
DUE_DATE_LABELS = ("支払期日", "支払期限", "お支払期日", "Payment Due")
LINE_HEADERS = ("品目", "内容", "明細", "数量", "単価", "金額")

DATE_PATTERN = re.compile(
    r"(?P<year>20\d{2}|19\d{2})[./年-]?\s*(?P<month>\d{1,2})[./月-]?\s*(?P<day>\d{1,2})日?"
)
NUMBER_PATTERN = re.compile(r"-?\d[\d,\.]*")


@dataclass(slots=True)
class _Line:
    y: float
    tokens: list[str]

    @property
    def text(self) -> str:
        return " ".join(self.tokens).strip()


def _mean(values: Iterable[int]) -> float:
    values = list(values)
    if not values:
        return 0.0
    return sum(values) / len(values)


def _line_key(span: OCRSpan) -> float:
    ys = [pt[1] for pt in span.bbox or [] if isinstance(pt, tuple)]
    if not ys:
        return 0.0
    return _mean(ys)


def _group_lines(spans: Sequence[OCRSpan]) -> list[_Line]:
    sorted_spans = sorted(
        spans, key=lambda span: (_line_key(span), span.bbox[0][0] if span.bbox else 0)
    )
    buckets: list[list[OCRSpan]] = []
    for span in sorted_spans:
        if not buckets:
            buckets.append([span])
            continue
        last_bucket = buckets[-1]
        if abs(_line_key(last_bucket[-1]) - _line_key(span)) <= _LINE_TOLERANCE_PX:
            last_bucket.append(span)
        else:
            buckets.append([span])

    lines: list[_Line] = []
    for bucket in buckets:
        tokens = [span.text.strip() for span in bucket if span.text.strip()]
        if tokens:
            lines.append(
                _Line(y=_mean([_line_key(span) for span in bucket]), tokens=tokens)
            )
    return lines


def _normalize_date(raw: str) -> str | None:
    match = DATE_PATTERN.search(raw)
    if not match:
        return None
    year = int(match.group("year"))
    month = int(match.group("month"))
    day = int(match.group("day"))
    try:
        return f"{year:04d}-{month:02d}-{day:02d}"
    except ValueError:
        return None


def _parse_number(raw: str | None) -> float | None:
    if raw is None:
        return None
    candidate = (
        raw.replace(",", "").replace("円", "").replace("¥", "").replace("￥", "")
    )
    candidate = candidate.replace("−", "-").strip()
    if not candidate:
        return None
    try:
        return float(candidate)
    except ValueError:
        match = NUMBER_PATTERN.search(candidate)
        if match:
            try:
                return float(match.group().replace(",", ""))
            except ValueError:
                return None
        return None


def _find_line(lines: list[_Line], labels: Sequence[str]) -> _Line | None:
    for line in lines:
        joined = line.text
        for label in labels:
            if label in joined:
                return line
    return None


def _extract_amount_from_line(line: _Line | None) -> float | None:
    if line is None:
        return None
    for token in reversed(line.tokens):
        value = _parse_number(token)
        if value is not None:
            return value
    return None


def _detect_line_item(line: _Line) -> dict[str, Any] | None:
    numeric_tokens = [
        (idx, token)
        for idx, token in enumerate(line.tokens)
        if NUMBER_PATTERN.search(token)
    ]
    if len(numeric_tokens) < 2:
        return None

    description_tokens = line.tokens[: numeric_tokens[0][0]]
    description = " ".join(description_tokens).strip(" :：")
    if not description:
        description = line.text

    amount_value = _parse_number(numeric_tokens[-1][1])
    quantity_value = None
    unit_price_value = None

    if len(numeric_tokens) >= 3:
        quantity_value = _parse_number(numeric_tokens[-3][1])
        unit_price_value = _parse_number(numeric_tokens[-2][1])
    elif len(numeric_tokens) == 2:
        quantity_value = _parse_number(numeric_tokens[0][1])
        unit_price_value = None

    return {
        "description": description,
        "quantity": quantity_value,
        "unit_price": unit_price_value,
        "amount": amount_value,
    }


def extract_structured_fields(spans: Sequence[OCRSpan]) -> dict[str, Any]:
    """Return structured fields (vendor, dates, line items) parsed from OCR spans."""
    if not spans:
        return {
            "vendor": None,
            "issue_date": None,
            "due_date": None,
            "line_items": [],
            "totals": {},
        }

    lines = _group_lines(spans)
    vendor = None
    for line in lines[:5]:
        if any(keyword in line.text for keyword in COMPANY_KEYWORDS):
            vendor = line.text
            break
    if vendor is None and lines:
        vendor = lines[0].text

    issue_line = _find_line(lines, ISSUE_DATE_LABELS)
    issue_date = _normalize_date(issue_line.text) if issue_line else None

    due_line = _find_line(lines, DUE_DATE_LABELS)
    due_date = _normalize_date(due_line.text) if due_line else None

    header_index = None
    for idx, line in enumerate(lines[:10]):
        if sum(1 for header in LINE_HEADERS if header in line.text) >= 2:
            header_index = idx
            break

    detail_lines = lines[header_index + 1 :] if header_index is not None else lines
    line_items: list[dict[str, Any]] = []
    for line in detail_lines:
        candidate = _detect_line_item(line)
        if not candidate:
            continue
        if candidate["amount"] is None:
            continue
        line_items.append(candidate)

    totals: dict[str, Any] = {}
    total_line = _find_line(lines, ("合計", "Total", "請求金額"))
    totals["total"] = _extract_amount_from_line(total_line)
    subtotal_line = _find_line(lines, ("小計", "Subtotal"))
    totals["subtotal"] = _extract_amount_from_line(subtotal_line)
    tax_line = _find_line(lines, ("消費税", "税額", "Tax"))
    totals["tax"] = _extract_amount_from_line(tax_line)

    return {
        "vendor": vendor,
        "issue_date": issue_date,
        "due_date": due_date,
        "line_items": line_items,
        "totals": totals,
    }


__all__ = ["extract_structured_fields"]
