from __future__ import annotations

import logging
import re
import time
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

import arxiv
from croniter import croniter
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import build_fernet, decrypt_text
from app.core.settings import settings
from app.db.session import SessionLocal
from app.models.models import (
    GitHubAccount,
    GitHubRepository,
    Job,
    JobLog,
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
from packages.Escritor import gerar_post
from packages.Linkedin.src.postLinkedin import postar_no_linkedin
from packages.leetcode_automation.pipeline import LeetCodePipelineInput, execute_leetcode_pipeline
from packages.shared import configure_logging, log_event


logger = logging.getLogger("autofeedr.worker")
ARXIV_URL_PATTERN = re.compile(r"arxiv\.org/(abs|pdf)/([0-9]{4}\.[0-9]{4,5})(v[0-9]+)?")


def _db_session() -> Session:
    return SessionLocal()


def _log_job(db: Session, job_id: int, level: str, message: str) -> None:
    db.add(JobLog(job_id=job_id, level=level, message=message))


def _log_leetcode_job(db: Session, job_id: int, level: str, message: str) -> None:
    db.add(LeetCodeJobLog(job_id=job_id, level=level, message=message))


def _should_run_schedule(cron_expr: str, local_now: datetime) -> bool:
    return croniter.match(cron_expr, local_now)


def _easter_sunday(year: int) -> date:
    a = year % 19
    b = year // 100
    c = year % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = ((h + l - 7 * m + 114) % 31) + 1
    return date(year, month, day)


def _seasonal_context(local_now: datetime) -> str:
    current_date = local_now.date()
    year = current_date.year
    easter = _easter_sunday(year)
    carnaval = easter - timedelta(days=47)

    if abs((current_date - carnaval).days) <= 3:
        return "Carnaval: conecte com planejamento, foco e produtividade profissional no periodo."
    if abs((current_date - easter).days) <= 3:
        return "Pascoa: conecte com renovacao, estrategia e crescimento profissional."
    if current_date.month == 5 and current_date.day == 1:
        return "Dia do Trabalhador: valorize carreira, eficiencia e impacto do trabalho."
    if current_date.month == 12 and current_date.day in range(20, 32):
        return "Natal e fim de ano: conecte com retrospectiva, metas e planejamento do proximo ciclo."

    return "Sem data comemorativa forte hoje: mantenha foco em valor pratico para o publico profissional."


def _build_prompt_only_input(schedule: Schedule, local_now: datetime) -> str:
    objective = schedule.objective or "educacional"
    audience = schedule.audience or "profissionais da area"
    cta_type = schedule.cta_type or "comentario"
    campaign_theme = schedule.campaign_theme or schedule.topic

    parts = [
        "Modo: postagem editorial sem busca externa.",
        f"Data atual: {local_now.strftime('%Y-%m-%d')}",
        f"Tema central: {schedule.topic}",
        f"Tema de campanha: {campaign_theme}",
        f"Publico alvo: {audience}",
        f"Objetivo editorial: {objective}",
        f"CTA desejada: {cta_type}",
    ]

    if schedule.use_date_context:
        parts.append(f"Contexto sazonal/profissional: {_seasonal_context(local_now)}")

    parts.extend(
        [
            "Instrucoes de escrita:",
            "- Escreva em tom profissional e claro.",
            "- Traga valor pratico e aplicavel.",
            "- Evite generalidades vagas.",
            "- Nao repita texto identico de posts anteriores.",
        ]
    )

    return "\n".join(parts)


def _enqueue_due_schedules(db: Session) -> int:
    now_utc = datetime.now(UTC)
    created = 0
    schedules = db.query(Schedule).filter(Schedule.is_active.is_(True)).all()

    for schedule in schedules:
        local_now = now_utc.astimezone(ZoneInfo(schedule.timezone))
        local_minute = local_now.replace(second=0, microsecond=0)
        if not _should_run_schedule(schedule.cron_expr, local_minute):
            continue

        run_minute_utc = local_minute.astimezone(UTC).replace(tzinfo=None)
        run = ScheduleRun(schedule_id=schedule.id, run_minute_utc=run_minute_utc)
        db.add(run)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            continue

        mode = schedule.source_mode or "arxiv"
        db.add(
            Job(
                account_id=schedule.account_id,
                source=f"schedule:{mode}",
                status="pending",
                topic=schedule.topic,
                paper_text=_build_prompt_only_input(schedule, local_minute)
                if mode == "prompt_only"
                else None,
                max_attempts=settings.worker_max_attempts,
                scheduled_for=run_minute_utc,
            )
        )
        db.commit()
        created += 1

    return created


def _enqueue_due_leetcode_schedules(db: Session) -> int:
    now_utc = datetime.now(UTC)
    created = 0
    schedules = db.query(LeetCodeSchedule).filter(LeetCodeSchedule.is_active.is_(True)).all()

    for schedule in schedules:
        local_now = now_utc.astimezone(ZoneInfo(schedule.timezone))
        local_minute = local_now.replace(second=0, microsecond=0)
        if not _should_run_schedule(schedule.cron_expr, local_minute):
            continue

        run_minute_utc = local_minute.astimezone(UTC).replace(tzinfo=None)
        run = LeetCodeScheduleRun(schedule_id=schedule.id, run_minute_utc=run_minute_utc)
        db.add(run)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            continue

        db.add(
            LeetCodeJob(
                repository_id=schedule.repository_id,
                schedule_id=schedule.id,
                source="schedule",
                status="pending",
                max_attempts=schedule.max_attempts or settings.leetcode_default_max_attempts,
                selection_strategy=schedule.selection_strategy,
                difficulty_policy=schedule.difficulty_policy,
                scheduled_for=run_minute_utc,
            )
        )
        db.commit()
        created += 1

    return created


def _extract_arxiv_id(url: str) -> str | None:
    match = ARXIV_URL_PATTERN.search(url)
    if not match:
        return None
    return match.group(2)


def _paper_info_from_url(url: str) -> str:
    arxiv_id = _extract_arxiv_id(url)
    if not arxiv_id:
        return f"Paper URL fornecida: {url}"

    search = arxiv.Search(id_list=[arxiv_id], max_results=1)
    result = next(arxiv.Client().results(search), None)
    if not result:
        return f"Paper URL fornecida: {url}"

    return (
        f"Title: {result.title}\n"
        f"Authors: {', '.join(author.name for author in result.authors)}\n"
        f"Summary: {result.summary}\n"
        f"URL: {result.entry_id}\n"
    )


def _build_content_input(job: Job) -> str:
    if job.paper_text:
        return job.paper_text

    if job.paper_url:
        return _paper_info_from_url(job.paper_url)

    if job.topic:
        from packages.arxiv_reciver.main import get_article

        articles = get_article(
            topics=[job.topic],
            per_topic=1,
            save_in_file=True,
        )
        topic_articles = articles.get(job.topic, [])
        if not topic_articles:
            raise RuntimeError(f"Nenhum artigo encontrado para o topico '{job.topic}'.")
        return str(topic_articles)

    raise RuntimeError("Job sem origem de conteudo (topic/paper_url/paper_text).")


def _normalize_urn(urn: str) -> str:
    if urn.startswith("urn:"):
        return urn
    return f"urn:li:person:{urn}"


def _process_job(db: Session, job: Job) -> None:
    fernet = build_fernet(settings.token_encryption_key)
    account = db.query(LinkedinAccount).filter(LinkedinAccount.id == job.account_id).first()
    if not account or not account.is_active:
        raise RuntimeError("Conta LinkedIn inexistente ou inativa.")
    if not account.owner_user_id:
        raise RuntimeError("Conta LinkedIn sem usuario dono. Recadastre a conta.")

    owner = db.query(User).filter(User.id == account.owner_user_id, User.is_active.is_(True)).first()
    if not owner or not owner.openai_api_key_encrypted:
        raise RuntimeError("Usuario sem OPENAI_API_KEY cadastrada na aplicacao.")
    user_openai_api_key = decrypt_text(fernet, owner.openai_api_key_encrypted)

    token = decrypt_text(fernet, account.token_encrypted)
    content_input = _build_content_input(job)
    post_text = gerar_post(
        content_input,
        prompt_generation=account.prompt_generation,
        prompt_translation=account.prompt_translation,
        openai_api_key=user_openai_api_key,
    )
    if not post_text:
        raise RuntimeError("Falha ao gerar post com IA.")

    posted = postar_no_linkedin(token, _normalize_urn(account.urn), post_text)
    if not posted:
        raise RuntimeError("LinkedIn retornou falha na publicacao.")

    job.generated_post = post_text


def _process_pending_jobs(db: Session) -> int:
    now_naive = datetime.now(UTC).replace(tzinfo=None)
    pending = (
        db.query(Job)
        .filter(Job.status.in_(["pending", "retry"]), Job.scheduled_for <= now_naive)
        .order_by(Job.id.asc())
        .limit(10)
        .all()
    )
    processed = 0

    for job in pending:
        job.status = "running"
        job.updated_at = datetime.utcnow()
        db.flush()

        try:
            _process_job(db, job)
            job.status = "success"
            job.error_message = None
            _log_job(db, job.id, "INFO", "Publicacao concluida com sucesso.")
            log_event(logger, logging.INFO, "job_success", job_id=job.id, account_id=job.account_id)
        except Exception as exc:
            if str(exc).startswith("PIPELINE_ATTEMPTS_EXHAUSTED"):
                job.attempts = job.max_attempts
                job.status = "failed"
                job.next_retry_at = None
                job.error_message = str(exc)
                _log_leetcode_job(db, job.id, "ERROR", f"Falha final de qualidade: {exc}")
                log_event(
                    logger,
                    logging.ERROR,
                    "leetcode_job_failed_quality",
                    job_id=job.id,
                    repository_id=job.repository_id,
                    error=str(exc),
                )
                processed += 1
                continue

            job.attempts += 1
            job.error_message = str(exc)
            if job.attempts >= job.max_attempts:
                job.status = "failed"
                job.next_retry_at = None
                _log_job(db, job.id, "ERROR", f"Falha final: {exc}")
                log_event(
                    logger,
                    logging.ERROR,
                    "job_failed_final",
                    job_id=job.id,
                    account_id=job.account_id,
                    attempts=job.attempts,
                    error=str(exc),
                )
            else:
                retry_delay = timedelta(minutes=2 * job.attempts)
                retry_at = datetime.now(UTC) + retry_delay
                job.status = "retry"
                job.scheduled_for = retry_at.replace(tzinfo=None)
                job.next_retry_at = retry_at.replace(tzinfo=None)
                _log_job(db, job.id, "WARNING", f"Falha tentativa {job.attempts}: {exc}")
                log_event(
                    logger,
                    logging.WARNING,
                    "job_retry_scheduled",
                    job_id=job.id,
                    account_id=job.account_id,
                    attempts=job.attempts,
                    retry_at=retry_at.isoformat(timespec="seconds"),
                    error=str(exc),
                )
        finally:
            processed += 1

    db.commit()
    return processed


def _process_single_leetcode_job(db: Session, job: LeetCodeJob) -> None:
    repository = db.query(GitHubRepository).filter(GitHubRepository.id == job.repository_id).first()
    if not repository or not repository.is_active:
        raise RuntimeError("Repositorio GitHub inexistente ou inativo.")

    account = db.query(GitHubAccount).filter(GitHubAccount.id == repository.account_id).first()
    if not account or not account.is_active:
        raise RuntimeError("Conta GitHub inexistente ou inativa.")

    if not account.ssh_key_encrypted:
        raise RuntimeError("Conta GitHub sem chave SSH cadastrada.")

    user_prompt = None
    user_openai_api_key = None
    if repository.owner_user_id:
        owner = db.query(User).filter(User.id == repository.owner_user_id, User.is_active.is_(True)).first()
        if owner:
            user_prompt = owner.leetcode_solution_prompt
            if owner.openai_api_key_encrypted:
                user_openai_api_key = decrypt_text(fernet, owner.openai_api_key_encrypted)
    if not user_openai_api_key:
        raise RuntimeError("Usuario sem OPENAI_API_KEY cadastrada na aplicacao.")

    fernet = build_fernet(settings.token_encryption_key)
    ssh_private_key = decrypt_text(fernet, account.ssh_key_encrypted)
    ssh_passphrase = (
        decrypt_text(fernet, account.ssh_passphrase_encrypted)
        if account.ssh_passphrase_encrypted
        else None
    )

    completed_ids = {
        row.problem_frontend_id
        for row in db.query(LeetCodeCompletedProblem.problem_frontend_id)
        .filter(LeetCodeCompletedProblem.repository_id == repository.id)
        .all()
    }

    payload = LeetCodePipelineInput(
        repo_ssh_url=repository.repo_ssh_url,
        default_branch=repository.default_branch,
        solutions_dir=repository.solutions_dir,
        commit_author_name=repository.commit_author_name,
        commit_author_email=repository.commit_author_email,
        ssh_private_key=ssh_private_key,
        ssh_passphrase=ssh_passphrase,
        selection_strategy=(job.selection_strategy or repository.selection_strategy or "random"),
        difficulty_policy=(job.difficulty_policy or repository.difficulty_policy or "free_any"),
        completed_frontend_ids=completed_ids,
        forced_problem_slug=job.problem_slug,
        max_attempts=job.max_attempts,
        graphql_url=settings.leetcode_graphql_url,
        http_timeout_seconds=settings.leetcode_http_timeout_seconds,
        test_timeout_seconds=settings.leetcode_test_timeout_seconds,
        tmp_root=settings.worker_tmp_dir,
        solution_prompt_template=user_prompt,
        openai_api_key=user_openai_api_key,
    )

    result = execute_leetcode_pipeline(payload)

    job.problem_frontend_id = result.problem_frontend_id
    job.problem_slug = result.problem_slug
    job.problem_title = result.problem_title
    job.problem_difficulty = result.problem_difficulty
    job.solution_path = result.solution_path
    job.tests_path = result.tests_path
    job.commit_sha = result.commit_sha
    job.commit_url = result.commit_url

    completed = LeetCodeCompletedProblem(
        repository_id=repository.id,
        job_id=job.id,
        problem_frontend_id=result.problem_frontend_id,
        problem_slug=result.problem_slug,
        problem_title=result.problem_title,
        problem_difficulty=result.problem_difficulty,
        commit_sha=result.commit_sha,
    )
    db.add(completed)


def _process_pending_leetcode_jobs(db: Session) -> int:
    now_naive = datetime.now(UTC).replace(tzinfo=None)
    pending = (
        db.query(LeetCodeJob)
        .filter(LeetCodeJob.status.in_(["pending", "retry"]), LeetCodeJob.scheduled_for <= now_naive)
        .order_by(LeetCodeJob.id.asc())
        .limit(10)
        .all()
    )
    processed = 0

    for job in pending:
        job.status = "running"
        job.updated_at = datetime.utcnow()
        db.flush()

        try:
            _log_leetcode_job(db, job.id, "INFO", "Iniciando pipeline LeetCode -> GitHub.")
            _process_single_leetcode_job(db, job)
            job.status = "success"
            job.error_message = None
            _log_leetcode_job(db, job.id, "INFO", "Pipeline concluido com sucesso.")
            log_event(
                logger,
                logging.INFO,
                "leetcode_job_success",
                job_id=job.id,
                repository_id=job.repository_id,
                problem_id=job.problem_frontend_id,
                commit_sha=job.commit_sha,
            )
        except IntegrityError as exc:
            db.rollback()
            refreshed = db.query(LeetCodeJob).filter(LeetCodeJob.id == job.id).first()
            if not refreshed:
                continue
            refreshed.attempts += 1
            refreshed.error_message = f"Falha de deduplicacao/consistencia: {exc}"
            refreshed.status = "failed"
            refreshed.next_retry_at = None
            _log_leetcode_job(db, refreshed.id, "ERROR", refreshed.error_message)
            log_event(
                logger,
                logging.ERROR,
                "leetcode_job_failed_integrity",
                job_id=refreshed.id,
                repository_id=refreshed.repository_id,
                error=str(exc),
            )
        except Exception as exc:
            job.attempts += 1
            job.error_message = str(exc)
            if job.attempts >= job.max_attempts:
                job.status = "failed"
                job.next_retry_at = None
                _log_leetcode_job(db, job.id, "ERROR", f"Falha final: {exc}")
                log_event(
                    logger,
                    logging.ERROR,
                    "leetcode_job_failed_final",
                    job_id=job.id,
                    repository_id=job.repository_id,
                    attempts=job.attempts,
                    error=str(exc),
                )
            else:
                retry_delay = timedelta(minutes=settings.leetcode_retry_base_minutes * job.attempts)
                retry_at = datetime.now(UTC) + retry_delay
                job.status = "retry"
                job.scheduled_for = retry_at.replace(tzinfo=None)
                job.next_retry_at = retry_at.replace(tzinfo=None)
                _log_leetcode_job(db, job.id, "WARNING", f"Falha tentativa {job.attempts}: {exc}")
                log_event(
                    logger,
                    logging.WARNING,
                    "leetcode_job_retry_scheduled",
                    job_id=job.id,
                    repository_id=job.repository_id,
                    attempts=job.attempts,
                    retry_at=retry_at.isoformat(timespec="seconds"),
                    error=str(exc),
                )
        finally:
            processed += 1

    db.commit()
    return processed


def run_worker_loop() -> None:
    global logger
    logger = configure_logging("autofeedr.worker")
    log_event(
        logger,
        logging.INFO,
        "worker_start",
        poll_seconds=settings.worker_poll_seconds,
        default_timezone=settings.default_timezone,
    )

    while True:
        db = _db_session()
        try:
            enqueued = _enqueue_due_schedules(db)
            if enqueued:
                log_event(logger, logging.INFO, "schedules_enqueued", count=enqueued)

            enqueued_leetcode = _enqueue_due_leetcode_schedules(db)
            if enqueued_leetcode:
                log_event(logger, logging.INFO, "leetcode_schedules_enqueued", count=enqueued_leetcode)

            processed = _process_pending_jobs(db)
            if processed:
                log_event(logger, logging.INFO, "jobs_processed", count=processed)

            processed_leetcode = _process_pending_leetcode_jobs(db)
            if processed_leetcode:
                log_event(logger, logging.INFO, "leetcode_jobs_processed", count=processed_leetcode)
        except Exception as exc:
            db.rollback()
            log_event(logger, logging.ERROR, "worker_cycle_failed", error=str(exc))
        finally:
            db.close()

        time.sleep(settings.worker_poll_seconds)


if __name__ == "__main__":
    run_worker_loop()
