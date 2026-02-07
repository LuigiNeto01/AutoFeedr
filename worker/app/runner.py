from __future__ import annotations

import logging
import re
import time
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

import arxiv
from croniter import croniter
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from Escritor import gerar_post
from Linkedin.src.postLinkedin import postar_no_linkedin
from app.core.security import build_fernet, decrypt_text
from app.core.settings import settings
from app.db.session import SessionLocal
from app.models.models import Job, JobLog, LinkedinAccount, Schedule, ScheduleRun
from shared import configure_logging, log_event


logger = logging.getLogger("autofeedr.worker")
ARXIV_URL_PATTERN = re.compile(r"arxiv\.org/(abs|pdf)/([0-9]{4}\.[0-9]{4,5})(v[0-9]+)?")


def _db_session() -> Session:
    return SessionLocal()


def _log_job(db: Session, job_id: int, level: str, message: str) -> None:
    db.add(JobLog(job_id=job_id, level=level, message=message))


def _should_run_schedule(cron_expr: str, local_now: datetime) -> bool:
    return croniter.match(cron_expr, local_now)


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

        db.add(
            Job(
                account_id=schedule.account_id,
                source="schedule",
                status="pending",
                topic=schedule.topic,
                max_attempts=settings.worker_max_attempts,
                scheduled_for=run_minute_utc,
            )
        )
        created += 1

    db.commit()
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
        from arxiv_reciver.main import get_article

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

    token = decrypt_text(fernet, account.token_encrypted)
    content_input = _build_content_input(job)
    post_text = gerar_post(
        content_input,
        prompt_generation=account.prompt_generation,
        prompt_translation=account.prompt_translation,
    )
    if not post_text:
        raise RuntimeError("Falha ao gerar post com Gemini.")

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

            processed = _process_pending_jobs(db)
            if processed:
                log_event(logger, logging.INFO, "jobs_processed", count=processed)
        except Exception as exc:
            db.rollback()
            log_event(logger, logging.ERROR, "worker_cycle_failed", error=str(exc))
        finally:
            db.close()

        time.sleep(settings.worker_poll_seconds)


if __name__ == "__main__":
    run_worker_loop()
