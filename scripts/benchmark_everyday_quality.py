"""Real end-to-end translation challenge; checklist requires human evaluation."""

import argparse
import json
import statistics
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", action="store_true")
    parser.add_argument(
        "--output", type=Path, default=ROOT / "reports/model-routing/challenge.json"
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=4,
        help="Seconds between requests to respect small free-tier quotas",
    )
    args = parser.parse_args()
    if args.interval < 0:
        parser.error("--interval must be nonnegative")
    cases = json.loads((ROOT / "tests/data/everyday_translation_challenge.json").read_text())
    if not args.live:
        print(
            json.dumps(
                {"cases": cases, "note": "No API calls. Use --live to consume quota."},
                ensure_ascii=False,
                indent=2,
            )
        )
        return
    import app

    def run(case):
        started = time.perf_counter()
        with app.app.test_client() as client:
            response = client.post(
                "/api/translate",
                json={
                    k: v
                    for k, v in {**case, "cache_bypass": True}.items()
                    if k in {"text", "source", "target", "cache_bypass"}
                },
            )
            data = response.get_json() or {}
        return {
            **case,
            "http": response.status_code,
            "translation": data.get("translation"),
            "audit": data.get("audit"),
            "review": data.get("quality_review"),
            "seconds": round(time.perf_counter() - started, 3),
        }

    rows = []
    for case in cases:
        if rows:
            time.sleep(args.interval)
        rows.append(run(case))
        print(f"{case['id']}: HTTP {rows[-1]['http']}", flush=True)
    completed = [row for row in rows if row["http"] == 200]
    report = {
        "created": datetime.now(timezone.utc).isoformat(),
        "scope": "Sixteen real hybrid requests including eight source languages. Sequential requests, cache bypassed. Includes draft and optional review latency. Not a blind human accuracy rating; checklist is not an automatic score.",
        "median_seconds": statistics.median(r["seconds"] for r in completed) if completed else None,
        "interval_seconds": args.interval,
        "results": rows,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(
        json.dumps(
            {
                "report": str(args.output),
                "completed": sum(r["http"] == 200 for r in rows),
                "median_seconds": report["median_seconds"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
