from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AutoFeedr API"
    app_env: str = "dev"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    app_debug: bool = True

    database_url: str = "postgresql+psycopg://autofeedr:autofeedr@postgres:5432/autofeedr"
    token_encryption_key: str = ""

    cors_origins: str = "http://localhost:5173"

    default_timezone: str = "America/Sao_Paulo"
    worker_poll_seconds: int = 15
    worker_max_attempts: int = 3

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
