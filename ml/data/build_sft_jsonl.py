#!/usr/bin/env python3
"""Build chat-format SFT JSONL from cleaned paragraphs + curated pairs.

Curated pairs are the primary SFT signal. Cleaned paragraphs can optionally be
turned into weak continuation / rewrite tasks for domain vocabulary.

Examples:
  python data/build_sft_jsonl.py \\
    --cleaned data/work/cleaned.jsonl \\
    --pairs data/fixtures/sft_pairs.jsonl \\
    --out data/work/sft.jsonl
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

SYSTEM_MN = (
    "Чи Genghis AI, Монголын хэрэглэгчдэд зориулсан AI туслах. "
    "Монгол хэлээр (кирилл) тод, найрсаг хариул. "
    "Em dash (—) эсвэл en dash (–) бүү хэрэглэ. "
    "«Монголын анхны ChatGPT» гэж бүү хэл."
)


def read_jsonl(path: Path) -> list[dict]:
    rows: list[dict] = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return rows


def weak_tasks_from_paragraphs(paragraphs: list[dict], limit: int) -> list[dict]:
    """Cheap unsupervised-ish tasks: rewrite clearly / summarize short."""
    out: list[dict] = []
    for i, row in enumerate(paragraphs[:limit]):
        text = row["text"]
        out.append(
            {
                "id": f"weak-rewrite-{row.get('id', i)}",
                "messages": [
                    {"role": "system", "content": SYSTEM_MN},
                    {
                        "role": "user",
                        "content": "Дараах өгүүлбэрийг илүү тод, энгийн монгол хэлээр дахин бич:\n\n"
                        + text,
                    },
                    {"role": "assistant", "content": text},
                ],
            }
        )
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cleaned", type=Path, help="cleaned.jsonl from prepare_corpus")
    parser.add_argument(
        "--pairs",
        type=Path,
        required=True,
        help="Curated chat JSONL (messages[])",
    )
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument(
        "--weak-from-corpus",
        type=int,
        default=0,
        help="Add N weak rewrite tasks from cleaned paragraphs (0=off)",
    )
    args = parser.parse_args()

    rows = read_jsonl(args.pairs)
    # Normalize: ensure system prompt present
    normalized: list[dict] = []
    for row in rows:
        messages = row.get("messages") or []
        if not messages or messages[0].get("role") != "system":
            messages = [{"role": "system", "content": SYSTEM_MN}, *messages]
        normalized.append({"id": row.get("id"), "messages": messages})

    if args.weak_from_corpus and args.cleaned and args.cleaned.exists():
        paras = read_jsonl(args.cleaned)
        normalized.extend(weak_tasks_from_paragraphs(paras, args.weak_from_corpus))

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8") as f:
        for row in normalized:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    print(f"Wrote {len(normalized)} SFT examples -> {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
