from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, Field, field_validator


class AccountCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    token: str = Field(min_length=10)
    urn: str = Field(min_length=3, max_length=255)
    is_active: bool = True


class AccountUpdate(BaseModel):
    token: str | None = None
    urn: str | None = None
    is_active: bool | None = None


class AccountOut(BaseModel):
    id: int
    name: str
    urn: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ScheduleCreate(BaseModel):
    account_id: int
    topic: str = Field(min_length=2, max_length=255)
    cron_expr: str = Field(min_length=9, max_length=120)
    timezone: str = "America/Sao_Paulo"
    is_active: bool = True


class ScheduleUpdate(BaseModel):
    topic: str | None = None
    cron_expr: str | None = None
    timezone: str | None = None
    is_active: bool | None = None


class ScheduleOut(BaseModel):
    id: int
    account_id: int
    topic: str
    cron_expr: str
    timezone: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ManualJobCreate(BaseModel):
    account_id: int
    topic: str | None = None
    paper_url: str | None = None
    paper_text: str | None = None

    @field_validator("paper_url")
    @classmethod
    def normalize_url(cls, value: str | None) -> str | None:
        if value:
            return value.strip()
        return value

    @field_validator("paper_text")
    @classmethod
    def normalize_text(cls, value: str | None) -> str | None:
        if value:
            return value.strip()
        return value


class JobOut(BaseModel):
    id: int
    account_id: int
    source: str
    status: str
    topic: str | None
    paper_url: str | None
    generated_post: str | None
    error_message: str | None
    attempts: int
    max_attempts: int
    scheduled_for: datetime
    next_retry_at: datetime | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
