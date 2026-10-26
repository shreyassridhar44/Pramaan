# Pramaan API and worker image. Build from the repository root so the trained models are included:
#   docker build -f services/api/Dockerfile -t pramaan-api .
FROM python:3.12-slim-bookworm
COPY --from=ghcr.io/astral-sh/uv:0.13.0 /uv /bin/uv

# libgomp1 for LightGBM; GL, GLib and XCB for the full OpenCV that RapidOCR depends on.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 libgl1 libglib2.0-0 libxcb1 \
    && rm -rf /var/lib/apt/lists/*

ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never \
    PYTHONUNBUFFERED=1 PATH="/app/.venv/bin:$PATH"
WORKDIR /app

COPY services/api/pyproject.toml services/api/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY services/api/ ./
COPY ml/models/localiser.onnx ml/models/localiser.json ml/models/field_extractor.txt /app/models/
ENV MODELS_DIR=/app/models STORAGE_LOCAL_DIR=/data/storage

RUN useradd --system --uid 10001 pramaan && mkdir -p /data/storage && chown -R pramaan /data
USER pramaan

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/healthz', timeout=4)"
# Worker processes come from WEB_CONCURRENCY, which uvicorn reads and compose sets.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", \
     "--proxy-headers", "--forwarded-allow-ips", "*"]
