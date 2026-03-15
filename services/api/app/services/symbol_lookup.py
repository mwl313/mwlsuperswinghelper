from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Final

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.watchlist import WatchlistItem

_SYMBOL_NAME_CACHE: dict[str, str] = {}
_TITLE_RE: Final[re.Pattern[str]] = re.compile(r"<title>\s*([^:<]+?)\s*[:\-]", re.IGNORECASE)

# Bootstrap fallback when file map is unavailable
_FALLBACK_SYMBOLS: Final[dict[str, str]] = {
    "000100": "유한양행",
    "000270": "기아",
    "000660": "SK하이닉스",
    "005380": "현대차",
    "005490": "POSCO홀딩스",
    "005930": "삼성전자",
    "006400": "삼성SDI",
    "009150": "삼성전기",
    "012330": "현대모비스",
    "017670": "SK텔레콤",
    "028260": "삼성물산",
    "030200": "KT",
    "035420": "NAVER",
    "051900": "LG생활건강",
    "051910": "LG화학",
    "055550": "신한지주",
    "066570": "LG전자",
    "068270": "셀트리온",
    "086790": "하나금융지주",
    "096770": "SK이노베이션",
    "105560": "KB금융",
    "207940": "삼성바이오로직스",
    "259960": "크래프톤",
    "323410": "카카오뱅크",
    "352820": "하이브",
    "373220": "LG에너지솔루션",
}


def _normalize_symbol(symbol: str) -> str:
    return re.sub(r"\D", "", symbol).strip()


def _parse_naver_title(html: str) -> str | None:
    match = _TITLE_RE.search(html)
    if not match:
        return None
    name = match.group(1).strip()
    if not name or "네이버" in name:
        return None
    return name


def _resolve_from_watchlist_db(symbol: str, db: Session) -> str | None:
    row = db.scalar(select(WatchlistItem).where(WatchlistItem.symbol == symbol))
    return row.symbol_name if row else None


@lru_cache(maxsize=1)
def _load_file_symbol_map() -> dict[str, str]:
    file_path = Path(__file__).resolve().parents[1] / "data" / "krx_symbol_map.json"
    if not file_path.exists():
        return {}

    try:
        payload = json.loads(file_path.read_text(encoding="utf-8"))
    except Exception:
        return {}

    symbols = payload.get("symbols")
    if not isinstance(symbols, dict):
        return {}

    result: dict[str, str] = {}
    for code, row in symbols.items():
        if not isinstance(code, str) or len(code) != 6 or not code.isdigit():
            continue
        if isinstance(row, dict):
            name = row.get("name")
            if isinstance(name, str) and name.strip():
                result[code] = name.strip()
    return result


def _resolve_from_naver(symbol: str) -> str | None:
    try:
        response = httpx.get(
            f"https://finance.naver.com/item/main.naver?code={symbol}",
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=2.5,
        )
        if response.status_code != 200:
            return None
        return _parse_naver_title(response.text)
    except Exception:
        return None


def resolve_symbol_name(symbol: str, db: Session | None = None) -> tuple[str | None, str]:
    normalized = _normalize_symbol(symbol)
    if len(normalized) != 6:
        return None, "invalid"

    if normalized in _SYMBOL_NAME_CACHE:
        return _SYMBOL_NAME_CACHE[normalized], "cache"

    if db is not None:
        db_name = _resolve_from_watchlist_db(normalized, db)
        if db_name:
            _SYMBOL_NAME_CACHE[normalized] = db_name
            return db_name, "watchlist_db"

    file_map = _load_file_symbol_map()
    from_file = file_map.get(normalized)
    if from_file:
        _SYMBOL_NAME_CACHE[normalized] = from_file
        return from_file, "file_map"

    fallback_name = _FALLBACK_SYMBOLS.get(normalized)
    if fallback_name:
        _SYMBOL_NAME_CACHE[normalized] = fallback_name
        return fallback_name, "fallback_map"

    online_name = _resolve_from_naver(normalized)
    if online_name:
        _SYMBOL_NAME_CACHE[normalized] = online_name
        return online_name, "naver"

    return None, "not_found"
