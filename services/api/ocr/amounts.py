"""Heuristics to extract monetary amounts from OCR spans."""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from math import hypot
from typing import Final

from .recognize import OCRSpan

TOTAL_KEYWORDS: Final[list[str]] = [
    "合計",
    "総合計",
    "請求金額",
    "お支払金額",
    "お支払い金額",
    "合計金額",
    "税込",
    "請求額",
]
SUBTOTAL_KEYWORDS: Final[list[str]] = ["小計", "税抜", "税別", "小計金額"]
TAX_KEYWORDS: Final[list[str]] = ["税", "消費税", "内税", "外税", "税額", "消費税額"]
CURRENCY_KEYWORDS: Final[list[str]] = ["円", "¥", "￥", "JPY"]

KEYWORDS_BY_LABEL: Final[dict[str, list[str]]] = {
    "total": TOTAL_KEYWORDS,
    "subtotal": SUBTOTAL_KEYWORDS,
    "tax": TAX_KEYWORDS,
}

NUMBER_PATTERN = re.compile(
    r"(?<!\d)(-?\d{1,3}(?:,\d{3})+|-?\d+)(?:\.(\d{1,2}))?(?=\s*[¥￥円]?)"
)
FALLBACK_NUMBER_PATTERN = re.compile(
    r"(?:[¥￥円]\s*)?(-?\d{1,3}(?:,\d{3})+|-?\d+)(?:\.(\d{1,2}))?"
)

ERA_BASE_YEAR: Final[dict[str, int]] = {
    "令和": 2018,
    "平成": 1988,
    "昭和": 1925,
    "大正": 1911,
    "明治": 1867,
}
ERA_PATTERN = re.compile(r"(令和|平成|昭和|大正|明治)\s*(元|\d{1,2})年")

RIGHT_BIAS_THRESHOLD: Final[float] = 0.65

_MINUS_TRANSLATIONS = str.maketrans(
    {
        "−": "-",
        "―": "-",
        "—": "-",
        "‐": "-",
        "‑": "-",
        "‒": "-",
        "–": "-",
        "－": "-",
        "△": "-",
        "▲": "-",
    }
)


@dataclass(slots=True)
class Token:
    text: str
    normalized: str
    x: float
    y: float
    width: float
    height: float
    span: OCRSpan

    @property
    def right_edge(self) -> float:
        return self.x + self.width

    @property
    def rightness(self) -> float:
        return self.right_edge


@dataclass(slots=True)
class AmountCandidate:
    value: int
    score: float
    token: Token
    label: str
    has_keyword: bool
    right_ratio: float = 0.0

    def to_dict(self) -> dict[str, object]:
        return {
            "value": self.value,
            "score": self.score,
            "label": self.label,
            "text": self.token.text,
            "bbox": self.token.span.bbox,
        }


def _convert_japanese_era(text: str) -> str:
    def repl(match: re.Match[str]) -> str:
        era = match.group(1)
        year_token = match.group(2)
        base = ERA_BASE_YEAR.get(era)
        if base is None:
            return match.group(0)
        year = 1 if year_token == "元" else int(year_token)
        return f"{base + year}年"

    return ERA_PATTERN.sub(repl, text)


def _normalize_currency(text: str) -> str:
    return text.replace("￥", "円").replace("¥", "円")


def _normalize(text: str) -> str:
    canonical = unicodedata.normalize("NFKC", text)
    canonical = _convert_japanese_era(canonical)
    canonical = canonical.translate(_MINUS_TRANSLATIONS)
    canonical = _normalize_currency(canonical)
    canonical = re.sub(r"\s+", "", canonical)
    return canonical


def _tokenize(spans: Sequence[OCRSpan]) -> list[Token]:
    tokens: list[Token] = []
    for span in spans:
        parts = span.text.splitlines() or [span.text]
        bbox = span.bbox or []
        xs = [
            float(point[0])
            for point in bbox
            if isinstance(point, (list | tuple)) and len(point) == 2
        ]
        ys = [
            float(point[1])
            for point in bbox
            if isinstance(point, (list | tuple)) and len(point) == 2
        ]
        width = max(xs) - min(xs) if xs else 0.0
        height = max(ys) - min(ys) if ys else 0.0
        base_x = min(xs) if xs else 0.0
        base_y = min(ys) if ys else 0.0
        line_height = height / max(len(parts), 1) if height else 0.0
        for index, part in enumerate(parts):
            text = part.strip()
            if not text:
                continue
            normalized = _normalize(text)
            offset_y = base_y + line_height * index
            tokens.append(
                Token(
                    text=text,
                    normalized=normalized,
                    x=base_x,
                    y=offset_y,
                    width=width,
                    height=line_height,
                    span=span,
                )
            )
    return tokens


def _parse_number(match: re.Match[str]) -> int:
    integer, decimal = match.group(1), match.group(2)
    value = int(integer.replace(",", ""))
    if decimal:
        value = int(round(value + float(f"0.{decimal}")))
    return value


def _parse_components(integer: str, decimal: str | None) -> int:
    value = int(integer.replace(",", ""))
    if decimal:
        value = int(round(value + float(f"0.{decimal}")))
    return value


def extract_amounts_from_text(text: str) -> dict[str, object]:
    totals: list[int] = []
    subtotals: list[int] = []
    taxes: list[int] = []
    trailing_candidates: list[int] = []
    pending_label: str | None = None

    for raw_line in text.splitlines():
        normalized = _normalize(raw_line)
        if not normalized:
            continue

        label: str | None = None
        for key in ("total", "subtotal", "tax"):
            if any(keyword in normalized for keyword in KEYWORDS_BY_LABEL[key]):
                label = key
                break

        if "-" in normalized and label is None:
            continue

        matches = FALLBACK_NUMBER_PATTERN.findall(normalized)
        if matches:
            values = [
                _parse_components(integer, decimal) for integer, decimal in matches
            ]
            target = label or pending_label
            if target == "total":
                totals.extend(values)
            elif target == "subtotal":
                subtotals.extend(values)
            elif target == "tax":
                taxes.extend(values)
            else:
                trailing_candidates.extend(values)
            pending_label = None
        else:
            pending_label = label or pending_label

    total = totals[-1] if totals else None
    subtotal = subtotals[-1] if subtotals else None
    tax = taxes[-1] if taxes else None

    if total is None and subtotal is not None and tax is not None:
        total = subtotal + tax
    elif total is None and trailing_candidates:
        for value in reversed(trailing_candidates):
            if value >= 100:
                total = value
                break

    return {
        "currency": "JPY",
        "subtotal": subtotal,
        "tax": tax,
        "total": total,
        "candidates": [],
        "vendor": None,
        "invoice_date": None,
        "fields": {"confidence": None},
        "debug": {"source": "text-fallback"},
    }


def _find_keyword_score(
    token: Token,
    neighbours: Iterable[Token],
    keywords: list[str],
) -> float:
    score = 0.0
    if any(keyword in token.normalized for keyword in keywords):
        score += 1.5
    sorted_neighbours = sorted(
        neighbours,
        key=lambda other: hypot(token.x - other.x, token.y - other.y),
    )
    for index, neighbour in enumerate(sorted_neighbours[:5]):
        if any(keyword in neighbour.normalized for keyword in keywords):
            score += 1.2 / (index + 1)
    return score


def _candidate_from_token(
    token: Token,
    label: str,
    neighbours: Iterable[Token],
    max_right: float,
) -> list[AmountCandidate]:
    candidates: list[AmountCandidate] = []
    if max_right <= 0:
        max_right = 1.0
    right_ratio = token.right_edge / max_right
    keyword_score = _find_keyword_score(token, neighbours, KEYWORDS_BY_LABEL[label])
    for match in NUMBER_PATTERN.finditer(token.normalized):
        value = _parse_number(match)
        score = 1.0 + max(token.span.confidence, 0.0) * 2.0
        has_keyword = False
        if right_ratio >= RIGHT_BIAS_THRESHOLD:
            score += 1.0
        if keyword_score > 0.0:
            has_keyword = True
            score += 3.0 + keyword_score
        candidates.append(
            AmountCandidate(
                value=value,
                score=score,
                token=token,
                label=label,
                has_keyword=has_keyword,
                right_ratio=right_ratio,
            )
        )
    return candidates


def _score_candidates(tokens: list[Token]) -> dict[str, list[AmountCandidate]]:
    totals: list[AmountCandidate] = []
    subtotals: list[AmountCandidate] = []
    taxes: list[AmountCandidate] = []

    if not tokens:
        return {"total": [], "subtotal": [], "tax": []}

    max_right = max((token.right_edge for token in tokens), default=0.0)
    if max_right <= 0:
        max_right = 1.0

    for token in tokens:
        neighbours = [other for other in tokens if other is not token]
        totals.extend(_candidate_from_token(token, "total", neighbours, max_right))
        subtotals.extend(
            _candidate_from_token(token, "subtotal", neighbours, max_right)
        )
        taxes.extend(_candidate_from_token(token, "tax", neighbours, max_right))

    def postprocess(collection: list[AmountCandidate]) -> list[AmountCandidate]:
        if not collection:
            return []
        max_value = max(candidate.value for candidate in collection)
        for candidate in collection:
            if candidate.value == max_value:
                candidate.score += 2.0
        return sorted(collection, key=lambda item: item.score, reverse=True)

    return {
        "total": postprocess(totals),
        "subtotal": postprocess(subtotals),
        "tax": postprocess(taxes),
    }


def _select_best(candidates: list[AmountCandidate]) -> AmountCandidate | None:
    return candidates[0] if candidates else None


def _consistency_check(
    subtotal: int | None, tax: int | None, total: int | None
) -> bool:
    if subtotal is None or tax is None or total is None:
        return True
    return abs((subtotal + tax) - total) <= 1


def extract_amounts(spans: Sequence[OCRSpan]) -> dict[str, object]:
    tokens = _tokenize(spans)
    scores = _score_candidates(tokens)

    total_candidates = scores["total"]
    subtotal_candidates = scores["subtotal"]
    tax_candidates = scores["tax"]

    total_candidate = _select_best(total_candidates)
    subtotal_candidate = _select_best(subtotal_candidates)
    tax_candidate = _select_best(tax_candidates)

    if total_candidate is None and subtotal_candidate and tax_candidate:
        implied_value = subtotal_candidate.value + tax_candidate.value
        implied_candidate = AmountCandidate(
            value=implied_value,
            score=subtotal_candidate.score + tax_candidate.score,
            token=subtotal_candidate.token,
            label="total",
            has_keyword=False,
            right_ratio=subtotal_candidate.right_ratio,
        )
        total_candidates = [implied_candidate, *total_candidates]
        scores["total"] = sorted(
            total_candidates, key=lambda item: item.score, reverse=True
        )
        total_candidate = implied_candidate

    if total_candidate and (subtotal_candidate or tax_candidate):
        if not _consistency_check(
            subtotal_candidate.value if subtotal_candidate else None,
            tax_candidate.value if tax_candidate else None,
            total_candidate.value,
        ):
            total_candidate.score -= 2.0

    candidates_payload: list[dict[str, object]] = []
    for label, collection in scores.items():
        for candidate in collection[:5]:
            payload = candidate.to_dict()
            payload["type"] = label
            candidates_payload.append(payload)

    confidence_values = [
        candidate.token.span.confidence
        for candidate in (total_candidate, subtotal_candidate, tax_candidate)
        if candidate is not None
    ]
    fields_confidence = (
        sum(confidence_values) / len(confidence_values) if confidence_values else None
    )

    token_confidences = [max(token.span.confidence, 0.0) for token in tokens]
    avg_token_conf = (
        sum(token_confidences) / len(token_confidences) if token_confidences else None
    )

    result = {
        "currency": "JPY",
        "subtotal": subtotal_candidate.value if subtotal_candidate else None,
        "tax": tax_candidate.value if tax_candidate else None,
        "total": total_candidate.value if total_candidate else None,
        "candidates": candidates_payload,
        "vendor": None,
        "invoice_date": None,
        "fields": {"confidence": fields_confidence},
        "debug": {
            "token_count": len(tokens),
            "total_score": total_candidate.score if total_candidate else 0.0,
            "avg_token_conf": avg_token_conf,
        },
    }

    keyword_regions: list[dict[str, object]] = []
    all_keywords = set(TOTAL_KEYWORDS + SUBTOTAL_KEYWORDS + TAX_KEYWORDS)
    for token in tokens:
        matched = [kw for kw in all_keywords if kw in token.normalized]
        if matched:
            keyword_regions.append(
                {
                    "text": token.text,
                    "normalized": token.normalized,
                    "bbox": token.span.bbox,
                    "keywords": matched,
                }
            )
    result["debug"]["keyword_regions"] = keyword_regions
    return result


__all__ = [
    "extract_amounts",
    "extract_amounts_from_text",
]
