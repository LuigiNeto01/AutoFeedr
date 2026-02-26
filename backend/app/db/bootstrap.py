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


def _execute(sql: str) -> None:
    with engine.begin() as conn:
        conn.execute(text(sql))


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
    _add_column_if_missing("users", "leetcode_solution_prompt TEXT", "leetcode_solution_prompt")
    _add_column_if_missing("users", "openai_api_key_encrypted TEXT", "openai_api_key_encrypted")
    _add_column_if_missing("users", "role VARCHAR(32) DEFAULT 'user'", "role")
    _add_column_if_missing("users", "preferred_llm_model VARCHAR(120)", "preferred_llm_model")

    _execute("UPDATE users SET role = 'user' WHERE role IS NULL OR TRIM(role) = ''")
    _execute(
        """
        UPDATE users
        SET role = 'admin'
        WHERE id = (
            SELECT id
            FROM users
            WHERE is_active = TRUE
            ORDER BY id ASC
            LIMIT 1
        )
        AND NOT EXISTS (
            SELECT 1 FROM users WHERE role = 'admin'
        )
        """
    )
    _execute(
        """
        INSERT INTO platform_llm_settings (id, provider, default_model, is_active, created_at, updated_at)
        SELECT 1, 'openai', 'gpt-5-nano', TRUE, NOW() AT TIME ZONE 'UTC', NOW() AT TIME ZONE 'UTC'
        WHERE NOT EXISTS (SELECT 1 FROM platform_llm_settings WHERE id = 1)
        """
    )
    _execute(
        """
        INSERT INTO llm_model_configs
            (provider, model, input_price_per_1m, cached_input_price_per_1m, output_price_per_1m, is_enabled, created_at, updated_at)
        SELECT 'openai', 'gpt-5-nano', '0.05', '0.005', '0.40', TRUE, NOW() AT TIME ZONE 'UTC', NOW() AT TIME ZONE 'UTC'
        WHERE NOT EXISTS (
            SELECT 1 FROM llm_model_configs WHERE provider = 'openai' AND model = 'gpt-5-nano'
        )
        """
    )
