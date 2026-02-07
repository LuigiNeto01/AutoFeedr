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

    schedule = Schedule(
        account_id=payload.account_id,
        topic=payload.topic,
        cron_expr=payload.cron_expr,
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
