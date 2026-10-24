"""End-to-end analysis of an uploaded FDR document: pages, OCR, fields, forensics, hash."""

import io
import time
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from app.config import get_settings
from app.services.documents.extract import ExtractedField, FieldExtractor
from app.services.documents.features import Token
from app.services.documents.forensics import (
    ForensicsResult,
    Localiser,
    analyse,
    fit,
    perceptual_hash,
)

ALLOWED_MIME = {"application/pdf", "image/png", "image/jpeg"}
MAX_BYTES = 12 * 1024 * 1024


class UnsupportedDocument(ValueError):
    pass


def sniff_mime(data: bytes) -> str:
    if data[:5] == b"%PDF-":
        return "application/pdf"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    raise UnsupportedDocument("Upload a PDF, PNG or JPEG file.")


def pages_from_bytes(data: bytes, max_pages: int = 3) -> list[np.ndarray]:
    if len(data) > MAX_BYTES:
        raise UnsupportedDocument("The file is larger than 12 MB.")
    mime = sniff_mime(data)
    if mime == "application/pdf":
        import pypdfium2 as pdfium

        pdf = pdfium.PdfDocument(io.BytesIO(data))
        out = []
        for i in range(min(len(pdf), max_pages)):
            page = pdf[i]
            pil = page.render(scale=150 / 72).to_pil().convert("RGB")
            out.append(np.asarray(pil))
        return out
    arr = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if arr is None:
        raise UnsupportedDocument("The image could not be read.")
    return [cv2.cvtColor(arr, cv2.COLOR_BGR2RGB)]


@lru_cache(maxsize=1)
def _ocr() -> Any:
    from rapidocr_onnxruntime import RapidOCR

    return RapidOCR()


def ocr(rgb: np.ndarray) -> list[Token]:
    result, _ = _ocr()(rgb)
    tokens = []
    for quad, text, conf in result or []:
        xs = [p[0] for p in quad]
        ys = [p[1] for p in quad]
        tokens.append(Token(text, (min(xs), min(ys), max(xs), max(ys)), float(conf)))
    return tokens


@lru_cache(maxsize=1)
def models() -> tuple[FieldExtractor, Localiser]:
    root = Path(get_settings().models_dir)
    return FieldExtractor(root / "field_extractor.txt"), Localiser(root / "localiser.onnx")


@dataclass
class Analysis:
    image: np.ndarray
    tokens: list[Token]
    fields: dict[str, ExtractedField]
    forensics: ForensicsResult
    phash: str
    model_versions: dict[str, str]
    duration_ms: int


def analyse_document(data: bytes) -> Analysis:
    started = time.perf_counter()
    page = fit(pages_from_bytes(data)[0])
    tokens = ocr(page)
    extractor, localiser = models()
    fields = extractor.extract(tokens, page.shape[1], page.shape[0])
    forensics = analyse(page, localiser)
    return Analysis(
        image=page,
        tokens=tokens,
        fields=fields,
        forensics=forensics,
        phash=perceptual_hash(page),
        model_versions={
            "ocr": "rapidocr-onnxruntime PP-OCR",
            "extractor": extractor.version,
            "forensics": forensics.method,
        },
        duration_ms=int((time.perf_counter() - started) * 1000),
    )
