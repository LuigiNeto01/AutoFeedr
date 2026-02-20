from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import build_fernet, encrypt_text
from app.core.settings import settings
from app.db.session import get_db
from app.models.models import (
    GitHubAccount,
    GitHubRepository,
    Job,
    LeetCodeCompletedProblem,
    LeetCodeJob,
    LeetCodeJobLog,
    LeetCodeSchedule,
    LinkedinAccount,
    Schedule,
)
from app.schemas.schemas import (
    AccountCreate,
    AccountOut,
    AccountUpdate,
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
    LeetCodeRunNowCreate,
    LeetCodeScheduleCreate,
    LeetCodeScheduleOut,
    LeetCodeScheduleUpdate,
    ManualJobCreate,
    ScheduleCreate,
    ScheduleOut,
    ScheduleUpdate,
)
from packages.Escritor.src.prompt import PROMPT_GERACAO_POST, PROMPT_TRADUCAO


router = APIRouter()

SELECTION_STRATEGIES = {"random", "easy_first", "sequential"}
DIFFICULTY_POLICIES = {"free_any", "free_easy", "free_easy_medium"}


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
    if normalized not in DIFFICULTY_POLICIES:
        raise HTTPException(
            status_code=422,
            detail=f"difficulty_policy invalida. Use uma de: {', '.join(sorted(DIFFICULTY_POLICIES))}.",
        )
    return normalized


@router.get("/health")
def healthcheck():
    return {"status": "ok", "service": "autofeedr-api"}


@router.get("/prompts/defaults")
def default_prompts():
    return {
        "prompt_generation": PROMPT_GERACAO_POST,
        "prompt_translation": PROMPT_TRADUCAO,
    }


@router.get("/accounts", response_model=list[AccountOut])
def list_accounts(db: Session = Depends(get_db)):
    return db.query(LinkedinAccount).order_by(LinkedinAccount.id.desc()).all()


@router.post("/accounts", response_model=AccountOut)
def create_account(payload: AccountCreate, db: Session = Depends(get_db)):
    existing = db.query(LinkedinAccount).filter(LinkedinAccount.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=409, detail="Conta com esse nome ja existe.")

    fernet = _fernet_or_500()
    account = LinkedinAccount(
        name=payload.name,
        token_encrypted=encrypt_text(fernet, payload.token),
        urn=payload.urn,
        prompt_generation=payload.prompt_generation,
        prompt_translation=payload.prompt_translation,
        is_active=payload.is_active,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


@router.put("/accounts/{account_id}", response_model=AccountOut)
def update_account(account_id: int, payload: AccountUpdate, db: Session = Depends(get_db)):
    account = db.query(LinkedinAccount).filter(LinkedinAccount.id == account_id).first()
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


@router.delete("/accounts/{account_id}")
def delete_account(account_id: int, db: Session = Depends(get_db)):
    account = db.query(LinkedinAccount).filter(LinkedinAccount.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Conta nao encontrada.")

    db.delete(account)
    db.commit()
    return {"ok": True}


@router.get("/schedules", response_model=list[ScheduleOut])
def list_schedules(db: Session = Depends(get_db)):
    return db.query(Schedule).order_by(Schedule.id.desc()).all()


@router.post("/schedules", response_model=ScheduleOut)
def create_schedule(payload: ScheduleCreate, db: Session = Depends(get_db)):
    account = db.query(LinkedinAccount).filter(LinkedinAccount.id == payload.account_id).first()
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


@router.put("/schedules/{schedule_id}", response_model=ScheduleOut)
def update_schedule(schedule_id: int, payload: ScheduleUpdate, db: Session = Depends(get_db)):
    schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
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


@router.post("/jobs/publish-now", response_model=JobOut)
def publish_now(payload: ManualJobCreate, db: Session = Depends(get_db)):
    account = db.query(LinkedinAccount).filter(LinkedinAccount.id == payload.account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Conta nao encontrada.")

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


@router.get("/jobs", response_model=list[JobOut])
def list_jobs(db: Session = Depends(get_db), limit: int = 50):
    return db.query(Job).order_by(Job.id.desc()).limit(limit).all()


@router.get("/github/accounts", response_model=list[GitHubAccountOut])
def list_github_accounts(db: Session = Depends(get_db)):
    return db.query(GitHubAccount).order_by(GitHubAccount.id.desc()).all()


@router.post("/github/accounts", response_model=GitHubAccountOut)
def create_github_account(payload: GitHubAccountCreate, db: Session = Depends(get_db)):
    existing = db.query(GitHubAccount).filter(GitHubAccount.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=409, detail="Conta GitHub com esse nome ja existe.")

    fernet = _fernet_or_500()
    account = GitHubAccount(
        name=payload.name,
        ssh_key_encrypted=encrypt_text(fernet, payload.ssh_private_key),
        ssh_passphrase_encrypted=encrypt_text(fernet, payload.ssh_passphrase)
        if payload.ssh_passphrase
        else None,
        is_active=payload.is_active,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


@router.put("/github/accounts/{account_id}", response_model=GitHubAccountOut)
def update_github_account(account_id: int, payload: GitHubAccountUpdate, db: Session = Depends(get_db)):
    account = db.query(GitHubAccount).filter(GitHubAccount.id == account_id).first()
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
def delete_github_account(account_id: int, db: Session = Depends(get_db)):
    account = db.query(GitHubAccount).filter(GitHubAccount.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Conta GitHub nao encontrada.")

    db.delete(account)
    db.commit()
    return {"ok": True}


@router.get("/github/repositories", response_model=list[GitHubRepositoryOut])
def list_github_repositories(db: Session = Depends(get_db)):
    return db.query(GitHubRepository).order_by(GitHubRepository.id.desc()).all()


@router.post("/github/repositories", response_model=GitHubRepositoryOut)
def create_github_repository(payload: GitHubRepositoryCreate, db: Session = Depends(get_db)):
    account = db.query(GitHubAccount).filter(GitHubAccount.id == payload.account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Conta GitHub nao encontrada.")

    existing = db.query(GitHubRepository).filter(GitHubRepository.repo_ssh_url == payload.repo_ssh_url).first()
    if existing:
        raise HTTPException(status_code=409, detail="Repositorio GitHub ja cadastrado.")

    selection_strategy = _normalize_selection_strategy(payload.selection_strategy) or "random"
    difficulty_policy = _normalize_difficulty_policy(payload.difficulty_policy) or "free_any"

    repository = GitHubRepository(
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
    db.commit()
    db.refresh(repository)
    return repository


@router.put("/github/repositories/{repository_id}", response_model=GitHubRepositoryOut)
def update_github_repository(
    repository_id: int,
    payload: GitHubRepositoryUpdate,
    db: Session = Depends(get_db),
):
    repository = db.query(GitHubRepository).filter(GitHubRepository.id == repository_id).first()
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
def delete_github_repository(repository_id: int, db: Session = Depends(get_db)):
    repository = db.query(GitHubRepository).filter(GitHubRepository.id == repository_id).first()
    if not repository:
        raise HTTPException(status_code=404, detail="Repositorio GitHub nao encontrado.")

    db.delete(repository)
    db.commit()
    return {"ok": True}


@router.post("/leetcode/jobs/run-now", response_model=LeetCodeJobOut)
def leetcode_run_now(payload: LeetCodeRunNowCreate, db: Session = Depends(get_db)):
    repository = db.query(GitHubRepository).filter(GitHubRepository.id == payload.repository_id).first()
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
def list_leetcode_jobs(db: Session = Depends(get_db), limit: int = 50, repository_id: int | None = None):
    query = db.query(LeetCodeJob)
    if repository_id is not None:
        query = query.filter(LeetCodeJob.repository_id == repository_id)
    return query.order_by(LeetCodeJob.id.desc()).limit(limit).all()


@router.get("/leetcode/jobs/{job_id}", response_model=LeetCodeJobOut)
def get_leetcode_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(LeetCodeJob).filter(LeetCodeJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job LeetCode nao encontrado.")
    return job


@router.get("/leetcode/jobs/{job_id}/logs", response_model=list[LeetCodeJobLogOut])
def list_leetcode_job_logs(job_id: int, db: Session = Depends(get_db), limit: int = 100):
    job = db.query(LeetCodeJob).filter(LeetCodeJob.id == job_id).first()
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
def list_leetcode_schedules(db: Session = Depends(get_db)):
    return db.query(LeetCodeSchedule).order_by(LeetCodeSchedule.id.desc()).all()


@router.post("/leetcode/schedules", response_model=LeetCodeScheduleOut)
def create_leetcode_schedule(payload: LeetCodeScheduleCreate, db: Session = Depends(get_db)):
    repository = db.query(GitHubRepository).filter(GitHubRepository.id == payload.repository_id).first()
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
):
    schedule = db.query(LeetCodeSchedule).filter(LeetCodeSchedule.id == schedule_id).first()
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


@router.get("/leetcode/completed", response_model=list[LeetCodeCompletedOut])
def list_leetcode_completed(
    db: Session = Depends(get_db),
    repository_id: int | None = None,
    limit: int = 100,
):
    query = db.query(LeetCodeCompletedProblem)
    if repository_id is not None:
        query = query.filter(LeetCodeCompletedProblem.repository_id == repository_id)
    return query.order_by(LeetCodeCompletedProblem.id.desc()).limit(limit).all()
