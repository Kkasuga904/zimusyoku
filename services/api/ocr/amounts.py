"""Heuristics to extract monetary amounts from OCR spans."""

from __future__ import annotations

import math
import re
import unicodedata
from dataclasses import dataclass
from typing import Iterable, List, Optional, Sequence

from .recognize import OCRSpan

TOTAL_KEYWORDS = ["合計", "総合計", "請求金額", "お支払金額", "お支払い金額", "合計金額", "税込", "請求額"]
SUBTOTAL_KEYWORDS = ["小計", "税抜", "税別", "小計金額"]
TAX_KEYWORDS = ["税", "消費税", "内税", "外税", "税額", "消費税額"]
CURRENCY_KEYWORDS = ["円", "¥", "￥", "JPY"]
NUMBER_PATTERN = re.compile(r"(?<!\d)(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?")


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
    def rightness(self) -> float:
        return self.x + self.width / 2


@dataclass(slots=True)
class AmountCandidate:
    value: int
    score: float
    token: Token
    label: str
    has_keyword: bool

    def to_dict(self) -> dict:
        return {
            "value": self.value,
            "score": self.score,
            "label": self.label,
            "text": self.token.text,
            "bbox": self.token.span.bbox,
        }


def _normalize(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)
    replacements = {
        "，": ",",
        "．": ".",
        "円": "円",
        "¥": "¥",
        "￥": "¥",
    }
    for src, dst in replacements.items():
        text = text.replace(src, dst)
    return text


def _tokenize(spans: Sequence[OCRSpan]) -> list[Token]:
    tokens: list[Token] = []
    for span in spans:
        parts = span.text.splitlines() or [span.text]
        bbox = span.bbox or [(0, 0), (0, 0), (0, 0), (0, 0)]
        xs = [pt[0] for pt in bbox]
        ys = [pt[1] for pt in bbox]
        width = max(xs) - min(xs) if xs else 0
        height = max(ys) - min(ys) if ys else 0
        base_x = min(xs) if xs else 0
        base_y = min(ys) if ys else 0
        for index, part in enumerate(parts):
            text = part.strip()
            if not text:
                continue
            normalized = _normalize(text)
            offset_y = base_y + (height / len(parts)) * index
            tokens.append(
                Token(
                    text=text,
                    normalized=normalized,
                    x=float(base_x),
                    y=float(offset_y),
                    width=float(width),
                    height=float(height / max(len(parts), 1)),
                    span=span,
                )
            )
    return tokens


def _parse_number(match: re.Match[str]) -> int:
    integer, decimal = match.group(1), match.group(2)
    integer = integer.replace(",", "")
    value = int(integer)
    if decimal:
        value = int(round(value + float(f"0.{decimal}")))
    return value


def _find_keyword_score(token: Token, neighbours: Iterable[Token], keywords: list[str]) -> float:
    score = 0.0
    for keyword in keywords:
        if keyword in token.normalized:
            score += 1.5
    sorted_neighbours = sorted(neighbours, key=lambda other: math.hypot(token.x - other.x, token.y - other.y))
    for idx, neighbour in enumerate(sorted_neighbours[:5]):
        for keyword in keywords:
            if keyword in neighbour.normalized:
                score += 1.2 / (idx + 1)
                break
    return score


def _candidate_from_token(token: Token, label: str, neighbours: Iterable[Token]) -> list[AmountCandidate]:
    candidates: list[AmountCandidate] = []
    for match in NUMBER_PATTERN.finditer(token.normalized):
        value = _parse_number(match)
        score = 1.0
        has_keyword = False
        keyword_score = _find_keyword_score(token, neighbours, {
            "total": TOTAL_KEYWORDS,
            "subtotal": SUBTOTAL_KEYWORDS,
            "tax": TAX_KEYWORDS,
        }[label])
        if keyword_score > 0:
            has_keyword = True
            score += 3.0 + keyword_score
        candidates.append(
            AmountCandidate(
                value=value,
                score=score,
                token=token,
                label=label,
                has_keyword=has_keyword,
            )
        )
    return candidates


def _score_candidates(tokens: list[Token]) -> dict[str, list[AmountCandidate]]:
    totals: list[AmountCandidate] = []
    subtotals: list[AmountCandidate] = []
    taxes: list[AmountCandidate] = []
    for token in tokens:
        neighbours = [other for other in tokens if other is not token]
        totals.extend(_candidate_from_token(token, "total", neighbours))
        subtotals.extend(_candidate_from_token(token, "subtotal", neighbours))
        taxes.extend(_candidate_from_token(token, "tax", neighbours))

    def postprocess(candidates: list[AmountCandidate]) -> list[AmountCandidate]:
        if not candidates:
            return candidates
        max_value = max(candidate.value for candidate in candidates)
        for candidate in candidates:
            if candidate.value == max_value:
                candidate.score += 2.0
            if candidate.token.rightness > 0.6:
                candidate.score += 1.0
        return sorted(candidates, key=lambda item: item.score, reverse=True)

    return {
        "total": postprocess(totals),
        "subtotal": postprocess(subtotals),
        "tax": postprocess(taxes),
    }


def _select_best(candidates: list[AmountCandidate]) -> Optional[AmountCandidate]:
    return candidates[0] if candidates else None


def _consistency_check(subtotal: Optional[int], tax: Optional[int], total: Optional[int]) -> bool:
    if subtotal is None or tax is None or total is None:
        return True
    return abs((subtotal + tax) - total) <= 1


def extract_amounts(spans: Sequence[OCRSpan]) -> dict[str, object]:
    tokens = _tokenize(spans)
    scores = _score_candidates(tokens)

    total_candidate = _select_best(scores["total"])
    subtotal_candidate = _select_best(scores["subtotal"])
    tax_candidate = _select_best(scores["tax"])

    if total_candidate is None and subtotal_candidate and tax_candidate:
        implied_total = subtotal_candidate.value + tax_candidate.value
        total_candidate = AmountCandidate(
            value=implied_total,
            score=subtotal_candidate.score + tax_candidate.score,
            token=subtotal_candidate.token,
            label="total",
            has_keyword=False,
        )

    if total_candidate and (subtotal_candidate or tax_candidate):
        if not _consistency_check(
            subtotal_candidate.value if subtotal_candidate else None,
            tax_candidate.value if tax_candidate else None,
            total_candidate.value,
        ):
            # Penalise inconsistent totals but keep candidates list
            total_candidate.score -= 2.0

    candidates_payload: list[dict] = []
    for label, collection in scores.items():
        for candidate in collection[:5]:
            payload = candidate.to_dict()
            payload["type"] = label
            candidates_payload.append(payload)

    result = {
        "currency": "JPY",
        "subtotal": subtotal_candidate.value if subtotal_candidate else None,
        "tax": tax_candidate.value if tax_candidate else None,
        "total": total_candidate.value if total_candidate else None,
        "candidates": candidates_payload,
        "vendor": None,
        "invoice_date": None,
        "debug": {
            "token_count": len(tokens),
            "total_score": total_candidate.score if total_candidate else 0.0,
        },
    }
    keyword_regions = []
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

    result["debug"].update(
        {
            "keyword_regions": keyword_regions,
        }
    )
    return result


__all__ = [
    "extract_amounts",
]
