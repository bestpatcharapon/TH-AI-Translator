"""Opt-in live Thai slang sentence probe; semantic judgments are recorded separately."""

import argparse
import csv
import json
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CASES = ROOT / "tests/data/slang_translation_challenge.tsv"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", action="store_true")
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--cases", type=Path, default=CASES)
    parser.add_argument("--url", default="http://127.0.0.1:5000")
    parser.add_argument("--interval", type=float, default=2.5)
    parser.add_argument("--output", type=Path, default=ROOT / "reports/slang-100/results.json")
    args = parser.parse_args()
    if args.interval < 0:
        parser.error("--interval must be nonnegative")
    with args.cases.open() as handle:
        cases = list(csv.DictReader(handle, delimiter="\t"))
    if (
        not cases
        or len({case["term"] for case in cases}) != len(cases)
        or any(
            not all(case.get(key) for key in ("term", "text", "meaning_checklist"))
            for case in cases
        )
    ):
        raise ValueError("Expected unique case names and nonempty text/checklists")
    if not args.live:
        print(
            json.dumps(
                {"cases": cases, "note": "No API calls. --live uses provider quota."},
                ensure_ascii=False,
                indent=2,
            )
        )
        return
    report = {
        "created": datetime.now(timezone.utc).isoformat(),
        "endpoint": "/api/translate",
        "settings": {
            "source": "th",
            "target": "en",
            "tone": "natural",
            "thai_mode": "standard",
            "cache_bypass": True,
        },
        "scope": "Development sentence probes with prewritten meaning checklists. Lexical notes may already cover the expressions. Not blind human evaluation, a Google comparison, OCR or ASR testing. Model self-review is not a correctness score.",
        "case_file": str(args.cases.resolve().relative_to(ROOT))
        if args.cases.resolve().is_relative_to(ROOT)
        else args.cases.name,
        "interval_seconds": args.interval,
        "results": [],
    }
    if args.resume and args.output.exists():
        previous = json.loads(args.output.read_text())
        if previous["settings"] != report["settings"]:
            raise ValueError("Cannot resume with different settings")
        for index, row in enumerate(previous["results"]):
            if any(row[key] != cases[index][key] for key in cases[index]):
                raise ValueError("Cannot resume with changed cases")
        report = previous
    args.output.parent.mkdir(parents=True, exist_ok=True)
    for index in range(len(report["results"]), len(cases)):
        case = cases[index]
        if index:
            time.sleep(args.interval)
        attempts = []
        for attempt in range(3):
            started = time.perf_counter()
            request = urllib.request.Request(
                args.url.rstrip("/") + report["endpoint"],
                data=json.dumps({**report["settings"], "text": case["text"]}).encode(),
                headers={"Content-Type": "application/json"},
            )
            try:
                with urllib.request.urlopen(request, timeout=100) as response:
                    status, data = response.status, json.load(response)
            except urllib.error.HTTPError as error:
                status = error.code
                try:
                    data = json.loads(error.read())
                except (ValueError, UnicodeDecodeError):
                    data = {"error": "non_json_http_error"}
            except (OSError, ValueError) as error:
                status, data = None, {"error": type(error).__name__}
            attempts.append(
                {
                    "http": status,
                    "seconds": round(time.perf_counter() - started, 3),
                    **{
                        key: data.get(key)
                        for key in ("translation", "quality_review", "audit", "error")
                    },
                }
            )
            if status != 429 or attempt == 2:
                break
            print(
                f"{index + 1}/{len(cases)}: rate limit, waiting 30s before retry {attempt + 1}",
                flush=True,
            )
            time.sleep(30)
        row = {"id": index + 1, **case, **attempts[-1], "attempts": attempts}
        report["results"].append(row)
        args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
        print(
            json.dumps(
                {key: row[key] for key in ("id", "term", "http", "translation", "seconds")},
                ensure_ascii=False,
            ),
            flush=True,
        )
        if row["http"] == 429:
            print(
                "Repeated provider limit: saved partial report; no further API calls.", flush=True
            )
            break


if __name__ == "__main__":
    main()
