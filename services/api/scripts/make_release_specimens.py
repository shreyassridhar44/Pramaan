"""Writes the synthetic release-application specimens used in demo mode.

Run: uv run python -m scripts.make_release_specimens
"""

from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

OUT = Path(__file__).resolve().parents[1] / "app" / "demo_assets"
INSTITUTION = "Demo Institute of Technology, Pune"
TRUST = "Demo Education Society"
NOTE = "Synthetic specimen for the Pramaan prototype. Not a real document."

BODY = ParagraphStyle("b", fontName="Helvetica", fontSize=10.5, leading=16)
TITLE = ParagraphStyle("t", fontName="Helvetica-Bold", fontSize=14, leading=20)
SMALL = ParagraphStyle("s", fontName="Helvetica-Oblique", fontSize=8, leading=11)

DOCS = {
    "specimen_release_application.pdf": (
        "Request for release of security deposit",
        [
            "To<br/>The Director, Approval Bureau<br/>All India Council for Technical Education, "
            "New Delhi",
            f"Subject: Release of the security deposit of {INSTITUTION}",
            "Sir or Madam,",
            f"{TRUST} requests the release of its joint fixed deposit held in favour of the Member "
            "Secretary, AICTE, which has completed its term. The institution continues to operate "
            "with approval and has no dues to the Council. Affidavit 6, a copy of the deposit and "
            "the latest Letter of Approval are enclosed.",
            "Yours faithfully,<br/>Secretary, " + TRUST,
        ],
    ),
    "specimen_affidavit_6.pdf": (
        "Affidavit 6 (on non-judicial stamp paper)",
        [
            f"I, the Secretary of {TRUST}, which runs {INSTITUTION}, state on oath that:",
            "1. No complaint, court case or proceeding concerning the institution is pending "
            "before any authority to my knowledge.",
            "2. No grant received from AICTE remains unutilised or unaccounted.",
            "3. The security deposit is sought for release after completion of its term in "
            "accordance with the Approval Process Handbook.",
            "Deponent<br/>Verified at Pune.",
        ],
    ),
    "specimen_latest_loa.pdf": (
        "Extension of Approval (specimen)",
        [
            f"Institution: {INSTITUTION}",
            "Academic year: 2026-27",
            "Programmes: Engineering and Technology (UG, PG); Computer Applications (PG)",
            "The institution is granted extension of approval for the academic year 2026-27 "
            "subject to the conditions in the Approval Process Handbook 2024-27.",
        ],
    ),
}


def main() -> None:
    for name, (title, paras) in DOCS.items():
        doc = SimpleDocTemplate(
            str(OUT / name), pagesize=A4, leftMargin=22 * mm, rightMargin=22 * mm
        )
        story = [Paragraph(title, TITLE), Spacer(1, 6 * mm)]
        for p in paras:
            story += [Paragraph(p, BODY), Spacer(1, 3 * mm)]
        story += [Spacer(1, 10 * mm), Paragraph(NOTE, SMALL)]
        doc.build(story)
        print("wrote", name)


if __name__ == "__main__":
    main()
