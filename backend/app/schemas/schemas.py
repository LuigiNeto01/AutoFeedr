from __future__ import annotations

import re
from datetime import datetime

from pydantic import BaseModel, Field, field_validator


GITHUB_REPO_SSH_REGEX = re.compile(r"^git@github\.com:[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+(?:\.git)?$")


class AuthRegister(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class AuthLogin(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class AuthUserOut(BaseModel):
    id: int
    email: str
    role: str
    is_active: bool
    has_openai_api_key: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AuthTokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: AuthUserOut


class OpenAIKeyUpdate(BaseModel):
    api_key: str = Field(min_length=20, max_length=500)


class AccountCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    token: str = Field(min_length=10)
    urn: str = Field(min_length=3, max_length=255)
    prompt_generation: str | None = None
    prompt_translation: str | None = None
    is_active: bool = True


class AccountUpdate(BaseModel):
    token: str | None = None
    urn: str | None = None
    prompt_generation: str | None = None
    prompt_translation: str | None = None
    is_active: bool | None = None


class AccountOut(BaseModel):
    id: int
    name: str
    urn: str
    prompt_generation: str | None = None
    prompt_translation: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ScheduleCreate(BaseModel):
    account_id: int
    topic: str = Field(min_length=2, max_length=255)
    cron_expr: str | None = Field(default=None, min_length=9, max_length=120)
    day_of_week: int | None = Field(default=None, ge=0, le=6)
    time_local: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    source_mode: str = "arxiv"
    objective: str | None = Field(default=None, max_length=64)
    audience: str | None = Field(default=None, max_length=120)
    cta_type: str | None = Field(default=None, max_length=32)
    campaign_theme: str | None = Field(default=None, max_length=255)
    use_date_context: bool = True
    timezone: str = "America/Sao_Paulo"
    is_active: bool = True


class ScheduleUpdate(BaseModel):
    topic: str | None = None
    cron_expr: str | None = None
    day_of_week: int | None = Field(default=None, ge=0, le=6)
    time_local: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    timezone: str | None = None
    source_mode: str | None = None
    objective: str | None = None
    audience: str | None = None
    cta_type: str | None = None
    campaign_theme: str | None = None
    use_date_context: bool | None = None
    is_active: bool | None = None


class ScheduleOut(BaseModel):
    id: int
    account_id: int
    topic: str
    cron_expr: str
    day_of_week: int | None = None
    time_local: str | None = None
    source_mode: str | None = None
    objective: str | None = None
    audience: str | None = None
    cta_type: str | None = None
    campaign_theme: str | None = None
    use_date_context: bool | None = None
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


class GitHubAccountCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    ssh_private_key: str = Field(min_length=40)
    ssh_passphrase: str | None = None
    is_active: bool = True


class GitHubAccountUpdate(BaseModel):
    ssh_private_key: str | None = None
    ssh_passphrase: str | None = None
    is_active: bool | None = None


class GitHubAccountOut(BaseModel):
    id: int
    name: str
    has_ssh_key: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class GitHubRepositoryCreate(BaseModel):
    account_id: int
    repo_ssh_url: str
    default_branch: str = Field(default="main", min_length=1, max_length=64)
    solutions_dir: str = Field(default="problems", min_length=1, max_length=255)
    commit_author_name: str = Field(min_length=2, max_length=120)
    commit_author_email: str = Field(min_length=5, max_length=255)
    selection_strategy: str = "random"
    difficulty_policy: str = "random"
    is_active: bool = True

    @field_validator("repo_ssh_url")
    @classmethod
    def validate_repo_ssh_url(cls, value: str) -> str:
        normalized = value.strip()
        if not GITHUB_REPO_SSH_REGEX.match(normalized):
            raise ValueError("Use repo_ssh_url no formato git@github.com:owner/repo.git")
        return normalized

    @field_validator("solutions_dir")
    @classmethod
    def normalize_solutions_dir(cls, value: str) -> str:
        cleaned = value.strip().strip("/")
        if not cleaned:
            raise ValueError("solutions_dir nao pode ser vazio")
        return cleaned


class GitHubRepositoryUpdate(BaseModel):
    default_branch: str | None = Field(default=None, min_length=1, max_length=64)
    solutions_dir: str | None = Field(default=None, min_length=1, max_length=255)
    commit_author_name: str | None = Field(default=None, min_length=2, max_length=120)
    commit_author_email: str | None = Field(default=None, min_length=5, max_length=255)
    selection_strategy: str | None = None
    difficulty_policy: str | None = None
    is_active: bool | None = None

    @field_validator("solutions_dir")
    @classmethod
    def normalize_solutions_dir(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = value.strip().strip("/")
        if not cleaned:
            raise ValueError("solutions_dir nao pode ser vazio")
        return cleaned


class GitHubRepositoryOut(BaseModel):
    id: int
    account_id: int
    repo_ssh_url: str
    default_branch: str
    solutions_dir: str
    commit_author_name: str
    commit_author_email: str
    selection_strategy: str
    difficulty_policy: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LeetCodeRunNowCreate(BaseModel):
    repository_id: int
    selection_strategy: str | None = None
    difficulty_policy: str | None = None
    problem_slug: str | None = None
    max_attempts: int | None = Field(default=None, ge=1, le=10)

    @field_validator("problem_slug")
    @classmethod
    def normalize_problem_slug(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class LeetCodePromptSettingsOut(BaseModel):
    solution_prompt: str | None


class LeetCodePromptSettingsUpdate(BaseModel):
    solution_prompt: str | None = None


class LeetCodeScheduleCreate(BaseModel):
    repository_id: int
    cron_expr: str | None = Field(default=None, min_length=9, max_length=120)
    day_of_week: int | None = Field(default=None, ge=0, le=6)
    time_local: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    timezone: str = "America/Sao_Paulo"
    selection_strategy: str | None = None
    difficulty_policy: str | None = None
    max_attempts: int = Field(default=2, ge=1, le=10)
    is_active: bool = True


class LeetCodeScheduleUpdate(BaseModel):
    cron_expr: str | None = None
    day_of_week: int | None = Field(default=None, ge=0, le=6)
    time_local: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    timezone: str | None = None
    selection_strategy: str | None = None
    difficulty_policy: str | None = None
    max_attempts: int | None = Field(default=None, ge=1, le=10)
    is_active: bool | None = None


class LeetCodeScheduleOut(BaseModel):
    id: int
    repository_id: int
    cron_expr: str
    day_of_week: int | None
    time_local: str | None
    timezone: str
    selection_strategy: str | None
    difficulty_policy: str | None
    max_attempts: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LeetCodeJobOut(BaseModel):
    id: int
    repository_id: int
    schedule_id: int | None
    source: str
    status: str
    attempts: int
    max_attempts: int
    selection_strategy: str | None
    difficulty_policy: str | None
    problem_frontend_id: str | None
    problem_slug: str | None
    problem_title: str | None
    problem_difficulty: str | None
    solution_path: str | None
    tests_path: str | None
    commit_sha: str | None
    commit_url: str | None
    error_message: str | None
    scheduled_for: datetime
    next_retry_at: datetime | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LeetCodeJobLogOut(BaseModel):
    id: int
    job_id: int
    level: str
    message: str
    created_at: datetime

    class Config:
        from_attributes = True


class LeetCodeCompletedOut(BaseModel):
    id: int
    repository_id: int
    job_id: int
    problem_frontend_id: str
    problem_slug: str
    problem_title: str
    problem_difficulty: str
    commit_sha: str
    created_at: datetime

    class Config:
        from_attributes = True


class AdminUserOut(BaseModel):
    id: int
    email: str
    role: str
    is_active: bool
    has_openai_api_key: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AdminUserUpdate(BaseModel):
    role: str | None = None
    is_active: bool | None = None

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str | None) -> str | None:
        if value is None:
            return value
        normalized = value.strip().lower()
        if normalized not in {"user", "admin"}:
            raise ValueError("role deve ser 'user' ou 'admin'")
        return normalized


class AdminUserOverviewCounts(BaseModel):
    linkedin_accounts: int
    github_accounts: int
    github_repositories: int
    linkedin_schedules: int
    leetcode_schedules: int
    linkedin_jobs: int
    leetcode_jobs: int


class AdminUserOverviewOut(BaseModel):
    user: AdminUserOut
    counts: AdminUserOverviewCounts
    linkedin_accounts: list[AccountOut]
    github_accounts: list[GitHubAccountOut]
    github_repositories: list[GitHubRepositoryOut]
    linkedin_schedules: list[ScheduleOut]
    leetcode_schedules: list[LeetCodeScheduleOut]
    recent_linkedin_jobs: list[JobOut]
    recent_leetcode_jobs: list[LeetCodeJobOut]


class AdminAuditLogOut(BaseModel):
    id: int
    admin_user_id: int | None
    action: str
    target_user_id: int | None
    details: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class AdminUnifiedJobOut(BaseModel):
    job_type: str
    job_id: int
    owner_user_id: int | None
    owner_user_email: str | None
    status: str
    source: str
    attempts: int
    max_attempts: int
    subject: str | None
    target: str | None
    error_message: str | None
    scheduled_for: datetime | None
    next_retry_at: datetime | None
    created_at: datetime
    updated_at: datetime


class AdminMetricsStatusItem(BaseModel):
    status: str
    count: int


class AdminMetricsFlowItem(BaseModel):
    flow: str
    failed_24h: int
    success_24h: int


class AdminMetricsOverviewOut(BaseModel):
    users_total: int
    users_active: int
    linkedin_accounts_total: int
    github_accounts_total: int
    github_repositories_total: int
    linkedin_schedules_active: int
    leetcode_schedules_active: int
    linkedin_jobs_24h: int
    leetcode_jobs_24h: int
    total_jobs_24h: int
    statuses_24h: list[AdminMetricsStatusItem]
    flows_24h: list[AdminMetricsFlowItem]
