from datetime import date

from app.domain.reconcile import (
    Known,
    map_columns,
    normalise_number,
    parse_amount,
    parse_date,
    read_rows,
    reconcile,
)


def test_amounts_in_register_styles() -> None:
    assert parse_amount("Rs. 15,00,000/-") == 15_00_000_00
    assert parse_amount("15 lakh") == 15_00_000_00
    assert parse_amount("1.5 Cr") == 1_50_00_000_00
    assert parse_amount(1500000) == 15_00_000_00
    assert parse_amount("fifteen") is None


def test_dates_in_register_styles() -> None:
    d = date(2026, 10, 20)
    assert parse_date("20/10/2026") == d
    assert parse_date("20-Oct-26") == d
    assert parse_date("20.10.2026") == d
    assert parse_date("2026-10-20") == d
    assert parse_date("31/02/2026") is None


def test_numbers_and_headers() -> None:
    assert normalise_number("FDR/6422-6103 4588 12") == "64226103458812"
    cols = map_columns(
        ["S.No.", "Name of Institution", "Bank", "FDR No.", "Amount (Rs.)", "Valid Upto"]
    )
    assert cols["number"] == 3 and cols["amount"] == 4 and cols["maturity"] == 5


def test_reconcile_sorts_rows_into_outcomes() -> None:
    known = [Known(1, "111122223333", 15_00_000_00, date(2024, 1, 1), date(2029, 1, 1), "A")]
    _, rows = read_rows(
        [
            ["Register"],
            ["FDR No.", "Amount", "Date of FDR", "Valid Upto"],
            ["1111 2222 3333", "15 lakh", "01/01/2024", "01/01/2029"],
            ["1111-2222-3333", "15 lakh", "01/01/2024", "01/01/2029"],
            ["999988887777", "5 lakh", "01/01/2024", "01/01/2029"],
            ["", "5 lakh", "", ""],
        ]
    )
    outcomes = [f.outcome for f in reconcile(rows, known)]
    assert outcomes == ["match", "duplicate", "new", "incomplete"]
    differs = reconcile(
        read_rows([["FDR No.", "Amount", "Valid Upto"], ["111122223333", "35 lakh", "01/01/2029"]])[
            1
        ],
        known,
    )
    assert differs[0].outcome == "differs"
    assert differs[0].differences[0][0] == "amount_paise"
