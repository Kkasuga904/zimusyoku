import pytest
from src.extractor.normalizer import NormalizedRow, batch_normalize, normalize_record


def test_normalize_record_happy_path():
    row = normalize_record({"acct": " 123-ABC ", "amt": "42.0", "currency": "eur"})
    assert row == NormalizedRow(account="123-ABC", amount=42.0, currency="EUR")


def test_normalize_record_missing_amount():
    with pytest.raises(KeyError):
        normalize_record({"account": "ZZZ"})


def test_batch_normalize_deduplicates():
    rows = batch_normalize(
        [
            {"acct": "A", "amt": "1"},
            {"acct": "B", "amt": "2"},
            {"account": "A", "amount": "3"},
        ]
    )
    assert {row.account for row in rows} == {"A", "B"}
    assert any(row.amount == 3.0 for row in rows if row.account == "A")

