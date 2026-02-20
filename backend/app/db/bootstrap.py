from sqlalchemy import inspect, text

from app.db.base import Base
from app.db.session import engine


def _column_exists(table_name: str, column_name: str) -> bool:
    inspector = inspect(engine)
    columns = [column["name"] for column in inspector.get_columns(table_name)]
    return column_name in columns


def _add_column_if_missing(table_name: str, column_sql: str, column_name: str) -> None:
    if _column_exists(table_name, column_name):
        return
    with engine.begin() as conn:
        conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_sql}"))


def ensure_schema() -> None:
    Base.metadata.create_all(bind=engine)

    _add_column_if_missing("linkedin_accounts", "prompt_generation TEXT", "prompt_generation")
    _add_column_if_missing("linkedin_accounts", "prompt_translation TEXT", "prompt_translation")

    _add_column_if_missing("schedules", "day_of_week INTEGER", "day_of_week")
    _add_column_if_missing("schedules", "time_local VARCHAR(5)", "time_local")

    _add_column_if_missing("schedules", "source_mode VARCHAR(32) DEFAULT 'arxiv'", "source_mode")
    _add_column_if_missing("schedules", "objective VARCHAR(64)", "objective")
    _add_column_if_missing("schedules", "audience VARCHAR(120)", "audience")
    _add_column_if_missing("schedules", "cta_type VARCHAR(32)", "cta_type")
    _add_column_if_missing("schedules", "campaign_theme VARCHAR(255)", "campaign_theme")
    _add_column_if_missing("schedules", "use_date_context BOOLEAN DEFAULT TRUE", "use_date_context")
    _add_column_if_missing("linkedin_accounts", "owner_user_id INTEGER", "owner_user_id")
    _add_column_if_missing("github_accounts", "owner_user_id INTEGER", "owner_user_id")
    _add_column_if_missing("github_repositories", "owner_user_id INTEGER", "owner_user_id")
