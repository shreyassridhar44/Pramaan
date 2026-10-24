import io
import json
from pathlib import Path

import cv2
import numpy as np
import pytest
from PIL import Image

from app.domain.provenance import normalise
from app.domain.types import FieldName
from app.services.documents import forensics
from app.services.documents.extract import extract_rules
from app.services.documents.pipeline import UnsupportedDocument, ocr, pages_from_bytes, sniff_mime

FIX = Path(__file__).parent / "fixtures"
TRUTH = json.loads((FIX / "fdr_fixtures.json").read_text(encoding="utf-8"))


def _rgb(name: str) -> np.ndarray:
    return cv2.cvtColor(cv2.imread(str(FIX / name)), cv2.COLOR_BGR2RGB)


class TestUploads:
    def test_sniffs_by_content_not_extension(self) -> None:
        assert sniff_mime((FIX / "fdr_genuine.jpg").read_bytes()) == "image/jpeg"
        with pytest.raises(UnsupportedDocument):
            sniff_mime(b"MZ\x90\x00 not a document")

    def test_pdf_pages_are_rendered(self) -> None:
        buf = io.BytesIO()
        Image.fromarray(_rgb("fdr_genuine.jpg")).save(buf, format="PDF", resolution=150)
        pages = pages_from_bytes(buf.getvalue())
        assert len(pages) == 1
        assert pages[0].shape[2] == 3

    def test_oversized_upload_is_refused(self) -> None:
        with pytest.raises(UnsupportedDocument, match="12 MB"):
            pages_from_bytes(b"%PDF-" + b"0" * (13 * 1024 * 1024))


class TestForensics:
    def test_classical_heatmap_matches_image_size(self) -> None:
        img = _rgb("fdr_tampered.jpg")
        result = forensics.analyse(img, forensics.Localiser(None))
        assert result.heatmap.shape == img.shape[:2]
        assert result.method == "classical-1"
        assert result.heatmap.min() >= 0.0 and result.heatmap.max() <= 1.0

    def test_perceptual_hash_survives_recompression_and_separates_documents(self) -> None:
        a = _rgb("fdr_genuine.jpg")
        _, buf = cv2.imencode(".jpg", a, [cv2.IMWRITE_JPEG_QUALITY, 60])
        a2 = cv2.imdecode(buf, cv2.IMREAD_COLOR)
        assert forensics.hamming(forensics.perceptual_hash(a), forensics.perceptual_hash(a2)) <= 6
        blank = np.full_like(a, 245)
        assert (
            forensics.hamming(forensics.perceptual_hash(a), forensics.perceptual_hash(blank)) > 10
        )

    def test_heatmap_png_is_rgba(self) -> None:
        png = forensics.heatmap_png(np.random.default_rng(0).random((40, 60)).astype(np.float32))
        img = cv2.imdecode(np.frombuffer(png, np.uint8), cv2.IMREAD_UNCHANGED)
        assert img.shape == (40, 60, 4)


@pytest.mark.slow
class TestOcrExtraction:
    def test_rules_extract_key_fields_from_genuine_scan(self) -> None:
        img = _rgb("fdr_genuine.jpg")
        tokens = ocr(img)
        fields = extract_rules(tokens, img.shape[1], img.shape[0])
        assert normalise(FieldName.IFSC, fields["ifsc"].value) == TRUTH["ifsc"]
        assert normalise(FieldName.AMOUNT, fields["amount"].value) == str(
            TRUTH["amount_rupees"] * 100
        )

    def test_tampered_amount_is_read_as_the_altered_value(self) -> None:
        img = _rgb("fdr_tampered.jpg")
        tokens = ocr(img)
        fields = extract_rules(tokens, img.shape[1], img.shape[0])
        assert "amount" in fields
        assert normalise(FieldName.AMOUNT, fields["amount"].value) != str(
            TRUTH["amount_rupees"] * 100
        )
