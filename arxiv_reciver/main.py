import json
from pathlib import Path
from datetime import datetime
import os

from .src.article_receiver import fetch_articles_by_topics

DATA_DIR = Path("data")
TEMP_OUTPUT = DATA_DIR / "temp_article.json"

def get_article(topics: list[str], start: str = None, end: str = None, per_topic: int = 2, save_in_file: bool = False) -> dict:
    # Roteia a consulta com ou sem intervalo de datas.
    print(f"Buscando artigos para topics={topics} per_topic={per_topic} save_in_file={save_in_file}")
    if start and end:
        print(f"Usando intervalo de datas: {start} ate {end}")
        results = fetch_articles_by_topics(
            topics=topics,
            start_date=start,
            end_date=end,
            per_topic=per_topic,
        )
    else:
        print("Usando intervalo padrao (dia anterior em UTC).")
        results = fetch_articles_by_topics(
            topics=topics,
            per_topic=per_topic,
        )

    if save_in_file:
        print(f"Salvando resultados em {TEMP_OUTPUT}")
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        TEMP_OUTPUT.write_text(
            json.dumps(results, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
    print("Busca concluida.")
    return results
    

if __name__ == "__main__":
    # Obtendo artigos recentes sobre os temas
    topics = ["Computer Vision"]
    start = "2025-10-17T00:00:00"
    end = "2025-10-17T23:59:59"
    results = fetch_articles_by_topics(
        topics,
        start_date=start,
        end_date=end,
        per_topic=2,
    )

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    TEMP_OUTPUT.write_text(
        json.dumps(results, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
