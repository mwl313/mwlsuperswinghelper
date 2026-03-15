from __future__ import annotations

import html
import json
import re
from datetime import datetime, timezone
from pathlib import Path

import httpx

KIND_URL = "https://kind.krx.co.kr/corpgeneral/corpList.do?method=download&searchType=13"
ALLOWED_MARKETS = {"코스피", "코스닥", "코넥스"}
TR_RE = re.compile(r"<tr[^>]*>(.*?)</tr>", re.IGNORECASE | re.DOTALL)
CELL_RE = re.compile(r"<t[dh][^>]*>(.*?)</t[dh]>", re.IGNORECASE | re.DOTALL)
TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")


def _clean_cell(value: str) -> str:
    text = TAG_RE.sub("", value)
    text = html.unescape(text)
    return WS_RE.sub(" ", text).strip()


def _parse_rows(raw_html: str) -> list[dict[str, str]]:
    rows = TR_RE.findall(raw_html)
    if not rows:
        return []

    headers = [_clean_cell(cell) for cell in CELL_RE.findall(rows[0])]
    output: list[dict[str, str]] = []
    for row in rows[1:]:
        cells = [_clean_cell(cell) for cell in CELL_RE.findall(row)]
        if len(cells) != len(headers):
            continue
        output.append(dict(zip(headers, cells)))
    return output


def _build_symbol_map(rows: list[dict[str, str]]) -> dict[str, dict[str, str]]:
    symbols: dict[str, dict[str, str]] = {}
    for row in rows:
        market = row.get("시장구분", "")
        code = row.get("종목코드", "")
        name = row.get("회사명", "")
        if market not in ALLOWED_MARKETS:
            continue
        if len(code) != 6 or not code.isdigit():
            continue
        if not name:
            continue
        symbols[code] = {"name": name, "market": market}
    return symbols


def main() -> None:
    response = httpx.get(KIND_URL, headers={"User-Agent": "Mozilla/5.0"}, timeout=20.0)
    response.raise_for_status()

    rows = _parse_rows(response.text)
    symbol_map = _build_symbol_map(rows)
    if not symbol_map:
        raise RuntimeError("No symbols parsed from KIND source.")

    project_root = Path(__file__).resolve().parents[1]
    output_path = project_root / "app" / "data" / "krx_symbol_map.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": KIND_URL,
        "count": len(symbol_map),
        "symbols": symbol_map,
    }
    output_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"saved: {output_path}")
    print(f"symbols: {len(symbol_map)}")


if __name__ == "__main__":
    main()
