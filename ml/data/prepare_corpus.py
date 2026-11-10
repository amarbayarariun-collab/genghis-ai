#!/usr/bin/env python3
"""Download / prepare Mongolian Cyrillic text for Phase 1.

Default is --fixture-only (no network). Full Wikipedia dump download is
optional and can be large; use on a GPU/data box when ready.

Examples:
  python data/prepare_corpus.py --fixture-only --out data/work/cleaned.jsonl
  python data/prepare_corpus.py --sources fixture,wikipedia --out data/work/cleaned.jsonl
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FIXTURE_TXT = ROOT / "fixtures" / "mn_sample.txt"

# Cyrillic block + common punctuation (Mongolian Cyrillic uses Russian-like range
# plus Өө Үү).
CYRILLIC_RE = re.compile(r"[\u0400-\u04FF]")
URL_RE = re.compile(r"https?://\S+|www\.\S+", re.I)
WS_RE = re.compile(r"\s+")

# Wikimedia mnwiki dump listing (latest pages-articles). Operator should pin a date.
WIKI_DUMP_LISTING = "https://dumps.wikimedia.org/mnwiki/latest/"
WIKI_PAGES_ARTICLES = (
    "https://dumps.wikimedia.org/mnwiki/latest/mnwiki-latest-pages-articles.xml.bz2"
)


def cyrillic_ratio(text: str) -> float:
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return 0.0
    cyr = sum(1 for c in letters if CYRILLIC_RE.match(c))
    return cyr / len(letters)


def clean_paragraph(text: str) -> str:
    text = URL_RE.sub(" ", text)
    text = text.replace("\u2014", ",").replace("\u2013", "-")
    text = WS_RE.sub(" ", text).strip()
    return text


def is_good_paragraph(text: str, min_chars: int = 40) -> bool:
    if len(text) < min_chars:
        return False
    if cyrillic_ratio(text) < 0.55:
        return False
    # Skip wiki markup-ish leftovers
    if text.count("{") > 2 or text.count("[[") > 3:
        return False
    return True


def paragraphs_from_text(raw: str) -> list[str]:
    chunks: list[str] = []
    for block in re.split(r"\n\s*\n", raw):
        line = clean_paragraph(block.replace("\n", " "))
        if line.startswith("#"):
            continue
        if is_good_paragraph(line):
            chunks.append(line)
    return chunks


def record(source: str, text: str) -> dict:
    h = hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]
    return {
        "id": f"{source}-{h}",
        "source": source,
        "text": text,
        "lang": "mn",
        "script": "cyrillic",
    }


def load_fixture() -> list[dict]:
    raw = FIXTURE_TXT.read_text(encoding="utf-8")
    return [record("fixture-mn-sample", p) for p in paragraphs_from_text(raw)]


def download(url: str, dest: Path, timeout: int = 120) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {url} -> {dest}", file=sys.stderr)
    with urllib.request.urlopen(url, timeout=timeout) as resp, open(dest, "wb") as out:
        while True:
            chunk = resp.read(1024 * 1024)
            if not chunk:
                break
            out.write(chunk)


def extract_wiki_plain(xml_path: Path, limit: int | None) -> list[dict]:
    """Very small MediaWiki XML extractor (uncompressed XML).

    For bz2 dumps, decompress externally first, or pass a truncated XML fixture.
    """
    rows: list[dict] = []
    # Stream parse to avoid huge RAM on full dumps
    context = ET.iterparse(xml_path, events=("end",))
    for _event, elem in context:
        if not elem.tag.endswith("text"):
            continue
        text = elem.text or ""
        elem.clear()
        # Strip simple templates / tags lightly
        text = re.sub(r"\{\{[^}]+\}\}", " ", text)
        text = re.sub(r"\[\[([^|\]]+\|)?([^\]]+)\]\]", r"\2", text)
        text = re.sub(r"<[^>]+>", " ", text)
        for p in paragraphs_from_text(text):
            rows.append(record("wikipedia-mn", p))
            if limit and len(rows) >= limit:
                return rows
    return rows


def maybe_wikipedia(work_dir: Path, limit: int | None, skip_download: bool) -> list[dict]:
    """Download is optional; full dump is large (~tens of MB+ compressed)."""
    xml_path = work_dir / "mnwiki-pages-articles.xml"
    bz2_path = work_dir / "mnwiki-latest-pages-articles.xml.bz2"

    if xml_path.exists():
        return extract_wiki_plain(xml_path, limit)

    if skip_download:
        print(
            "Wikipedia XML not found and --skip-download set; skipping.",
            file=sys.stderr,
        )
        return []

    print(
        "NOTE: Full mnwiki pages-articles dump can be large. "
        f"Listing: {WIKI_DUMP_LISTING}",
        file=sys.stderr,
    )
    if not bz2_path.exists():
        try:
            download(WIKI_PAGES_ARTICLES, bz2_path)
        except Exception as exc:  # noqa: BLE001 — surface network errors clearly
            print(f"Wikipedia download failed ({exc}). Use --fixture-only.", file=sys.stderr)
            return []

    print(
        f"Compressed dump at {bz2_path}. Decompress to {xml_path} then re-run:\n"
        f"  bunzip2 -k {bz2_path} && mv {bz2_path.with_suffix('')} {xml_path}\n"
        "(or bunzip2 into the expected xml path on your OS).",
        file=sys.stderr,
    )
    return []


def dedupe(rows: list[dict]) -> list[dict]:
    seen: set[str] = set()
    out: list[dict] = []
    for row in rows:
        key = row["text"].casefold()
        if key in seen:
            continue
        seen.add(key)
        out.append(row)
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--sources",
        default="fixture",
        help="Comma list: fixture,wikipedia (default: fixture)",
    )
    parser.add_argument(
        "--fixture-only",
        action="store_true",
        help="Force sources=fixture (no network)",
    )
    parser.add_argument("--out", type=Path, required=True, help="Output JSONL path")
    parser.add_argument(
        "--work-dir",
        type=Path,
        default=ROOT / "work",
        help="Download / decompress workspace",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Optional max paragraphs (useful for smoke tests)",
    )
    parser.add_argument(
        "--skip-download",
        action="store_true",
        help="Never hit the network for Wikipedia",
    )
    args = parser.parse_args()

    sources = ["fixture"] if args.fixture_only else [
        s.strip() for s in args.sources.split(",") if s.strip()
    ]

    rows: list[dict] = []
    for src in sources:
        if src == "fixture":
            rows.extend(load_fixture())
        elif src == "wikipedia":
            rows.extend(
                maybe_wikipedia(args.work_dir, args.limit, args.skip_download)
            )
        else:
            print(f"Unknown source: {src}", file=sys.stderr)
            return 2

    rows = dedupe(rows)
    if args.limit:
        rows = rows[: args.limit]

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    print(f"Wrote {len(rows)} paragraphs -> {args.out}")
    print("Update data/LICENCES.md if you downloaded new shards.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
