#!/usr/bin/env python3
"""Score mn_v0 (or similar) against an OpenAI-compatible chat endpoint.

Does not download models. Point --base-url at vLLM/Ollama/xAI/OpenAI-compatible.

Example:
  python eval/run_eval.py \\
    --set eval/sets/mn_v0.jsonl \\
    --base-url http://127.0.0.1:8000/v1 \\
    --model genghis-mn \\
    --out eval/work/mn_v0_report.json

Offline structural check (no API calls):
  python eval/run_eval.py --set eval/sets/mn_v0.jsonl --lint-only
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path


def read_jsonl(path: Path) -> list[dict]:
    rows: list[dict] = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return rows


def chat_completion(base_url: str, api_key: str | None, model: str, prompt: str) -> str:
    url = base_url.rstrip("/") + "/chat/completions"
    body = {
        "model": model,
        "temperature": 0.2,
        "messages": [
            {
                "role": "system",
                "content": (
                    "Чи Genghis AI. Монгол хэлээр тод хариул. "
                    "Em dash бүү хэрэглэ. «Монголын анхны ChatGPT» гэж бүү хэл."
                ),
            },
            {"role": "user", "content": prompt},
        ],
    }
    data = json.dumps(body).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=120) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    return payload["choices"][0]["message"]["content"]


def score_text(text: str, checks: dict) -> tuple[bool, list[str]]:
    failures: list[str] = []
    if checks.get("forbid_em_dash") and ("\u2014" in text or "—" in text):
        failures.append("contains_em_dash")
    for needle in checks.get("must_include_any") or []:
        # OR group handled below
        pass
    must_any = checks.get("must_include_any") or []
    if must_any and not any(n.casefold() in text.casefold() for n in must_any):
        failures.append(f"missing_any:{must_any}")
    for needle in checks.get("must_not_include") or []:
        if needle.casefold() in text.casefold():
            failures.append(f"forbidden:{needle}")
    return (len(failures) == 0), failures


def lint_set(rows: list[dict]) -> int:
    ok = True
    required = {"id", "slice", "prompt", "checks"}
    for i, row in enumerate(rows):
        missing = required - set(row)
        if missing:
            print(f"Row {i}: missing {missing}", file=sys.stderr)
            ok = False
        if "\u2014" in row.get("prompt", ""):
            print(f"Row {i} ({row.get('id')}): prompt has em dash", file=sys.stderr)
            ok = False
    print(f"Linted {len(rows)} items; {'OK' if ok else 'FAILED'}")
    return 0 if ok else 2


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--set", type=Path, required=True)
    parser.add_argument("--base-url", type=str, default=None)
    parser.add_argument("--model", type=str, default=None)
    parser.add_argument("--api-key", type=str, default=None)
    parser.add_argument("--out", type=Path, default=None)
    parser.add_argument("--lint-only", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    rows = read_jsonl(args.set)
    if args.limit:
        rows = rows[: args.limit]

    if args.lint_only:
        return lint_set(rows)

    if not args.base_url or not args.model:
        print("--base-url and --model required unless --lint-only", file=sys.stderr)
        return 2

    results = []
    passed = 0
    for row in rows:
        try:
            answer = chat_completion(args.base_url, args.api_key, args.model, row["prompt"])
            ok, failures = score_text(answer, row.get("checks") or {})
        except (urllib.error.URLError, urllib.error.HTTPError, KeyError, TimeoutError) as exc:
            answer = ""
            ok, failures = False, [f"request_error:{exc}"]
        if ok:
            passed += 1
        results.append(
            {
                "id": row["id"],
                "slice": row.get("slice"),
                "pass": ok,
                "failures": failures,
                "answer": answer,
                "rubric": row.get("rubric"),
            }
        )
        status = "PASS" if ok else "FAIL"
        print(f"{status} {row['id']} {failures or ''}")

    report = {
        "set": str(args.set),
        "model": args.model,
        "base_url": args.base_url,
        "passed": passed,
        "total": len(rows),
        "pass_rate": (passed / len(rows)) if rows else 0.0,
        "results": results,
    }
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Wrote {args.out}")
    print(f"Score: {passed}/{len(rows)} ({report['pass_rate']:.0%})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
