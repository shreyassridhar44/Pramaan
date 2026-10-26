"""Wording of the reminders sent to institutions, in English and Hindi.

The scheduler sends these texts and the officer's preview shows the same texts, so what an
officer sees is what the institution received. Email carries the full body; SMS and WhatsApp
carry the short form.
"""

from dataclasses import dataclass
from datetime import date

from app.domain.provenance import rupees


@dataclass(frozen=True, slots=True)
class Message:
    subject_en: str
    body_en: str
    subject_hi: str
    body_hi: str


def _when_en(offset_days: int) -> str:
    if offset_days == 0:
        return "today"
    return f"in {offset_days} days" if offset_days > 0 else f"{-offset_days} days ago"


def _when_hi(offset_days: int) -> str:
    if offset_days == 0:
        return "आज"
    return f"{offset_days} दिनों में" if offset_days > 0 else f"{-offset_days} दिन पहले"


def maturity_reminder(number: str, amount_paise: int, maturity: date, offset_days: int) -> Message:
    amount = rupees(amount_paise // 100)
    on = f"{maturity:%d %b %Y}"
    return Message(
        subject_en=f"Security deposit {number} matures {_when_en(offset_days)}",
        body_en=(
            f"Your security deposit {number} of {amount} with AICTE matures on {on}. "
            "Submit a renewal or apply for release on the Pramaan portal."
        ),
        subject_hi=f"सुरक्षा जमा {number} की परिपक्वता {_when_hi(offset_days)}",
        body_hi=(
            f"AICTE के पास आपकी {amount} की सुरक्षा जमा {number} की परिपक्वता तिथि {on} है। "
            "कृपया Pramaan पोर्टल पर नवीनीकरण प्रस्तुत करें या वापसी के लिए आवेदन करें।"
        ),
    )
