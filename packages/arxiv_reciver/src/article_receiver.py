"""
Módulo simples para consultar artigos no arXiv de acordo com temas e janela de datas.

O objetivo é oferecer uma API mínima, porém legível, que abstraia a montagem das
consultas e o parsing dos resultados.
"""
from __future__ import annotations

from dataclasses import asdict
from datetime import UTC, datetime, timedelta, time
from typing import Any, Dict, Iterable, List, Optional

import arxiv

from ..src.schema import ArxivArticle

ARXIV_CLIENT = arxiv.Client()


def _normalize_topics(topics: Iterable[str]) -> List[str]:
    if not topics:
        raise ValueError("A lista de assuntos não pode ser vazia.")

    normalized = [topic.strip() for topic in topics if topic and topic.strip()]
    print(f"Topics normalizados: {normalized}")
    if not normalized:
        raise ValueError("Todos os assuntos informados são vazios ou inválidos.")
    return normalized

def _ensure_datetime(value: Optional[datetime | str], fallback: datetime) -> datetime:
    if value is None:
        return fallback
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=UTC)
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value)
        except ValueError as exc:
            raise ValueError(
                f"Não foi possível converter o valor '{value}' para datetime. "
                "Use o formato ISO 8601 (YYYY-MM-DD ou YYYY-MM-DDTHH:MM:SS)."
            ) from exc
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)
    raise TypeError("Use datetime ou string para representar datas.")

def _format_date_for_query(date_value: datetime) -> str:
    # A API do arXiv espera datas no formato YYYYMMDDHHMMSS na constraint submittedDate.
    return date_value.astimezone(UTC).strftime("%Y%m%d%H%M%S")

def _build_date_range(start_date: datetime, end_date: datetime) -> str:
    if start_date > end_date:
        raise ValueError("A data inicial deve ser anterior ou igual à data final.")
    return f"submittedDate:[{_format_date_for_query(start_date)} TO {_format_date_for_query(end_date)}]"

def _search_topic(
    topic: str,
    date_constraint: str,
    max_results: int,
) -> List[ArxivArticle]:
    search_query = f"all:{topic} AND {date_constraint}"
    print(f"Consultando arXiv: {search_query} (max_results={max_results})")
    search = arxiv.Search(
        query=search_query,
        max_results=max_results,
        sort_by=arxiv.SortCriterion.SubmittedDate,
        sort_order=arxiv.SortOrder.Descending,
    )

    articles: List[ArxivArticle] = []
    for result in ARXIV_CLIENT.results(search):
        articles.append(
            ArxivArticle(
                title=result.title,
                summary=result.summary,
                authors=[author.name for author in result.authors],
                published=result.published,
                updated=result.updated,
                url=result.entry_id,
            )
        )
    return articles

def _serialize_results(results: Dict[str, List[ArxivArticle]]) -> Dict[str, Any]:
    serialized: Dict[str, Any] = {}
    for topic, articles in results.items():
        serialized[topic] = []
        for article in articles:
            article_dict = asdict(article)
            article_dict["published"] = article.published.isoformat()
            article_dict["updated"] = article.updated.isoformat()
            serialized[topic].append(article_dict)
    return serialized

def fetch_articles_by_topics(
    topics: Iterable[str],
    start_date: Optional[datetime | str] = None,
    end_date: Optional[datetime | str] = None,
    per_topic: int = 5,
) -> Dict[str, Any]:
    """
    Consulta o arXiv por uma lista de temas e retorna artigos agrupados por assunto.

    Args:
        topics: coleção de termos de busca (ex.: ["machine learning", "quantum"]).
        start_date: data inicial (datetime ou string ISO). Padrão: início do dia anterior (UTC).
        end_date: data final (datetime ou string ISO). Padrão: final do dia anterior (UTC).
        per_topic: quantidade máxima de artigos por assunto.

    Returns:
        Dicionário com o tema como chave e a lista de artigos como valor.
        Inclui a chave "intervalo_consulta" com o período usado na busca.
    """
    normalized_topics = _normalize_topics(topics)

    # Define intervalo padrao (dia anterior) quando datas nao sao informadas.
    now_utc = datetime.now(UTC)
    previous_day = (now_utc - timedelta(days=1)).date()
    default_start = datetime.combine(previous_day, time.min, tzinfo=UTC)
    default_end = datetime.combine(previous_day, time.max, tzinfo=UTC)

    resolved_end = _ensure_datetime(end_date, default_end)
    resolved_start = _ensure_datetime(start_date, default_start)

    date_constraint = _build_date_range(resolved_start, resolved_end)
    print(f"Intervalo de consulta: {resolved_start.isoformat()} ate {resolved_end.isoformat()}")

    catalog: Dict[str, List[ArxivArticle]] = {}
    for topic in normalized_topics:
        catalog[topic] = _search_topic(topic, date_constraint, per_topic)
    serialized_results = _serialize_results(catalog)
    serialized_results["intervalo_consulta"] = {
        "inicio": resolved_start.isoformat(),
        "fim": resolved_end.isoformat(),
    }
    return serialized_results

if __name__ == "__main__":
    demo_topics = ["machine learning", "quantum computing"]
    results = fetch_articles_by_topics(demo_topics, per_topic=5)
    print("Artigos recentes no arXiv por tema:")
    for subject, articles in results.items():
        print(f"\n=== {subject} ===")
        if not articles:
            print("Nenhum artigo encontrado no intervalo padrão.")
            continue
        for article in articles:
            print(f"- {article.title} ({article.published:%Y-%m-%d})")
