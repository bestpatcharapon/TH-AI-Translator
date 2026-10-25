"""Opt-in sourced dialect regression. Model outputs need human semantic review."""

import argparse
import json
import subprocess
import sys
import time
import types
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", action="store_true")
    parser.add_argument(
        "--baseline",
        action="store_true",
        help="Also run the last committed generator on the two reported retort cases",
    )
    parser.add_argument("--interval", type=float, default=8)
    parser.add_argument(
        "--output", type=Path, default=ROOT / "reports/dialect-grounding/results.json"
    )
    args = parser.parse_args()
    if args.interval < 0:
        parser.error("--interval must be nonnegative")
    cases = json.loads((ROOT / "tests/data/dialect_translation_challenge.json").read_text())
    if not args.live:
        print(
            json.dumps(
                {"cases": cases, "note": "No API calls. --live consumes provider quota."},
                ensure_ascii=False,
                indent=2,
            )
        )
        return
    from app import MODEL, get_client
    from thai_interpretation import interpret_thai

    runs = []
    commit = None
    baseline = None
    if args.baseline:
        commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
        source = subprocess.check_output(
            ["git", "show", "HEAD:thai_interpretation.py"], cwd=ROOT, text=True
        )
        module = types.ModuleType("committed_dialect_baseline")
        exec(compile(source, "committed_dialect_baseline", "exec"), module.__dict__)
        baseline = module.interpret_thai
    for case in cases:
        functions = [("sourced_hybrid", interpret_thai)]
        if baseline and case["id"].startswith("reported-retort"):
            functions.insert(0, ("committed_generator", baseline))
        for label, function in functions:
            if runs:
                time.sleep(args.interval)
            started = time.perf_counter()
            row = {**case, "pipeline": label}
            try:
                row["result"] = function(
                    get_client(),
                    MODEL,
                    case["text"],
                    case["target"],
                    "natural and fluent",
                    "general",
                    "",
                    case["mode"],
                    [],
                    "",
                    [],
                    [],
                    "Thai",
                )
            except Exception as error:
                row["error_type"] = type(error).__name__
                row["http_status"] = getattr(error, "status_code", None)
            row["seconds"] = round(time.perf_counter() - started, 3)
            runs.append(row)
            print(
                case["id"],
                label,
                "error" if row.get("error_type") else row["result"]["status"],
                flush=True,
            )
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(
                json.dumps(
                    {
                        "created": datetime.now(timezone.utc).isoformat(),
                        "scope": "Six development regressions; reported cases and corpus-adjacent examples are NOT held-out evaluation. No blind human ratings or accuracy percentage. Baseline is the last committed generator, not the temporary quarantine behavior. Independent model checks do not prove correctness.",
                        "baseline_commit": commit,
                        "results": runs,
                    },
                    ensure_ascii=False,
                    indent=2,
                )
                + "\n"
            )
    print("Saved", args.output)


if __name__ == "__main__":
    main()
