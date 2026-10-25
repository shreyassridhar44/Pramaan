from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration. Values come from the environment or a local .env file."""

    model_config = SettingsConfigDict(env_file=(".env", "../../.env"), extra="ignore")

    environment: Literal["local", "test", "production"] = "local"
    demo_mode: bool = True
    log_level: str = "INFO"

    database_url: str = "postgresql+asyncpg://pramaan:pramaan@localhost:5432/pramaan"
    redis_url: str = "redis://localhost:6379/0"

    session_secret: str = Field(default="dev-only-session-secret-change-me", min_length=16)
    session_idle_minutes_officer: int = 480
    session_idle_minutes_other: int = 120

    storage_backend: Literal["s3", "local"] = "local"
    storage_local_dir: str = "../../.data/storage"
    storage_bucket: str = "pramaan-docs"
    aws_region: str = "ap-south-1"

    # Ed25519 private key for letter tokens. Local runs generate one under .data/keys if unset.
    letter_signing_key_b64: str | None = None
    # Origin of the public verify page encoded in letter QR codes.
    public_base_url: str = "http://localhost:5173"

    email_backend: Literal["smtp", "ses"] = "smtp"
    smtp_host: str = "localhost"
    smtp_port: int = 1025
    email_from: str = "Pramaan <no-reply@pramaan.local>"

    bedrock_model_id: str = "in.anthropic.claude-haiku-4-5-20251001-v1:0"
    bedrock_enabled: bool = False

    models_dir: str = "../../ml/models"
    cors_origins: list[str] = ["http://localhost:5173"]
    allow_demo_in_production: bool = False

    @field_validator("database_url")
    @classmethod
    def _use_async_driver(cls, value: str) -> str:
        """Accept plain or psycopg Postgres URLs (as AWS and CI often provide) and use asyncpg."""
        for prefix in ("postgresql+psycopg://", "postgresql://", "postgres://"):
            if value.startswith(prefix):
                return "postgresql+asyncpg://" + value[len(prefix) :]
        return value

    @model_validator(mode="after")
    def _production_requires_real_secrets(self) -> "Settings":
        if self.environment == "production":
            if self.session_secret.startswith("dev-only"):
                raise ValueError("SESSION_SECRET must be set in production")
            if not self.letter_signing_key_b64:
                raise ValueError("LETTER_SIGNING_KEY_B64 must be set in production")
            if self.demo_mode and not self.allow_demo_in_production:
                raise ValueError("DEMO_MODE in production needs ALLOW_DEMO_IN_PRODUCTION=true")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
