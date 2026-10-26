"""Legacy register import: read a spreadsheet, reconcile it against Pramaan, write nothing.

The sample register is synthetic. It is drawn from Pramaan's own demo records and then roughened
the way hand-kept registers are: numbers typed with spaces and dashes, amounts in words, dates in
four styles, abbreviated bank names, a few mistyped values, repeated rows, blanks, and deposits
Pramaan does not hold.
"""

import csv
import io
import random
from datetime import date

from openpyxl import Workbook, load_workbook
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.reconcile import Finding, Known, LegacyRow, normalise_number, read_rows, reconcile
from app.models import Bank, Institution, Instrument

MAX_ROWS = 20_000
HEADER = [
    "S.No.",
    "Name of Institution",
    "Permanent ID",
    "Bank",
    "FDR No.",
    "Amount (Rs.)",
    "Date of FDR",
    "Valid Upto",
    "Remarks",
]
SHORT_BANK = {
    "Bharat National Bank": "BNB",
    "State Bank of India": "SBI",
}


async def known_records(db: AsyncSession) -> list[Known]:
    rows = await db.execute(
        select(
            Instrument.id,
            Instrument.number,
            Instrument.amount_paise,
            Instrument.issue_date,
            Instrument.maturity_date,
            Institution.name,
        ).join(Institution, Institution.id == Instrument.institution_id)
    )
    out = []
    for i, number, amount, issue, maturity, inst in rows:
        n = normalise_number(number)
        if n:
            out.append(Known(i, n, amount, issue, maturity, inst))
    return out


def read_upload(filename: str, data: bytes) -> tuple[dict[str, int], list[LegacyRow]]:
    if filename.lower().endswith((".xlsx", ".xlsm")):
        wb = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
        ws = wb.worksheets[0]
        rows = ws.iter_rows(values_only=True, max_row=MAX_ROWS)
        return read_rows(list(rows))
    text = data.decode("utf-8-sig", errors="replace")
    return read_rows(list(csv.reader(io.StringIO(text)))[:MAX_ROWS])


def run(known: list[Known], rows: list[LegacyRow]) -> list[Finding]:
    return reconcile(rows, known)


def _indian(rupees: int) -> str:
    s = str(rupees)
    if len(s) <= 3:
        return s
    head, tail = s[:-3], s[-3:]
    groups = []
    while len(head) > 2:
        groups.insert(0, head[-2:])
        head = head[:-2]
    if head:
        groups.insert(0, head)
    return ",".join(groups) + "," + tail


def _number_style(n: str, rng: random.Random) -> str:
    style = rng.random()
    if style < 0.25:
        return " ".join(n[i : i + 4] for i in range(0, len(n), 4))
    if style < 0.4:
        return "-".join(n[i : i + 4] for i in range(0, len(n), 4))
    if style < 0.5:
        return "FDR/" + n
    return n


def _amount_style(paise: int, rng: random.Random) -> object:
    rupees = paise // 100
    style = rng.random()
    if style < 0.3:
        return rupees
    if style < 0.6:
        return f"Rs. {_indian(rupees)}/-"
    if style < 0.8 and rupees % 1_00_000 == 0:
        return f"{rupees // 1_00_000} lakh"
    return _indian(rupees)


def _date_style(d: date, rng: random.Random) -> object:
    style = rng.random()
    if style < 0.35:
        return d
    if style < 0.6:
        return d.strftime("%d/%m/%Y")
    if style < 0.8:
        return d.strftime("%d-%b-%y")
    return d.strftime("%d.%m.%Y")


async def sample_register(db: AsyncSession, size: int = 1000) -> bytes:
    rng = random.Random(2026)  # noqa: S311 (synthetic data, not security)
    rows = (
        await db.execute(
            select(
                Instrument.number,
                Instrument.amount_paise,
                Instrument.issue_date,
                Instrument.maturity_date,
                Institution.name,
                Institution.aicte_id,
                Bank.name,
            )
            .join(Institution, Institution.id == Instrument.institution_id)
            .join(Bank, Bank.id == Instrument.bank_id)
            .order_by(Instrument.id)
        )
    ).all()
    picked = rng.sample(list(rows), min(size, len(rows)))
    out: list[list[object]] = []
    for number, amount, issue, maturity, inst, aicte_id, bank in picked:
        remarks = ""
        roll = rng.random()
        if roll < 0.04:
            # A mistyped digit in the amount.
            s = str(amount // 100)
            i = rng.randrange(len(s))
            amount = int(s[:i] + str((int(s[i]) + rng.randint(1, 8)) % 10) + s[i + 1 :]) * 100
        elif roll < 0.06:
            maturity = maturity.replace(year=maturity.year + 1)
            remarks = "Renewed?"
        elif roll < 0.08:
            maturity = None
            remarks = "Copy awaited"
        row: list[object] = [
            0,
            inst,
            aicte_id,
            SHORT_BANK.get(bank, bank) if rng.random() < 0.4 else bank,
            "" if rng.random() < 0.012 else _number_style(number, rng),
            _amount_style(amount, rng),
            _date_style(issue, rng),
            _date_style(maturity, rng) if maturity else "",
            remarks,
        ]
        out.append(row)
        if rng.random() < 0.02:
            out.append(list(row))
    for _ in range(28):
        n = str(rng.randrange(10**13, 10**14))
        issue = date(2024, rng.randint(1, 12), rng.randint(1, 28))
        out.append(
            [
                0,
                rng.choice(picked)[4],
                "",
                rng.choice(["SBI", "Canara Bank", "Punjab National Bank"]),
                n,
                _amount_style(rng.choice([5, 10, 15, 35]) * 1_00_000 * 100, rng),
                _date_style(issue, rng),
                _date_style(issue.replace(year=issue.year + 5), rng),
                "Old file, not on portal",
            ]
        )
    rng.shuffle(out)
    wb = Workbook()
    ws = wb.active
    assert ws is not None
    ws.title = "FDR register"
    ws.append(["Register of security deposits held (compiled from desk files)"])
    ws.append(["Synthetic sample for the Pramaan prototype. Not real data."])
    ws.append([])
    ws.append(HEADER)
    for i, row in enumerate(out, start=1):
        row[0] = i
        ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
