from __future__ import annotations

import json
import logging
from datetime import UTC, datetime, timedelta
from pathlib import Path


class JsonFormatter(logging.Formatter):
    """Formatter simples para logs estruturados em JSON."""

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": datetime.now(UTC).isoformat(timespec="seconds"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        fields = getattr(record, "fields", None)
        if isinstance(fields, dict):
            payload.update(fields)
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


def configure_logging(logger_name: str = "autofeedr", level: int = logging.INFO) -> logging.Logger:
    """Configura logging raiz em JSON e retorna logger de aplicacao."""
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)
    return logging.getLogger(logger_name)


def log_event(logger: logging.Logger, level: int, message: str, **fields) -> None:
    """Padroniza envio de eventos com campo `fields` serializado."""
    logger.log(level, message, extra={"fields": fields})


class ExecutionStateStore:
    """Persistencia de idempotencia por minuto/usuario/topico."""

    def __init__(self, file_path: str | Path = "data/execution_state.json", retention_days: int = 7):
        self.file_path = Path(file_path)
        self.retention_days = retention_days
        self._state = {"processed": {}}

    def refresh(self) -> None:
        """Carrega estado atual e remove itens vencidos."""
        self._state = self._load()
        self._state = self._cleanup(self._state)

    def was_processed(self, minute: str, user: str, topic: str) -> bool:
        return self._key(minute, user, topic) in self._state.get("processed", {})

    def mark_processed(self, minute: str, user: str, topic: str) -> None:
        key = self._key(minute, user, topic)
        self._state.setdefault("processed", {})[key] = datetime.now(UTC).isoformat()
        self._save(self._state)

    def _key(self, minute: str, user: str, topic: str) -> str:
        return f"{minute}|{user}|{topic}"

    def _load(self) -> dict:
        if not self.file_path.exists():
            return {"processed": {}}
        try:
            return json.loads(self.file_path.read_text(encoding="utf-8"))
        except Exception:
            return {"processed": {}}

    def _save(self, state: dict) -> None:
        self.file_path.parent.mkdir(parents=True, exist_ok=True)
        self.file_path.write_text(
            json.dumps(state, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def _cleanup(self, state: dict) -> dict:
        processed = state.get("processed", {})
        if not isinstance(processed, dict):
            return {"processed": {}}

        threshold = datetime.now(UTC) - timedelta(days=self.retention_days)
        keep = {}
        for key, value in processed.items():
            try:
                parsed = datetime.fromisoformat(value)
                if parsed.tzinfo is None:
                    parsed = parsed.replace(tzinfo=UTC)
                if parsed >= threshold:
                    keep[key] = value
            except Exception:
                continue
        return {"processed": keep}
