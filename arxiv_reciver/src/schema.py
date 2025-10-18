from dataclasses import dataclass
from typing import List
from datetime import datetime

@dataclass
class ArxivArticle:
    """Estrutura básica para representar um artigo retornado pela API."""

    title: str
    summary: str
    authors: List[str]
    published: datetime
    updated: datetime
    url: str