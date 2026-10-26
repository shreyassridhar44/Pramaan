import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import (
    actions,
    audit,
    auth,
    bank,
    demo,
    documents,
    health,
    institutions,
    instruments,
    letters,
    meta,
    monitoring,
    portal,
    portfolio,
    public,
    releases,
    reports,
    rules,
    search,
)
from app.config import get_settings
from app.errors import install_error_handlers
from app.observability import RequestContextMiddleware, configure_logging
from app.readiness import register_default_checks


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """In production, load the OCR and the trained models in the background at start-up, so the
    first upload does not pay for loading them."""
    if get_settings().environment == "production":
        from app.services.documents.pipeline import _ocr, models

        def warm() -> None:
            models()
            _ocr()

        app.state.warmup = asyncio.create_task(asyncio.to_thread(warm))
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)

    app = FastAPI(
        lifespan=lifespan,
        title="Pramaan API",
        version="0.1.0",
        description="Security deposit and FDR management for the AICTE Regulation Bureau.",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
    )
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    install_error_handlers(app)
    register_default_checks()

    v1 = APIRouter(prefix="/api/v1")
    for module in (
        health,
        auth,
        public,
        meta,
        monitoring,
        portfolio,
        instruments,
        bank,
        actions,
        institutions,
        documents,
        portal,
        releases,
        letters,
        reports,
        rules,
        search,
        audit,
        demo,
    ):
        v1.include_router(module.router)
    app.include_router(v1)
    return app


app = create_app()
