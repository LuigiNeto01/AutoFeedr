from __future__ import annotations

import json
from decimal import Decimal, InvalidOperation
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import create_access_token, hash_password, hash_token, token_expires_at, verify_password
from app.core.security import build_fernet, encrypt_text
from app.core.settings import settings
from app.db.session import get_db
from app.models.models import (
    AdminAuditLog,
    AuthToken,
    GitHubAccount,
    GitHubRepository,
    Job,
    LLMModelConfig,
    LLMUsageEvent,
    LeetCodeCompletedProblem,
    LeetCodeJob,
    LeetCodeJobLog,
    LeetCodeSchedule,
    LeetCodeScheduleRun,
    LinkedinAccount,
    PlatformLLMSettings,
    Schedule,
    ScheduleRun,
    User,
)
from app.schemas.schemas import (
    AccountCreate,
    AccountOut,
    AccountUpdate,
    AuthLogin,
    AuthRegister,
    AuthTokenOut,
    AuthUserOut,
    AdminAuditLogOut,
    AdminConsumptionOverviewModelItem,
    AdminConsumptionOverviewOut,
    AdminConsumptionSeriesPoint,
    AdminConsumptionUserSeriesOut,
    AdminConsumptionUserTableRow,
    AdminLLMSettingsOut,
    AdminLLMSettingsUpdate,
    AdminMetricsFlowItem,
    AdminMetricsOverviewOut,
    AdminMetricsStatusItem,
    AdminUnifiedJobOut,
    AdminUserOut,
    AdminUserOverviewCounts,
    AdminUserOverviewOut,
    AdminUserUpdate,
    GitHubAccountCreate,
    GitHubAccountOut,
    GitHubAccountUpdate,
    GitHubRepositoryCreate,
    GitHubRepositoryOut,
    GitHubRepositoryUpdate,
    JobOut,
    LeetCodeCompletedOut,
    LeetCodeJobLogOut,
    LeetCodeJobOut,
    LeetCodePromptSettingsOut,
    LeetCodePromptSettingsUpdate,
    LeetCodeRunNowCreate,
    LeetCodeScheduleCreate,
    LeetCodeScheduleOut,
    LeetCodeScheduleUpdate,
    ManualJobCreate,
    OpenAIKeyUpdate,
    ScheduleCreate,
    ScheduleOut,
    ScheduleUpdate,
    UserLLMPreferencesOut,
)
from packages.Escritor.src.prompt import PROMPT_GERACAO_POST, PROMPT_TRADUCAO
from packages.leetcode_automation.prompts import PROMPT_GENERATE_SOLUTION


router = APIRouter()

SELECTION_STRATEGIES = {"random", "easy_first", "sequential"}
DIFFICULTY_POLICIES = {"random", "easy", "medium", "hard"}
USER_ROLES = {"user", "admin"}
LEGACY_DIFFICULTY_POLICY_MAP = {
    "free_any": "random",
    "free_easy": "easy",
    "free_easy_medium": "medium",
}


def _build_simple_weekly_cron(day_of_week: int, time_local: str) -> str:
    hour_raw, minute_raw = time_local.split(":")
    hour = int(hour_raw)
    minute = int(minute_raw)
    if hour < 0 or hour > 23 or minute < 0 or minute > 59:
        raise ValueError("Horario invalido. Use HH:MM entre 00:00 e 23:59.")
    return f"{minute} {hour} * * {day_of_week}"


def _fernet_or_500():
    try:
        return build_fernet(settings.token_encryption_key)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="TOKEN_ENCRYPTION_KEY nao configurada para criptografar credenciais.",
        ) from exc


def _normalize_selection_strategy(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    if normalized not in SELECTION_STRATEGIES:
        raise HTTPException(
            status_code=422,
            detail=f"selection_strategy invalida. Use uma de: {', '.join(sorted(SELECTION_STRATEGIES))}.",
        )
    return normalized


def _normalize_difficulty_policy(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    if normalized in LEGACY_DIFFICULTY_POLICY_MAP:
        normalized = LEGACY_DIFFICULTY_POLICY_MAP[normalized]
    if normalized not in DIFFICULTY_POLICIES:
        raise HTTPException(
            status_code=422,
            detail=f"difficulty_policy invalida. Use uma de: {', '.join(sorted(DIFFICULTY_POLICIES))}.",
        )
    return normalized


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Token de acesso ausente.")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status_code=401, detail="Cabecalho Authorization invalido.")
    return token.strip()


def get_current_user(
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
) -> User:
    token_value = _extract_bearer_token(authorization)
    token = (
        db.query(AuthToken)
        .filter(
            AuthToken.token_hash == hash_token(token_value),
            AuthToken.revoked.is_(False),
            AuthToken.expires_at > datetime.now(UTC).replace(tzinfo=None),
        )
        .first()
    )
    if not token:
        raise HTTPException(status_code=401, detail="Token invalido ou expirado.")

    user = db.query(User).filter(User.id == token.user_id, User.is_active.is_(True)).first()
    if not user:
        raise HTTPException(status_code=401, detail="Usuario invalido ou inativo.")

    token.last_used_at = datetime.now(UTC).replace(tzinfo=None)
    db.commit()
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    role = (current_user.role or "user").strip().lower()
    if role not in USER_ROLES:
        current_user.role = "user"
        raise HTTPException(status_code=403, detail="Permissao insuficiente.")
    if role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores.")
    return current_user


def _write_admin_audit_log(
    db: Session,
    *,
    admin_user_id: int | None,
    action: str,
    target_user_id: int | None = None,
    details: dict | None = None,
) -> None:
    db.add(
        AdminAuditLog(
            admin_user_id=admin_user_id,
            action=action,
            target_user_id=target_user_id,
            details=json.dumps(details, ensure_ascii=True, sort_keys=True) if details else None,
        )
    )


def _safe_decimal(value: str | None) -> Decimal:
    try:
        return Decimal((value or "0").strip() or "0")
    except (InvalidOperation, AttributeError):
        return Decimal("0")


def _price_to_float(value: str | None) -> float:
    return float(_safe_decimal(value))


def _get_platform_llm_settings(db: Session) -> PlatformLLMSettings:
    settings_row = db.query(PlatformLLMSettings).filter(PlatformLLMSettings.id == 1).first()
    if settings_row:
        return settings_row
    settings_row = PlatformLLMSettings(id=1, provider="openai", default_model="gpt-5-nano", is_active=True)
    db.add(settings_row)
    db.commit()
    db.refresh(settings_row)
    return settings_row


def _get_enabled_llm_models(db: Session, provider: str = "openai") -> list[LLMModelConfig]:
    return (
        db.query(LLMModelConfig)
        .filter(LLMModelConfig.provider == provider)
        .order_by(LLMModelConfig.model.asc())
        .all()
    )


def _resolve_allowed_models(db: Session, provider: str = "openai") -> list[str]:
    return [row.model for row in _get_enabled_llm_models(db, provider=provider) if row.is_enabled]


def _resolve_effective_user_model(db: Session, user: User, provider: str = "openai") -> str | None:
    platform_settings = _get_platform_llm_settings(db)
    allowed = _resolve_allowed_models(db, provider=provider)
    preferred = (user.preferred_llm_model or "").strip() or None
    default_model = (platform_settings.default_model or "").strip() or None
    if preferred and preferred in allowed:
        return preferred
    if default_model and default_model in allowed:
        return default_model
    return allowed[0] if allowed else default_model


def _parse_range_to_since(range_value: str) -> tuple[str, datetime]:
    normalized = (range_value or "7d").strip().lower()
    now = datetime.now(UTC).replace(tzinfo=None)
    if normalized == "24h":
        return normalized, now - timedelta(hours=24)
    if normalized == "30d":
        return normalized, now - timedelta(days=30)
    if normalized == "90d":
        return normalized, now - timedelta(days=90)
    return "7d", now - timedelta(days=7)


def _build_auth_response(db: Session, user: User) -> AuthTokenOut:
    raw_token = create_access_token()
    token = AuthToken(
        user_id=user.id,
        token_hash=hash_token(raw_token),
        expires_at=token_expires_at(settings.auth_token_ttl_hours),
        revoked=False,
    )
    db.add(token)
    db.commit()
    db.refresh(user)
    return AuthTokenOut(access_token=raw_token, user=AuthUserOut.model_validate(user))


@router.get("/health")
def healthcheck():
    return {"status": "ok", "service": "autofeedr-api"}


@router.post("/auth/register", response_model=AuthTokenOut)
def auth_register(payload: AuthRegister, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Usuario com esse email ja existe.")

    is_first_user = db.query(User.id).count() == 0
    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        role="admin" if is_first_user else "user",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _build_auth_response(db, user)


@router.post("/auth/login", response_model=AuthTokenOut)
def auth_login(payload: AuthLogin, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email, User.is_active.is_(True)).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciais invalidas.")
    return _build_auth_response(db, user)


@router.post("/auth/logout")
def auth_logout(
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
):
    token_value = _extract_bearer_token(authorization)
    token = db.query(AuthToken).filter(AuthToken.token_hash == hash_token(token_value)).first()
    if token:
        token.revoked = True
        db.commit()
    return {"ok": True}


@router.get("/auth/me", response_model=AuthUserOut)
def auth_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/admin/users", response_model=list[AdminUserOut])
def admin_list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return db.query(User).order_by(User.id.asc()).all()


@router.get("/admin/users/{user_id}/overview", response_model=AdminUserOverviewOut)
def admin_user_overview(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado.")

    linkedin_accounts = (
        db.query(LinkedinAccount)
        .filter(LinkedinAccount.owner_user_id == user_id)
        .order_by(LinkedinAccount.id.desc())
        .all()
    )
    github_accounts = (
        db.query(GitHubAccount)
        .filter(GitHubAccount.owner_user_id == user_id)
        .order_by(GitHubAccount.id.desc())
        .all()
    )
    github_repositories = (
        db.query(GitHubRepository)
        .filter(GitHubRepository.owner_user_id == user_id)
        .order_by(GitHubRepository.id.desc())
        .all()
    )
    linkedin_schedules = (
        db.query(Schedule)
        .join(LinkedinAccount, LinkedinAccount.id == Schedule.account_id)
        .filter(LinkedinAccount.owner_user_id == user_id)
        .order_by(Schedule.id.desc())
        .all()
    )
    leetcode_schedules = (
        db.query(LeetCodeSchedule)
        .join(GitHubRepository, GitHubRepository.id == LeetCodeSchedule.repository_id)
        .filter(GitHubRepository.owner_user_id == user_id)
        .order_by(LeetCodeSchedule.id.desc())
        .all()
    )
    recent_linkedin_jobs = (
        db.query(Job)
        .join(LinkedinAccount, LinkedinAccount.id == Job.account_id)
        .filter(LinkedinAccount.owner_user_id == user_id)
        .order_by(Job.id.desc())
        .limit(10)
        .all()
    )
    recent_leetcode_jobs = (
        db.query(LeetCodeJob)
        .join(GitHubRepository, GitHubRepository.id == LeetCodeJob.repository_id)
        .filter(GitHubRepository.owner_user_id == user_id)
        .order_by(LeetCodeJob.id.desc())
        .limit(10)
        .all()
    )

    counts = AdminUserOverviewCounts(
        linkedin_accounts=len(linkedin_accounts),
        github_accounts=len(github_accounts),
        github_repositories=len(github_repositories),
        linkedin_schedules=len(linkedin_schedules),
        leetcode_schedules=len(leetcode_schedules),
        linkedin_jobs=(
            db.query(Job)
            .join(LinkedinAccount, LinkedinAccount.id == Job.account_id)
            .filter(LinkedinAccount.owner_user_id == user_id)
            .count()
        ),
        leetcode_jobs=(
            db.query(LeetCodeJob)
            .join(GitHubRepository, GitHubRepository.id == LeetCodeJob.repository_id)
            .filter(GitHubRepository.owner_user_id == user_id)
            .count()
        ),
    )

    return AdminUserOverviewOut(
        user=AdminUserOut.model_validate(user),
        counts=counts,
        linkedin_accounts=linkedin_accounts,
        github_accounts=github_accounts,
        github_repositories=github_repositories,
        linkedin_schedules=linkedin_schedules,
        leetcode_schedules=leetcode_schedules,
        recent_linkedin_jobs=recent_linkedin_jobs,
        recent_leetcode_jobs=recent_leetcode_jobs,
    )


@router.put("/admin/users/{user_id}", response_model=AdminUserOut)
def admin_update_user(
    user_id: int,
    payload: AdminUserUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado.")

    new_role = payload.role if payload.role is not None else user.role
    new_is_active = payload.is_active if payload.is_active is not None else user.is_active
    before_role = user.role
    before_is_active = user.is_active

    if (new_role == "user" or new_is_active is False) and user.role == "admin" and user.is_active:
        active_admins_count = (
            db.query(User)
            .filter(User.role == "admin", User.is_active.is_(True))
            .count()
        )
        if active_admins_count <= 1:
            raise HTTPException(status_code=422, detail="Nao e permitido remover/desativar o ultimo admin ativo.")

    if payload.role is not None:
        user.role = new_role

    if payload.is_active is not None:
        if user.id == admin_user.id and payload.is_active is False:
            raise HTTPException(status_code=422, detail="Nao e permitido desativar o proprio usuario admin.")
        user.is_active = payload.is_active
        if payload.is_active is False:
            db.query(AuthToken).filter(AuthToken.user_id == user.id, AuthToken.revoked.is_(False)).update(
                {AuthToken.revoked: True},
                synchronize_session=False,
            )
            linkedin_account_ids = [
                row[0]
                for row in db.query(LinkedinAccount.id)
                .filter(LinkedinAccount.owner_user_id == user.id)
                .all()
            ]
            if linkedin_account_ids:
                db.query(Schedule).filter(Schedule.account_id.in_(linkedin_account_ids)).update(
                    {Schedule.is_active: False},
                    synchronize_session=False,
                )

            github_repo_ids = [
                row[0]
                for row in db.query(GitHubRepository.id)
                .filter(GitHubRepository.owner_user_id == user.id)
                .all()
            ]
            if github_repo_ids:
                db.query(LeetCodeSchedule).filter(LeetCodeSchedule.repository_id.in_(github_repo_ids)).update(
                    {LeetCodeSchedule.is_active: False},
                    synchronize_session=False,
                )

    if before_role != user.role or before_is_active != user.is_active:
        _write_admin_audit_log(
            db,
            admin_user_id=admin_user.id,
            action="admin.user_update",
            target_user_id=user.id,
            details={
                "before": {"role": before_role, "is_active": before_is_active},
                "after": {"role": user.role, "is_active": user.is_active},
            },
        )

    db.commit()
    db.refresh(user)
    return user


@router.get("/admin/audit-logs", response_model=list[AdminAuditLogOut])
def admin_list_audit_logs(
    db: Session = Depends(get_db),
    limit: int = 100,
    _: User = Depends(require_admin),
):
    safe_limit = max(1, min(limit, 500))
    return (
        db.query(AdminAuditLog)
        .order_by(AdminAuditLog.id.desc())
        .limit(safe_limit)
        .all()
    )


@router.get("/admin/jobs", response_model=list[AdminUnifiedJobOut])
def admin_list_jobs(
    db: Session = Depends(get_db),
    limit: int = 100,
    status: str | None = None,
    job_type: str | None = None,
    user_id: int | None = None,
    _: User = Depends(require_admin),
):
    safe_limit = max(1, min(limit, 500))
    items: list[dict] = []
    normalized_type = (job_type or "").strip().lower() or None
    normalized_status = (status or "").strip().lower() or None

    if normalized_type in (None, "linkedin"):
        linkedin_jobs_query = (
            db.query(Job, LinkedinAccount, User)
            .join(LinkedinAccount, LinkedinAccount.id == Job.account_id)
            .outerjoin(User, User.id == LinkedinAccount.owner_user_id)
        )
        if normalized_status:
            linkedin_jobs_query = linkedin_jobs_query.filter(Job.status == normalized_status)
        if user_id is not None:
            linkedin_jobs_query = linkedin_jobs_query.filter(LinkedinAccount.owner_user_id == user_id)
        linkedin_jobs_rows = linkedin_jobs_query.order_by(Job.id.desc()).limit(safe_limit).all()
        for job, account, owner in linkedin_jobs_rows:
            items.append(
                {
                    "job_type": "linkedin",
                    "job_id": job.id,
                    "owner_user_id": owner.id if owner else account.owner_user_id,
                    "owner_user_email": owner.email if owner else None,
                    "status": job.status,
                    "source": job.source,
                    "attempts": job.attempts,
                    "max_attempts": job.max_attempts,
                    "subject": job.topic,
                    "target": account.name if account else None,
                    "error_message": job.error_message,
                    "scheduled_for": job.scheduled_for,
                    "next_retry_at": job.next_retry_at,
                    "created_at": job.created_at,
                    "updated_at": job.updated_at,
                }
            )

    if normalized_type in (None, "leetcode"):
        leetcode_jobs_query = (
            db.query(LeetCodeJob, GitHubRepository, User)
            .join(GitHubRepository, GitHubRepository.id == LeetCodeJob.repository_id)
            .outerjoin(User, User.id == GitHubRepository.owner_user_id)
        )
        if normalized_status:
            leetcode_jobs_query = leetcode_jobs_query.filter(LeetCodeJob.status == normalized_status)
        if user_id is not None:
            leetcode_jobs_query = leetcode_jobs_query.filter(GitHubRepository.owner_user_id == user_id)
        leetcode_jobs_rows = leetcode_jobs_query.order_by(LeetCodeJob.id.desc()).limit(safe_limit).all()
        for job, repository, owner in leetcode_jobs_rows:
            subject = job.problem_title or job.problem_slug
            items.append(
                {
                    "job_type": "leetcode",
                    "job_id": job.id,
                    "owner_user_id": owner.id if owner else repository.owner_user_id,
                    "owner_user_email": owner.email if owner else None,
                    "status": job.status,
                    "source": job.source,
                    "attempts": job.attempts,
                    "max_attempts": job.max_attempts,
                    "subject": subject,
                    "target": repository.repo_ssh_url if repository else None,
                    "error_message": job.error_message,
                    "scheduled_for": job.scheduled_for,
                    "next_retry_at": job.next_retry_at,
                    "created_at": job.created_at,
                    "updated_at": job.updated_at,
                }
            )

    items.sort(key=lambda row: row.get("created_at") or datetime.min, reverse=True)
    return items[:safe_limit]


@router.get("/admin/metrics/overview", response_model=AdminMetricsOverviewOut)
def admin_metrics_overview(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    now = datetime.now(UTC).replace(tzinfo=None)
    since_24h = now - timedelta(hours=24)

    statuses = ["pending", "running", "retry", "failed", "success"]
    linkedin_24h_query = db.query(Job).filter(Job.created_at >= since_24h)
    leetcode_24h_query = db.query(LeetCodeJob).filter(LeetCodeJob.created_at >= since_24h)

    status_counts: dict[str, int] = {status: 0 for status in statuses}
    for status_name in statuses:
        status_counts[status_name] = (
            linkedin_24h_query.filter(Job.status == status_name).count()
            + leetcode_24h_query.filter(LeetCodeJob.status == status_name).count()
        )

    linkedin_success_24h = linkedin_24h_query.filter(Job.status == "success").count()
    linkedin_failed_24h = linkedin_24h_query.filter(Job.status == "failed").count()
    leetcode_success_24h = leetcode_24h_query.filter(LeetCodeJob.status == "success").count()
    leetcode_failed_24h = leetcode_24h_query.filter(LeetCodeJob.status == "failed").count()

    return AdminMetricsOverviewOut(
        users_total=db.query(User).count(),
        users_active=db.query(User).filter(User.is_active.is_(True)).count(),
        linkedin_accounts_total=db.query(LinkedinAccount).count(),
        github_accounts_total=db.query(GitHubAccount).count(),
        github_repositories_total=db.query(GitHubRepository).count(),
        linkedin_schedules_active=db.query(Schedule).filter(Schedule.is_active.is_(True)).count(),
        leetcode_schedules_active=db.query(LeetCodeSchedule).filter(LeetCodeSchedule.is_active.is_(True)).count(),
        linkedin_jobs_24h=linkedin_24h_query.count(),
        leetcode_jobs_24h=leetcode_24h_query.count(),
        total_jobs_24h=linkedin_24h_query.count() + leetcode_24h_query.count(),
        statuses_24h=[AdminMetricsStatusItem(status=key, count=value) for key, value in status_counts.items()],
        flows_24h=[
            AdminMetricsFlowItem(flow="linkedin", failed_24h=linkedin_failed_24h, success_24h=linkedin_success_24h),
            AdminMetricsFlowItem(flow="leetcode", failed_24h=leetcode_failed_24h, success_24h=leetcode_success_24h),
        ],
    )


@router.get("/admin/llm/settings", response_model=AdminLLMSettingsOut)
def admin_get_llm_settings(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    platform = _get_platform_llm_settings(db)
    models = _get_enabled_llm_models(db, provider=platform.provider)
    return AdminLLMSettingsOut(
        provider=platform.provider,
        has_api_key=platform.has_api_key,
        default_model=platform.default_model,
        models=[
            {
                "id": row.id,
                "model": row.model,
                "input_price_per_1m": _price_to_float(row.input_price_per_1m),
                "cached_input_price_per_1m": _price_to_float(row.cached_input_price_per_1m),
                "output_price_per_1m": _price_to_float(row.output_price_per_1m),
                "is_enabled": row.is_enabled,
            }
            for row in models
        ],
    )


@router.put("/admin/llm/settings", response_model=AdminLLMSettingsOut)
def admin_update_llm_settings(
    payload: AdminLLMSettingsUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    platform = _get_platform_llm_settings(db)
    platform.provider = payload.provider
    if payload.api_key is not None and payload.api_key.strip():
        fernet = _fernet_or_500()
        platform.api_key_encrypted = encrypt_text(fernet, payload.api_key.strip())
    platform.default_model = (payload.default_model or "").strip() or None

    existing = {
        (row.provider, row.model): row
        for row in db.query(LLMModelConfig).filter(LLMModelConfig.provider == payload.provider).all()
    }
    seen_models: set[str] = set()
    for item in payload.models:
        model_name = item.model.strip()
        if not model_name:
            continue
        seen_models.add(model_name)
        row = existing.get((payload.provider, model_name))
        if not row:
            row = LLMModelConfig(provider=payload.provider, model=model_name)
            db.add(row)
        row.input_price_per_1m = str(item.input_price_per_1m)
        row.cached_input_price_per_1m = str(item.cached_input_price_per_1m)
        row.output_price_per_1m = str(item.output_price_per_1m)
        row.is_enabled = bool(item.is_enabled)

    for (provider_key, model_key), row in existing.items():
        if provider_key == payload.provider and model_key not in seen_models:
            row.is_enabled = False

    if platform.default_model:
        enabled_names = {m.model.strip() for m in payload.models if m.is_enabled}
        if platform.default_model not in enabled_names:
            raise HTTPException(status_code=422, detail="default_model precisa estar habilitado na lista de modelos.")

    _write_admin_audit_log(
        db,
        admin_user_id=admin_user.id,
        action="admin.llm_settings_update",
        details={
            "provider": payload.provider,
            "default_model": platform.default_model,
            "models_count": len(payload.models),
            "api_key_updated": bool((payload.api_key or "").strip()),
        },
    )

    db.commit()
    return admin_get_llm_settings(db=db, _=admin_user)


@router.get("/admin/consumption/overview", response_model=AdminConsumptionOverviewOut)
def admin_consumption_overview(
    db: Session = Depends(get_db),
    range: str = "7d",
    _: User = Depends(require_admin),
):
    normalized_range, since = _parse_range_to_since(range)
    rows = db.query(LLMUsageEvent).filter(LLMUsageEvent.created_at >= since).all()

    total = {
        "requests": len(rows),
        "input_tokens": sum(item.input_tokens or 0 for item in rows),
        "cached_input_tokens": sum(item.cached_input_tokens or 0 for item in rows),
        "output_tokens": sum(item.output_tokens or 0 for item in rows),
        "total_tokens": sum(item.total_tokens or 0 for item in rows),
        "estimated_cost_usd": float(sum(_safe_decimal(item.estimated_cost_usd) for item in rows)),
    }

    by_model: dict[str, dict[str, Decimal | int]] = {}
    for item in rows:
        bucket = by_model.setdefault(
            item.model,
            {
                "requests": 0,
                "input_tokens": 0,
                "cached_input_tokens": 0,
                "output_tokens": 0,
                "total_tokens": 0,
                "estimated_cost_usd": Decimal("0"),
            },
        )
        bucket["requests"] = int(bucket["requests"]) + 1
        bucket["input_tokens"] = int(bucket["input_tokens"]) + int(item.input_tokens or 0)
        bucket["cached_input_tokens"] = int(bucket["cached_input_tokens"]) + int(item.cached_input_tokens or 0)
        bucket["output_tokens"] = int(bucket["output_tokens"]) + int(item.output_tokens or 0)
        bucket["total_tokens"] = int(bucket["total_tokens"]) + int(item.total_tokens or 0)
        bucket["estimated_cost_usd"] = _safe_decimal(item.estimated_cost_usd) + _safe_decimal(str(bucket["estimated_cost_usd"]))

    top_models = sorted(
        [
            AdminConsumptionOverviewModelItem(
                model=model,
                requests=int(values["requests"]),
                input_tokens=int(values["input_tokens"]),
                cached_input_tokens=int(values["cached_input_tokens"]),
                output_tokens=int(values["output_tokens"]),
                total_tokens=int(values["total_tokens"]),
                estimated_cost_usd=float(values["estimated_cost_usd"]),
            )
            for model, values in by_model.items()
        ],
        key=lambda item: (item.total_tokens, item.requests),
        reverse=True,
    )[:10]

    return AdminConsumptionOverviewOut(range=normalized_range, top_models=top_models, **total)


@router.get("/admin/consumption/users-table", response_model=list[AdminConsumptionUserTableRow])
def admin_consumption_users_table(
    db: Session = Depends(get_db),
    range: str = "30d",
    limit: int = 100,
    _: User = Depends(require_admin),
):
    _, since = _parse_range_to_since(range)
    safe_limit = max(1, min(limit, 500))
    rows = (
        db.query(LLMUsageEvent, User)
        .outerjoin(User, User.id == LLMUsageEvent.owner_user_id)
        .filter(LLMUsageEvent.created_at >= since)
        .all()
    )
    grouped: dict[int | None, dict] = {}
    for event, user in rows:
        key = event.owner_user_id
        bucket = grouped.setdefault(
            key,
            {
                "user_id": key,
                "email": user.email if user else None,
                "requests": 0,
                "input_tokens": 0,
                "cached_input_tokens": 0,
                "output_tokens": 0,
                "total_tokens": 0,
                "estimated_cost_usd": Decimal("0"),
                "models": {},
            },
        )
        bucket["requests"] += 1
        bucket["input_tokens"] += int(event.input_tokens or 0)
        bucket["cached_input_tokens"] += int(event.cached_input_tokens or 0)
        bucket["output_tokens"] += int(event.output_tokens or 0)
        bucket["total_tokens"] += int(event.total_tokens or 0)
        bucket["estimated_cost_usd"] += _safe_decimal(event.estimated_cost_usd)
        bucket["models"][event.model] = bucket["models"].get(event.model, 0) + 1

    items = []
    for _, bucket in grouped.items():
        most_used_model = None
        if bucket["models"]:
            most_used_model = sorted(bucket["models"].items(), key=lambda x: x[1], reverse=True)[0][0]
        items.append(
            AdminConsumptionUserTableRow(
                user_id=bucket["user_id"],
                email=bucket["email"],
                requests=bucket["requests"],
                input_tokens=bucket["input_tokens"],
                cached_input_tokens=bucket["cached_input_tokens"],
                output_tokens=bucket["output_tokens"],
                total_tokens=bucket["total_tokens"],
                estimated_cost_usd=float(bucket["estimated_cost_usd"]),
                most_used_model=most_used_model,
            )
        )
    items.sort(key=lambda item: (item.total_tokens, item.requests), reverse=True)
    return items[:safe_limit]


@router.get("/admin/consumption/by-user", response_model=list[AdminConsumptionUserSeriesOut])
def admin_consumption_by_user(
    db: Session = Depends(get_db),
    range: str = "30d",
    granularity: str = "daily",
    user_id: int | None = None,
    top_n: int = 5,
    _: User = Depends(require_admin),
):
    normalized_range, since = _parse_range_to_since(range)
    gran = (granularity or "daily").strip().lower()
    if gran not in {"daily", "weekly", "monthly"}:
        gran = "daily"

    rows = (
        db.query(LLMUsageEvent, User)
        .outerjoin(User, User.id == LLMUsageEvent.owner_user_id)
        .filter(LLMUsageEvent.created_at >= since)
        .all()
    )
    if user_id is not None:
        rows = [row for row in rows if row[0].owner_user_id == user_id]

    user_totals: dict[int | None, int] = {}
    for event, _user in rows:
        key = event.owner_user_id
        user_totals[key] = user_totals.get(key, 0) + int(event.total_tokens or 0)
    selected_users = {key for key, _ in sorted(user_totals.items(), key=lambda kv: kv[1], reverse=True)[: max(1, top_n)]}
    if user_id is not None:
        selected_users = {user_id}

    series_map: dict[tuple[int | None, str | None], dict[str, dict]] = {}
    for event, user in rows:
        if event.owner_user_id not in selected_users:
            continue
        dt = event.created_at
        if gran == "weekly":
            year, week, _ = dt.isocalendar()
            bucket_key = f"{year}-W{week:02d}"
        elif gran == "monthly":
            bucket_key = f"{dt.year:04d}-{dt.month:02d}"
        else:
            bucket_key = f"{dt.year:04d}-{dt.month:02d}-{dt.day:02d}"
        user_key = (event.owner_user_id, user.email if user else None)
        buckets = series_map.setdefault(user_key, {})
        bucket = buckets.setdefault(
            bucket_key,
            {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0, "estimated_cost_usd": Decimal('0')},
        )
        bucket["input_tokens"] += int(event.input_tokens or 0)
        bucket["output_tokens"] += int(event.output_tokens or 0)
        bucket["total_tokens"] += int(event.total_tokens or 0)
        bucket["estimated_cost_usd"] += _safe_decimal(event.estimated_cost_usd)

    output: list[AdminConsumptionUserSeriesOut] = []
    for (uid, email), buckets in series_map.items():
        points = [
            AdminConsumptionSeriesPoint(
                bucket=bucket_name,
                input_tokens=values["input_tokens"],
                output_tokens=values["output_tokens"],
                total_tokens=values["total_tokens"],
                estimated_cost_usd=float(values["estimated_cost_usd"]),
            )
            for bucket_name, values in sorted(buckets.items(), key=lambda kv: kv[0])
        ]
        output.append(AdminConsumptionUserSeriesOut(user_id=uid, email=email, points=points))
    output.sort(key=lambda item: sum(point.total_tokens for point in item.points), reverse=True)
    return output


@router.get("/auth/openai-key")
def auth_openai_key_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    platform = _get_platform_llm_settings(db)
    return {"has_openai_api_key": platform.has_api_key}


@router.put("/auth/openai-key")
def auth_set_openai_key(
    payload: OpenAIKeyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if (current_user.role or "user") != "admin":
        raise HTTPException(status_code=403, detail="Somente admin pode configurar a chave central da plataforma.")
    fernet = _fernet_or_500()
    platform = _get_platform_llm_settings(db)
    platform.api_key_encrypted = encrypt_text(fernet, payload.api_key.strip())
    db.commit()
    db.refresh(platform)
    return {"ok": True, "has_openai_api_key": platform.has_api_key}


@router.get("/auth/llm/preferences", response_model=UserLLMPreferencesOut)
def auth_llm_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    platform = _get_platform_llm_settings(db)
    allowed_models = _resolve_allowed_models(db, provider=platform.provider)
    effective = _resolve_effective_user_model(db, current_user, provider=platform.provider)
    return UserLLMPreferencesOut(
        selected_model=current_user.preferred_llm_model,
        effective_model=effective,
        allowed_models=allowed_models,
    )


@router.put("/auth/llm/preferences", response_model=UserLLMPreferencesOut)
def auth_update_llm_preferences(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    requested_model = (str(payload.get("selected_model") or "").strip() or None)
    platform = _get_platform_llm_settings(db)
    allowed_models = _resolve_allowed_models(db, provider=platform.provider)
    if requested_model and requested_model not in allowed_models:
        raise HTTPException(status_code=422, detail="Modelo nao permitido para o usuario.")
    current_user.preferred_llm_model = requested_model
    db.commit()
    db.refresh(current_user)
    return UserLLMPreferencesOut(
        selected_model=current_user.preferred_llm_model,
        effective_model=_resolve_effective_user_model(db, current_user, provider=platform.provider),
        allowed_models=allowed_models,
    )


@router.get("/prompts/defaults")
def default_prompts():
    return {
        "prompt_generation": PROMPT_GERACAO_POST,
        "prompt_translation": PROMPT_TRADUCAO,
        "leetcode_solution_prompt": PROMPT_GENERATE_SOLUTION,
    }


@router.get("/leetcode/prompts", response_model=LeetCodePromptSettingsOut)
def get_leetcode_prompts(current_user: User = Depends(get_current_user)):
    return {"solution_prompt": current_user.leetcode_solution_prompt}


@router.put("/leetcode/prompts", response_model=LeetCodePromptSettingsOut)
def update_leetcode_prompts(
    payload: LeetCodePromptSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.leetcode_solution_prompt = payload.solution_prompt
    db.commit()
    db.refresh(current_user)
    return {"solution_prompt": current_user.leetcode_solution_prompt}


@router.get("/linkedin/accounts", response_model=list[AccountOut])
def list_accounts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return (
        db.query(LinkedinAccount)
        .filter(LinkedinAccount.owner_user_id == current_user.id)
        .order_by(LinkedinAccount.id.desc())
        .all()
    )


@router.post("/linkedin/accounts", response_model=AccountOut)
def create_account(
    payload: AccountCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = (
        db.query(LinkedinAccount)
        .filter(
            LinkedinAccount.owner_user_id == current_user.id,
            LinkedinAccount.name == payload.name,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Conta com esse nome ja existe.")

    fernet = _fernet_or_500()
    account = LinkedinAccount(
        owner_user_id=current_user.id,
        name=payload.name,
        token_encrypted=encrypt_text(fernet, payload.token),
        urn=payload.urn,
        prompt_generation=payload.prompt_generation,
        prompt_translation=payload.prompt_translation,
        is_active=payload.is_active,
    )
    db.add(account)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Conflito ao criar conta LinkedIn.") from exc
    db.refresh(account)
    return account


@router.put("/linkedin/accounts/{account_id}", response_model=AccountOut)
def update_account(
    account_id: int,
    payload: AccountUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = (
        db.query(LinkedinAccount)
        .filter(LinkedinAccount.id == account_id, LinkedinAccount.owner_user_id == current_user.id)
        .first()
    )
    if not account:
        raise HTTPException(status_code=404, detail="Conta nao encontrada.")

    if payload.token is not None:
        fernet = _fernet_or_500()
        account.token_encrypted = encrypt_text(fernet, payload.token)
    if payload.urn is not None:
        account.urn = payload.urn
    if payload.prompt_generation is not None:
        account.prompt_generation = payload.prompt_generation
    if payload.prompt_translation is not None:
        account.prompt_translation = payload.prompt_translation
    if payload.is_active is not None:
        account.is_active = payload.is_active

    db.commit()
    db.refresh(account)
    return account


@router.delete("/linkedin/accounts/{account_id}")
def delete_account(
    account_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = (
        db.query(LinkedinAccount)
        .filter(LinkedinAccount.id == account_id, LinkedinAccount.owner_user_id == current_user.id)
        .first()
    )
    if not account:
        raise HTTPException(status_code=404, detail="Conta nao encontrada.")

    db.delete(account)
    db.commit()
    return {"ok": True}


@router.get("/linkedin/schedules", response_model=list[ScheduleOut])
def list_schedules(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return (
        db.query(Schedule)
        .join(LinkedinAccount, LinkedinAccount.id == Schedule.account_id)
        .filter(LinkedinAccount.owner_user_id == current_user.id)
        .order_by(Schedule.id.desc())
        .all()
    )


@router.post("/linkedin/schedules", response_model=ScheduleOut)
def create_schedule(
    payload: ScheduleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = (
        db.query(LinkedinAccount)
        .filter(LinkedinAccount.id == payload.account_id, LinkedinAccount.owner_user_id == current_user.id)
        .first()
    )
    if not account:
        raise HTTPException(status_code=404, detail="Conta nao encontrada.")

    cron_expr = payload.cron_expr
    day_of_week = payload.day_of_week
    time_local = payload.time_local
    if not cron_expr:
        if day_of_week is None or not time_local:
            raise HTTPException(status_code=422, detail="Informe cron_expr ou (day_of_week + time_local).")
        try:
            cron_expr = _build_simple_weekly_cron(day_of_week, time_local)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    schedule = Schedule(
        account_id=payload.account_id,
        topic=payload.topic,
        cron_expr=cron_expr,
        day_of_week=day_of_week,
        time_local=time_local,
        source_mode=payload.source_mode,
        objective=payload.objective,
        audience=payload.audience,
        cta_type=payload.cta_type,
        campaign_theme=payload.campaign_theme,
        use_date_context=payload.use_date_context,
        timezone=payload.timezone,
        is_active=payload.is_active,
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return schedule


@router.put("/linkedin/schedules/{schedule_id}", response_model=ScheduleOut)
def update_schedule(
    schedule_id: int,
    payload: ScheduleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    schedule = (
        db.query(Schedule)
        .join(LinkedinAccount, LinkedinAccount.id == Schedule.account_id)
        .filter(Schedule.id == schedule_id, LinkedinAccount.owner_user_id == current_user.id)
        .first()
    )
    if not schedule:
        raise HTTPException(status_code=404, detail="Agenda nao encontrada.")

    if payload.topic is not None:
        schedule.topic = payload.topic
    if payload.cron_expr is not None:
        schedule.cron_expr = payload.cron_expr
        schedule.day_of_week = None
        schedule.time_local = None
    elif payload.day_of_week is not None and payload.time_local:
        try:
            schedule.cron_expr = _build_simple_weekly_cron(payload.day_of_week, payload.time_local)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        schedule.day_of_week = payload.day_of_week
        schedule.time_local = payload.time_local
    if payload.timezone is not None:
        schedule.timezone = payload.timezone
    if payload.source_mode is not None:
        schedule.source_mode = payload.source_mode
    if payload.objective is not None:
        schedule.objective = payload.objective
    if payload.audience is not None:
        schedule.audience = payload.audience
    if payload.cta_type is not None:
        schedule.cta_type = payload.cta_type
    if payload.campaign_theme is not None:
        schedule.campaign_theme = payload.campaign_theme
    if payload.use_date_context is not None:
        schedule.use_date_context = payload.use_date_context
    if payload.is_active is not None:
        schedule.is_active = payload.is_active

    db.commit()
    db.refresh(schedule)
    return schedule


@router.delete("/linkedin/schedules/{schedule_id}")
def delete_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    schedule = (
        db.query(Schedule)
        .join(LinkedinAccount, LinkedinAccount.id == Schedule.account_id)
        .filter(Schedule.id == schedule_id, LinkedinAccount.owner_user_id == current_user.id)
        .first()
    )
    if not schedule:
        raise HTTPException(status_code=404, detail="Agenda nao encontrada.")

    db.query(ScheduleRun).filter(ScheduleRun.schedule_id == schedule_id).delete(synchronize_session=False)
    db.delete(schedule)
    db.commit()
    return {"ok": True}


@router.post("/linkedin/jobs/run-now", response_model=JobOut)
def publish_now(
    payload: ManualJobCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = (
        db.query(LinkedinAccount)
        .filter(LinkedinAccount.id == payload.account_id, LinkedinAccount.owner_user_id == current_user.id)
        .first()
    )
    if not account:
        raise HTTPException(status_code=404, detail="Conta nao encontrada.")
    if not account.is_active:
        raise HTTPException(status_code=422, detail="Conta LinkedIn inativa. Ative a conta antes de publicar.")

    if not any([payload.topic, payload.paper_url, payload.paper_text]):
        raise HTTPException(status_code=422, detail="Informe topic, paper_url ou paper_text.")

    job = Job(
        account_id=payload.account_id,
        source="manual",
        status="pending",
        topic=payload.topic,
        paper_url=payload.paper_url,
        paper_text=payload.paper_text,
        max_attempts=settings.worker_max_attempts,
        scheduled_for=datetime.now(UTC).replace(tzinfo=None),
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


@router.get("/linkedin/jobs", response_model=list[JobOut])
def list_jobs(
    db: Session = Depends(get_db),
    limit: int = 50,
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Job)
        .join(LinkedinAccount, LinkedinAccount.id == Job.account_id)
        .filter(LinkedinAccount.owner_user_id == current_user.id)
        .order_by(Job.id.desc())
        .limit(limit)
        .all()
    )


@router.get("/github/accounts", response_model=list[GitHubAccountOut])
def list_github_accounts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return (
        db.query(GitHubAccount)
        .filter(GitHubAccount.owner_user_id == current_user.id)
        .order_by(GitHubAccount.id.desc())
        .all()
    )


@router.post("/github/accounts", response_model=GitHubAccountOut)
def create_github_account(
    payload: GitHubAccountCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = (
        db.query(GitHubAccount)
        .filter(GitHubAccount.owner_user_id == current_user.id, GitHubAccount.name == payload.name)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Conta GitHub com esse nome ja existe.")

    fernet = _fernet_or_500()
    account = GitHubAccount(
        owner_user_id=current_user.id,
        name=payload.name,
        ssh_key_encrypted=encrypt_text(fernet, payload.ssh_private_key),
        ssh_passphrase_encrypted=encrypt_text(fernet, payload.ssh_passphrase)
        if payload.ssh_passphrase
        else None,
        is_active=payload.is_active,
    )
    db.add(account)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Conflito ao criar conta GitHub.") from exc
    db.refresh(account)
    return account


@router.put("/github/accounts/{account_id}", response_model=GitHubAccountOut)
def update_github_account(
    account_id: int,
    payload: GitHubAccountUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = (
        db.query(GitHubAccount)
        .filter(GitHubAccount.id == account_id, GitHubAccount.owner_user_id == current_user.id)
        .first()
    )
    if not account:
        raise HTTPException(status_code=404, detail="Conta GitHub nao encontrada.")

    if payload.ssh_private_key is not None:
        fernet = _fernet_or_500()
        account.ssh_key_encrypted = encrypt_text(fernet, payload.ssh_private_key)
    if payload.ssh_passphrase is not None:
        fernet = _fernet_or_500()
        account.ssh_passphrase_encrypted = (
            encrypt_text(fernet, payload.ssh_passphrase)
            if payload.ssh_passphrase.strip()
            else None
        )
    if payload.is_active is not None:
        account.is_active = payload.is_active

    db.commit()
    db.refresh(account)
    return account


@router.delete("/github/accounts/{account_id}")
def delete_github_account(
    account_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = (
        db.query(GitHubAccount)
        .filter(GitHubAccount.id == account_id, GitHubAccount.owner_user_id == current_user.id)
        .first()
    )
    if not account:
        raise HTTPException(status_code=404, detail="Conta GitHub nao encontrada.")

    db.delete(account)
    db.commit()
    return {"ok": True}


@router.get("/github/repositories", response_model=list[GitHubRepositoryOut])
def list_github_repositories(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return (
        db.query(GitHubRepository)
        .filter(GitHubRepository.owner_user_id == current_user.id)
        .order_by(GitHubRepository.id.desc())
        .all()
    )


@router.post("/github/repositories", response_model=GitHubRepositoryOut)
def create_github_repository(
    payload: GitHubRepositoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = (
        db.query(GitHubAccount)
        .filter(GitHubAccount.id == payload.account_id, GitHubAccount.owner_user_id == current_user.id)
        .first()
    )
    if not account:
        raise HTTPException(status_code=404, detail="Conta GitHub nao encontrada.")

    existing = (
        db.query(GitHubRepository)
        .filter(
            GitHubRepository.owner_user_id == current_user.id,
            GitHubRepository.repo_ssh_url == payload.repo_ssh_url,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Repositorio GitHub ja cadastrado.")

    selection_strategy = _normalize_selection_strategy(payload.selection_strategy) or "random"
    difficulty_policy = _normalize_difficulty_policy(payload.difficulty_policy) or "random"

    repository = GitHubRepository(
        owner_user_id=current_user.id,
        account_id=payload.account_id,
        repo_ssh_url=payload.repo_ssh_url,
        default_branch=payload.default_branch,
        solutions_dir=payload.solutions_dir,
        commit_author_name=payload.commit_author_name,
        commit_author_email=payload.commit_author_email,
        selection_strategy=selection_strategy,
        difficulty_policy=difficulty_policy,
        is_active=payload.is_active,
    )
    db.add(repository)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Conflito ao criar repositorio GitHub.") from exc
    db.refresh(repository)
    return repository


@router.put("/github/repositories/{repository_id}", response_model=GitHubRepositoryOut)
def update_github_repository(
    repository_id: int,
    payload: GitHubRepositoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repository = (
        db.query(GitHubRepository)
        .filter(GitHubRepository.id == repository_id, GitHubRepository.owner_user_id == current_user.id)
        .first()
    )
    if not repository:
        raise HTTPException(status_code=404, detail="Repositorio GitHub nao encontrado.")

    if payload.default_branch is not None:
        repository.default_branch = payload.default_branch
    if payload.solutions_dir is not None:
        repository.solutions_dir = payload.solutions_dir
    if payload.commit_author_name is not None:
        repository.commit_author_name = payload.commit_author_name
    if payload.commit_author_email is not None:
        repository.commit_author_email = payload.commit_author_email
    if payload.selection_strategy is not None:
        repository.selection_strategy = _normalize_selection_strategy(payload.selection_strategy) or repository.selection_strategy
    if payload.difficulty_policy is not None:
        repository.difficulty_policy = _normalize_difficulty_policy(payload.difficulty_policy) or repository.difficulty_policy
    if payload.is_active is not None:
        repository.is_active = payload.is_active

    db.commit()
    db.refresh(repository)
    return repository


@router.delete("/github/repositories/{repository_id}")
def delete_github_repository(
    repository_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repository = (
        db.query(GitHubRepository)
        .filter(GitHubRepository.id == repository_id, GitHubRepository.owner_user_id == current_user.id)
        .first()
    )
    if not repository:
        raise HTTPException(status_code=404, detail="Repositorio GitHub nao encontrado.")

    db.delete(repository)
    db.commit()
    return {"ok": True}


@router.post("/leetcode/jobs/run-now", response_model=LeetCodeJobOut)
def leetcode_run_now(
    payload: LeetCodeRunNowCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repository = (
        db.query(GitHubRepository)
        .filter(GitHubRepository.id == payload.repository_id, GitHubRepository.owner_user_id == current_user.id)
        .first()
    )
    if not repository:
        raise HTTPException(status_code=404, detail="Repositorio GitHub nao encontrado.")

    if not repository.is_active:
        raise HTTPException(status_code=422, detail="Repositorio GitHub inativo.")

    selection_strategy = _normalize_selection_strategy(payload.selection_strategy)
    difficulty_policy = _normalize_difficulty_policy(payload.difficulty_policy)

    max_attempts = payload.max_attempts or settings.leetcode_default_max_attempts

    job = LeetCodeJob(
        repository_id=payload.repository_id,
        source="manual",
        status="pending",
        selection_strategy=selection_strategy,
        difficulty_policy=difficulty_policy,
        problem_slug=payload.problem_slug,
        max_attempts=max_attempts,
        scheduled_for=datetime.now(UTC).replace(tzinfo=None),
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


@router.get("/leetcode/jobs", response_model=list[LeetCodeJobOut])
def list_leetcode_jobs(
    db: Session = Depends(get_db),
    limit: int = 50,
    repository_id: int | None = None,
    current_user: User = Depends(get_current_user),
):
    query = db.query(LeetCodeJob).join(GitHubRepository, GitHubRepository.id == LeetCodeJob.repository_id)
    query = query.filter(GitHubRepository.owner_user_id == current_user.id)
    if repository_id is not None:
        query = query.filter(LeetCodeJob.repository_id == repository_id)
    return query.order_by(LeetCodeJob.id.desc()).limit(limit).all()


@router.get("/leetcode/jobs/{job_id}", response_model=LeetCodeJobOut)
def get_leetcode_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = (
        db.query(LeetCodeJob)
        .join(GitHubRepository, GitHubRepository.id == LeetCodeJob.repository_id)
        .filter(LeetCodeJob.id == job_id, GitHubRepository.owner_user_id == current_user.id)
        .first()
    )
    if not job:
        raise HTTPException(status_code=404, detail="Job LeetCode nao encontrado.")
    return job


@router.get("/leetcode/jobs/{job_id}/logs", response_model=list[LeetCodeJobLogOut])
def list_leetcode_job_logs(
    job_id: int,
    db: Session = Depends(get_db),
    limit: int = 100,
    current_user: User = Depends(get_current_user),
):
    job = (
        db.query(LeetCodeJob)
        .join(GitHubRepository, GitHubRepository.id == LeetCodeJob.repository_id)
        .filter(LeetCodeJob.id == job_id, GitHubRepository.owner_user_id == current_user.id)
        .first()
    )
    if not job:
        raise HTTPException(status_code=404, detail="Job LeetCode nao encontrado.")

    return (
        db.query(LeetCodeJobLog)
        .filter(LeetCodeJobLog.job_id == job_id)
        .order_by(LeetCodeJobLog.id.asc())
        .limit(limit)
        .all()
    )


@router.get("/leetcode/schedules", response_model=list[LeetCodeScheduleOut])
def list_leetcode_schedules(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return (
        db.query(LeetCodeSchedule)
        .join(GitHubRepository, GitHubRepository.id == LeetCodeSchedule.repository_id)
        .filter(GitHubRepository.owner_user_id == current_user.id)
        .order_by(LeetCodeSchedule.id.desc())
        .all()
    )


@router.post("/leetcode/schedules", response_model=LeetCodeScheduleOut)
def create_leetcode_schedule(
    payload: LeetCodeScheduleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repository = (
        db.query(GitHubRepository)
        .filter(GitHubRepository.id == payload.repository_id, GitHubRepository.owner_user_id == current_user.id)
        .first()
    )
    if not repository:
        raise HTTPException(status_code=404, detail="Repositorio GitHub nao encontrado.")

    cron_expr = payload.cron_expr
    day_of_week = payload.day_of_week
    time_local = payload.time_local

    if not cron_expr:
        if day_of_week is None or not time_local:
            raise HTTPException(status_code=422, detail="Informe cron_expr ou (day_of_week + time_local).")
        try:
            cron_expr = _build_simple_weekly_cron(day_of_week, time_local)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    schedule = LeetCodeSchedule(
        repository_id=payload.repository_id,
        cron_expr=cron_expr,
        day_of_week=day_of_week,
        time_local=time_local,
        timezone=payload.timezone,
        selection_strategy=_normalize_selection_strategy(payload.selection_strategy),
        difficulty_policy=_normalize_difficulty_policy(payload.difficulty_policy),
        max_attempts=payload.max_attempts,
        is_active=payload.is_active,
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return schedule


@router.put("/leetcode/schedules/{schedule_id}", response_model=LeetCodeScheduleOut)
def update_leetcode_schedule(
    schedule_id: int,
    payload: LeetCodeScheduleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    schedule = (
        db.query(LeetCodeSchedule)
        .join(GitHubRepository, GitHubRepository.id == LeetCodeSchedule.repository_id)
        .filter(LeetCodeSchedule.id == schedule_id, GitHubRepository.owner_user_id == current_user.id)
        .first()
    )
    if not schedule:
        raise HTTPException(status_code=404, detail="Agenda LeetCode nao encontrada.")

    if payload.cron_expr is not None:
        schedule.cron_expr = payload.cron_expr
        schedule.day_of_week = None
        schedule.time_local = None
    elif payload.day_of_week is not None and payload.time_local:
        try:
            schedule.cron_expr = _build_simple_weekly_cron(payload.day_of_week, payload.time_local)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        schedule.day_of_week = payload.day_of_week
        schedule.time_local = payload.time_local

    if payload.timezone is not None:
        schedule.timezone = payload.timezone
    if payload.selection_strategy is not None:
        schedule.selection_strategy = _normalize_selection_strategy(payload.selection_strategy)
    if payload.difficulty_policy is not None:
        schedule.difficulty_policy = _normalize_difficulty_policy(payload.difficulty_policy)
    if payload.max_attempts is not None:
        schedule.max_attempts = payload.max_attempts
    if payload.is_active is not None:
        schedule.is_active = payload.is_active

    db.commit()
    db.refresh(schedule)
    return schedule


@router.delete("/leetcode/schedules/{schedule_id}")
def delete_leetcode_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    schedule = (
        db.query(LeetCodeSchedule)
        .join(GitHubRepository, GitHubRepository.id == LeetCodeSchedule.repository_id)
        .filter(LeetCodeSchedule.id == schedule_id, GitHubRepository.owner_user_id == current_user.id)
        .first()
    )
    if not schedule:
        raise HTTPException(status_code=404, detail="Agenda LeetCode nao encontrada.")

    db.query(LeetCodeJob).filter(LeetCodeJob.schedule_id == schedule_id).update(
        {LeetCodeJob.schedule_id: None},
        synchronize_session=False,
    )
    db.query(LeetCodeScheduleRun).filter(LeetCodeScheduleRun.schedule_id == schedule_id).delete(
        synchronize_session=False
    )
    db.delete(schedule)
    db.commit()
    return {"ok": True}


@router.get("/leetcode/completed", response_model=list[LeetCodeCompletedOut])
def list_leetcode_completed(
    db: Session = Depends(get_db),
    repository_id: int | None = None,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
):
    query = db.query(LeetCodeCompletedProblem).join(
        GitHubRepository,
        GitHubRepository.id == LeetCodeCompletedProblem.repository_id,
    )
    query = query.filter(GitHubRepository.owner_user_id == current_user.id)
    if repository_id is not None:
        query = query.filter(LeetCodeCompletedProblem.repository_id == repository_id)
    return query.order_by(LeetCodeCompletedProblem.id.desc()).limit(limit).all()
