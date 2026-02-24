from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import create_access_token, hash_password, hash_token, token_expires_at, verify_password
from app.core.security import build_fernet, encrypt_text
from app.core.settings import settings
from app.db.session import get_db
from app.models.models import (
    AuthToken,
    GitHubAccount,
    GitHubRepository,
    Job,
    LeetCodeCompletedProblem,
    LeetCodeJob,
    LeetCodeJobLog,
    LeetCodeSchedule,
    LeetCodeScheduleRun,
    LinkedinAccount,
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

    db.commit()
    db.refresh(user)
    return user


@router.get("/auth/openai-key")
def auth_openai_key_status(current_user: User = Depends(get_current_user)):
    return {"has_openai_api_key": current_user.has_openai_api_key}


@router.put("/auth/openai-key")
def auth_set_openai_key(
    payload: OpenAIKeyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    fernet = _fernet_or_500()
    current_user.openai_api_key_encrypted = encrypt_text(fernet, payload.api_key.strip())
    db.commit()
    db.refresh(current_user)
    return {"ok": True, "has_openai_api_key": current_user.has_openai_api_key}


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
