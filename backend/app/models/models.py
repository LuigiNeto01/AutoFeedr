from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(32), default="user")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    leetcode_solution_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    openai_api_key_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    preferred_llm_model: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @property
    def has_openai_api_key(self) -> bool:
        return bool((self.openai_api_key_encrypted or "").strip())


class AuthToken(Base):
    __tablename__ = "auth_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    user: Mapped[User] = relationship()


class LinkedinAccount(Base):
    __tablename__ = "linkedin_accounts"
    __table_args__ = (
        UniqueConstraint("owner_user_id", "name", name="uq_linkedin_account_owner_name"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    owner_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True, nullable=True)
    name: Mapped[str] = mapped_column(String(120), index=True)
    token_encrypted: Mapped[str] = mapped_column(Text)
    urn: Mapped[str] = mapped_column(String(255))
    prompt_generation: Mapped[str | None] = mapped_column(Text, nullable=True)
    prompt_translation: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    schedules: Mapped[list[Schedule]] = relationship(back_populates="account", cascade="all, delete-orphan")
    jobs: Mapped[list[Job]] = relationship(back_populates="account", cascade="all, delete-orphan")


class Schedule(Base):
    __tablename__ = "schedules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("linkedin_accounts.id"), index=True)
    topic: Mapped[str] = mapped_column(String(255))
    cron_expr: Mapped[str] = mapped_column(String(120))
    source_mode: Mapped[str] = mapped_column(String(32), default="arxiv")
    objective: Mapped[str | None] = mapped_column(String(64), nullable=True)
    audience: Mapped[str | None] = mapped_column(String(120), nullable=True)
    cta_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    campaign_theme: Mapped[str | None] = mapped_column(String(255), nullable=True)
    use_date_context: Mapped[bool] = mapped_column(Boolean, default=True)
    day_of_week: Mapped[int | None] = mapped_column(Integer, nullable=True)
    time_local: Mapped[str | None] = mapped_column(String(5), nullable=True)
    timezone: Mapped[str] = mapped_column(String(64), default="America/Sao_Paulo")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    account: Mapped[LinkedinAccount] = relationship(back_populates="schedules")


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("linkedin_accounts.id"), index=True)
    source: Mapped[str] = mapped_column(String(32), default="manual")
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True)

    topic: Mapped[str | None] = mapped_column(String(255), nullable=True)
    paper_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    paper_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    generated_post: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    attempts: Mapped[int] = mapped_column(Integer, default=0)
    max_attempts: Mapped[int] = mapped_column(Integer, default=3)
    scheduled_for: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    next_retry_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    account: Mapped[LinkedinAccount] = relationship(back_populates="jobs")
    logs: Mapped[list[JobLog]] = relationship(back_populates="job", cascade="all, delete-orphan")


class JobLog(Base):
    __tablename__ = "job_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"), index=True)
    level: Mapped[str] = mapped_column(String(16), default="INFO")
    message: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    job: Mapped[Job] = relationship(back_populates="logs")


class ScheduleRun(Base):
    __tablename__ = "schedule_runs"
    __table_args__ = (
        UniqueConstraint("schedule_id", "run_minute_utc", name="uq_schedule_run"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    schedule_id: Mapped[int] = mapped_column(ForeignKey("schedules.id"), index=True)
    run_minute_utc: Mapped[datetime] = mapped_column(DateTime, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class GitHubAccount(Base):
    __tablename__ = "github_accounts"
    __table_args__ = (
        UniqueConstraint("owner_user_id", "name", name="uq_github_account_owner_name"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    owner_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True, nullable=True)
    name: Mapped[str] = mapped_column(String(120), index=True)
    ssh_key_encrypted: Mapped[str] = mapped_column(Text)
    ssh_passphrase_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    repositories: Mapped[list[GitHubRepository]] = relationship(
        back_populates="account",
        cascade="all, delete-orphan",
    )

    @property
    def has_ssh_key(self) -> bool:
        return bool((self.ssh_key_encrypted or "").strip())


class GitHubRepository(Base):
    __tablename__ = "github_repositories"
    __table_args__ = (
        UniqueConstraint("owner_user_id", "repo_ssh_url", name="uq_github_repo_owner_url"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    owner_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True, nullable=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("github_accounts.id"), index=True)
    repo_ssh_url: Mapped[str] = mapped_column(String(255), index=True)
    default_branch: Mapped[str] = mapped_column(String(64), default="main")
    solutions_dir: Mapped[str] = mapped_column(String(255), default="problems")
    commit_author_name: Mapped[str] = mapped_column(String(120))
    commit_author_email: Mapped[str] = mapped_column(String(255))
    selection_strategy: Mapped[str] = mapped_column(String(32), default="random")
    difficulty_policy: Mapped[str] = mapped_column(String(32), default="random")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    account: Mapped[GitHubAccount] = relationship(back_populates="repositories")
    schedules: Mapped[list[LeetCodeSchedule]] = relationship(back_populates="repository", cascade="all, delete-orphan")
    jobs: Mapped[list[LeetCodeJob]] = relationship(back_populates="repository", cascade="all, delete-orphan")
    completed_problems: Mapped[list[LeetCodeCompletedProblem]] = relationship(
        back_populates="repository",
        cascade="all, delete-orphan",
    )


class LeetCodeSchedule(Base):
    __tablename__ = "leetcode_schedules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    repository_id: Mapped[int] = mapped_column(ForeignKey("github_repositories.id"), index=True)
    cron_expr: Mapped[str] = mapped_column(String(120))
    day_of_week: Mapped[int | None] = mapped_column(Integer, nullable=True)
    time_local: Mapped[str | None] = mapped_column(String(5), nullable=True)
    timezone: Mapped[str] = mapped_column(String(64), default="America/Sao_Paulo")
    selection_strategy: Mapped[str | None] = mapped_column(String(32), nullable=True)
    difficulty_policy: Mapped[str | None] = mapped_column(String(32), nullable=True)
    max_attempts: Mapped[int] = mapped_column(Integer, default=2)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    repository: Mapped[GitHubRepository] = relationship(back_populates="schedules")


class LeetCodeScheduleRun(Base):
    __tablename__ = "leetcode_schedule_runs"
    __table_args__ = (
        UniqueConstraint("schedule_id", "run_minute_utc", name="uq_leetcode_schedule_run"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    schedule_id: Mapped[int] = mapped_column(ForeignKey("leetcode_schedules.id"), index=True)
    run_minute_utc: Mapped[datetime] = mapped_column(DateTime, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class LeetCodeJob(Base):
    __tablename__ = "leetcode_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    repository_id: Mapped[int] = mapped_column(ForeignKey("github_repositories.id"), index=True)
    schedule_id: Mapped[int | None] = mapped_column(ForeignKey("leetcode_schedules.id"), nullable=True, index=True)

    source: Mapped[str] = mapped_column(String(32), default="manual")
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    max_attempts: Mapped[int] = mapped_column(Integer, default=2)

    selection_strategy: Mapped[str | None] = mapped_column(String(32), nullable=True)
    difficulty_policy: Mapped[str | None] = mapped_column(String(32), nullable=True)

    problem_frontend_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    problem_slug: Mapped[str | None] = mapped_column(String(255), nullable=True)
    problem_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    problem_difficulty: Mapped[str | None] = mapped_column(String(32), nullable=True)

    solution_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    tests_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    commit_sha: Mapped[str | None] = mapped_column(String(64), nullable=True)
    commit_url: Mapped[str | None] = mapped_column(String(255), nullable=True)

    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    scheduled_for: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    next_retry_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    repository: Mapped[GitHubRepository] = relationship(back_populates="jobs")
    logs: Mapped[list[LeetCodeJobLog]] = relationship(back_populates="job", cascade="all, delete-orphan")


class LeetCodeJobLog(Base):
    __tablename__ = "leetcode_job_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("leetcode_jobs.id"), index=True)
    level: Mapped[str] = mapped_column(String(16), default="INFO")
    message: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    job: Mapped[LeetCodeJob] = relationship(back_populates="logs")


class LeetCodeCompletedProblem(Base):
    __tablename__ = "leetcode_completed_problems"
    __table_args__ = (
        UniqueConstraint("repository_id", "problem_frontend_id", name="uq_leetcode_completed_problem"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    repository_id: Mapped[int] = mapped_column(ForeignKey("github_repositories.id"), index=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("leetcode_jobs.id"), unique=True, index=True)

    problem_frontend_id: Mapped[str] = mapped_column(String(32), index=True)
    problem_slug: Mapped[str] = mapped_column(String(255))
    problem_title: Mapped[str] = mapped_column(String(255))
    problem_difficulty: Mapped[str] = mapped_column(String(32))
    commit_sha: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    repository: Mapped[GitHubRepository] = relationship(back_populates="completed_problems")


class AdminAuditLog(Base):
    __tablename__ = "admin_audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    admin_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True, nullable=True)
    action: Mapped[str] = mapped_column(String(64), index=True)
    target_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True, nullable=True)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class PlatformLLMSettings(Base):
    __tablename__ = "platform_llm_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    provider: Mapped[str] = mapped_column(String(32), default="openai")
    api_key_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    default_model: Mapped[str | None] = mapped_column(String(120), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @property
    def has_api_key(self) -> bool:
        return bool((self.api_key_encrypted or "").strip())


class LLMModelConfig(Base):
    __tablename__ = "llm_model_configs"
    __table_args__ = (UniqueConstraint("provider", "model", name="uq_llm_model_provider_model"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    provider: Mapped[str] = mapped_column(String(32), default="openai", index=True)
    model: Mapped[str] = mapped_column(String(120), index=True)
    input_price_per_1m: Mapped[str] = mapped_column(String(32), default="0")
    cached_input_price_per_1m: Mapped[str] = mapped_column(String(32), default="0")
    output_price_per_1m: Mapped[str] = mapped_column(String(32), default="0")
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class LLMUsageEvent(Base):
    __tablename__ = "llm_usage_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    owner_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True, nullable=True)
    provider: Mapped[str] = mapped_column(String(32), index=True)
    model: Mapped[str] = mapped_column(String(120), index=True)
    flow: Mapped[str] = mapped_column(String(32), index=True)
    operation: Mapped[str] = mapped_column(String(64), index=True)
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cached_input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    estimated_cost_usd: Mapped[str] = mapped_column(String(32), default="0")
    job_type: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    job_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    success: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    error_type: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
