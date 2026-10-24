from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import (
    actions,
    audit,
    auth,
    demo,
    documents,
    health,
    institutions,
    instruments,
    meta,
    portal,
    portfolio,
    public,
)
from app.config import get_settings
from app.errors import install_error_handlers
from app.observability import RequestContextMiddleware, configure_logging
from app.readiness import register_default_checks


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)

    app = FastAPI(
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
        portfolio,
        instruments,
        actions,
        institutions,
        documents,
        portal,
        audit,
        demo,
    ):
        v1.include_router(module.router)
    app.include_router(v1)
    return app


app = create_app()
