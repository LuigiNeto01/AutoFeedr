from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import build_fernet, encrypt_text
from app.core.settings import settings
from app.db.session import get_db
from app.models.models import Job, LinkedinAccount, Schedule
from app.schemas.schemas import (
    AccountCreate,
    AccountOut,
    AccountUpdate,
    JobOut,
    ManualJobCreate,
    ScheduleCreate,
    ScheduleOut,
    ScheduleUpdate,
)


router = APIRouter()


def _build_simple_weekly_cron(day_of_week: int, time_local: str) -> str:
    hour_raw, minute_raw = time_local.split(":")
    hour = int(hour_raw)
    minute = int(minute_raw)
    if hour < 0 or hour > 23 or minute < 0 or minute > 59:
        raise ValueError("Horario invalido. Use HH:MM entre 00:00 e 23:59.")
    return f"{minute} {hour} * * {day_of_week}"


@router.get("/health")
def healthcheck():
    return {"status": "ok", "service": "autofeedr-api"}


@router.get("/accounts", response_model=list[AccountOut])
def list_accounts(db: Session = Depends(get_db)):
    return db.query(LinkedinAccount).order_by(LinkedinAccount.id.desc()).all()


@router.post("/accounts", response_model=AccountOut)
def create_account(payload: AccountCreate, db: Session = Depends(get_db)):
    existing = db.query(LinkedinAccount).filter(LinkedinAccount.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=409, detail="Conta com esse nome ja existe.")

    fernet = build_fernet(settings.token_encryption_key)
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
        fernet = build_fernet(settings.token_encryption_key)
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
