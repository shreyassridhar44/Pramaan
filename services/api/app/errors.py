"""Consistent error responses: every error carries a code, a message and the request ID."""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import ORJSONResponse
from starlette.exceptions import HTTPException

from app.observability import request_id_var


class DomainError(Exception):
    """A rule or state-machine refusal that the user can act on."""

    status_code = 409

    def __init__(self, code: str, message: str, details: dict[str, object] | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details or {}


def _body(code: str, message: str, details: object | None = None) -> dict[str, object]:
    return {
        "error": {
            "code": code,
            "message": message,
            "details": details,
            "request_id": request_id_var.get(),
        }
    }


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def domain_error(_: Request, exc: DomainError) -> ORJSONResponse:
        return ORJSONResponse(_body(exc.code, exc.message, exc.details), exc.status_code)

    @app.exception_handler(HTTPException)
    async def http_error(_: Request, exc: HTTPException) -> ORJSONResponse:
        code = {401: "unauthenticated", 403: "forbidden", 404: "not_found"}.get(
            exc.status_code, "http_error"
        )
        return ORJSONResponse(_body(code, str(exc.detail)), exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError) -> ORJSONResponse:
        return ORJSONResponse(
            _body("invalid_request", "Some fields are missing or invalid.", exc.errors()), 422
        )

    @app.exception_handler(Exception)
    async def unhandled(_: Request, exc: Exception) -> ORJSONResponse:
        logging.getLogger("pramaan").exception("unhandled error", exc_info=exc)
        return ORJSONResponse(
            _body("internal_error", "Something went wrong on our side. Try again."), 500
        )
