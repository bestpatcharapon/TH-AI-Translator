"""Blind A/B human rating of app vs Google translations from compare_google_translate.cjs.

prepare: shuffle each row's two translations into anonymous A/B columns and write a
rating sheet plus a separate unblinding key. score: unblind one or more filled sheets.
"""

import argparse
import csv
import json
import random
import sys
from collections import Counter, defaultdict
from pathlib import Path

SYSTEMS = ("app", "google")
WINNERS = ("A", "B", "tie", "both_wrong")
COLUMNS = (
    "id",
    "source_language",
    "target_language",
    "source_text",
    "meaning_criteria",
    "translation_A",
    "translation_B",
    "winner",
    "meaning_error_A",
    "meaning_error_B",
    "notes",
)
CAVEAT = (
    "Results are only as good as the raters and the sample: a small hand-written case set "
    "rated by a few people is indicative, not a population accuracy score."
)


def _translation(row, system):
    value = (row.get(system) or {}).get("translation")
    return value.strip() if isinstance(value, str) and value.strip() else ""


def build_sheet(results, seed):
    """Return (sheet_rows, key, skipped_ids) with app/google randomly assigned to A/B."""
    rng = random.Random(seed)
    rows, key, skipped = [], {}, []
    for row in results:
        texts = {system: _translation(row, system) for system in SYSTEMS}
        if not all(texts.values()):
            skipped.append(row.get("id"))
            continue
        order = list(SYSTEMS)
        rng.shuffle(order)
        key[row["id"]] = {"A": order[0], "B": order[1]}
        rows.append(
            {
                "id": row["id"],
                "source_language": row.get("source", ""),
                "target_language": row.get("target", ""),
                "source_text": row.get("text", ""),
                "meaning_criteria": row.get("check", ""),
                "translation_A": texts[order[0]],
                "translation_B": texts[order[1]],
                "winner": "",
                "meaning_error_A": "",
                "meaning_error_B": "",
                "notes": "",
            }
        )
    rng.shuffle(rows)  # Also hide any ordering by system quality or case category.
    return rows, key, skipped


def prepare(results_path, out_dir, seed=None, overwrite=False):
    report = json.loads(Path(results_path).read_text(encoding="utf-8"))
    results = report["results"] if isinstance(report, dict) else report
    out_dir = Path(out_dir)
    sheet_path, key_path = out_dir / "sheet.csv", out_dir / "key.json"
    existing = [str(path) for path in (sheet_path, key_path) if path.exists()]
    if existing and not overwrite:
        raise FileExistsError(f"Refusing to overwrite {', '.join(existing)}; pass --overwrite.")
    rows, key, skipped = build_sheet(results, seed)
    out_dir.mkdir(parents=True, exist_ok=True)
    # utf-8-sig adds a BOM so Excel detects UTF-8 and shows Thai correctly.
    with sheet_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(rows)
    key_path.write_text(
        json.dumps(
            {"seed": seed, "source": str(results_path), "key": key}, ensure_ascii=False, indent=2
        )
        + "\n",
        encoding="utf-8",
    )
    return {"sheet": str(sheet_path), "key": str(key_path), "rows": len(rows), "skipped": skipped}


def _yes_no(value):
    value = (value or "").strip().lower()
    if value in ("y", "yes", "1", "true"):
        return True
    if value in ("n", "no", "0", "false"):
        return False
    return None


def read_ratings(path):
    with Path(path).open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def unblind(key, ratings):
    """Map one rater's sheet rows to per-item outcomes named by system."""
    items, blank, invalid = {}, [], []
    for row in ratings:
        item_id = (row.get("id") or "").strip()
        if item_id not in key:
            invalid.append(item_id or "(missing id)")
            continue
        raw = (row.get("winner") or "").strip()
        winner = next((choice for choice in WINNERS if choice.lower() == raw.lower()), None)
        if not raw:
            blank.append(item_id)
            continue
        if winner is None:
            invalid.append(item_id)
            continue
        mapping = key[item_id]
        outcome = mapping[winner] if winner in ("A", "B") else winner
        items[item_id] = {
            "winner": outcome,
            "meaning_error": {
                mapping["A"]: _yes_no(row.get("meaning_error_A")),
                mapping["B"]: _yes_no(row.get("meaning_error_B")),
            },
            "pair": f"{row.get('source_language', '')}->{row.get('target_language', '')}",
        }
    return items, blank, invalid


def summarize(items):
    outcomes = Counter(item["winner"] for item in items.values())
    summary = {
        "rated": len(items),
        "app_wins": outcomes["app"],
        "google_wins": outcomes["google"],
        "ties": outcomes["tie"],
        "both_wrong": outcomes["both_wrong"],
        "meaning_error_rate": {},
    }
    for system in SYSTEMS:
        marks = [item["meaning_error"][system] for item in items.values()]
        marked = [mark for mark in marks if mark is not None]
        summary["meaning_error_rate"][system] = {
            "errors": sum(marked),
            "marked": len(marked),
            "rate": round(sum(marked) / len(marked), 4) if marked else None,
        }
    pairs = defaultdict(Counter)
    for item in items.values():
        pairs[item["pair"]][item["winner"]] += 1
    summary["by_language_pair"] = {
        pair: {
            "rated": sum(counts.values()),
            "app_wins": counts["app"],
            "google_wins": counts["google"],
            "ties": counts["tie"],
            "both_wrong": counts["both_wrong"],
        }
        for pair, counts in sorted(pairs.items())
    }
    return summary


def cohen_kappa(first, second):
    """Cohen's kappa for two equal-length label lists; None when undefined."""
    if len(first) != len(second) or not first:
        return None
    total = len(first)
    observed = sum(a == b for a, b in zip(first, second)) / total
    left, right = Counter(first), Counter(second)
    expected = sum(left[label] * right[label] for label in set(left) | set(right)) / total**2
    if expected == 1:
        return None
    return (observed - expected) / (1 - expected)


def agreement(raters):
    results = []
    names = list(raters)
    for index, first in enumerate(names):
        for second in names[index + 1 :]:
            shared = sorted(set(raters[first]) & set(raters[second]))
            a = [raters[first][item]["winner"] for item in shared]
            b = [raters[second][item]["winner"] for item in shared]
            same = sum(x == y for x, y in zip(a, b))
            kappa = cohen_kappa(a, b)
            results.append(
                {
                    "raters": [first, second],
                    "shared_items": len(shared),
                    "same_winner": same,
                    "percent_agreement": round(100 * same / len(shared), 1) if shared else None,
                    "cohen_kappa": round(kappa, 4) if kappa is not None else None,
                }
            )
    return results


def score(key_path, rating_paths):
    key = json.loads(Path(key_path).read_text(encoding="utf-8"))
    key = key.get("key", key)
    per_rater, raters, pooled = {}, {}, {}
    for path in rating_paths:
        name = Path(path).stem
        while name in raters:
            name += "_"
        items, blank, invalid = unblind(key, read_ratings(path))
        raters[name] = items
        per_rater[name] = {
            "file": str(path),
            **summarize(items),
            "blank_rows": len(blank),
            "invalid_rows": invalid,
        }
        pooled.update({f"{name}:{item_id}": item for item_id, item in items.items()})
    return {
        "caveat": CAVEAT,
        "items_in_key": len(key),
        "per_rater": per_rater,
        "pooled": summarize(pooled),
        "agreement": agreement(raters),
    }


def print_summary(report):
    print(CAVEAT)
    for name, data in report["per_rater"].items():
        errors = data["meaning_error_rate"]
        print(
            f"[{name}] rated {data['rated']} (blank {data['blank_rows']}, invalid "
            f"{len(data['invalid_rows'])}): app {data['app_wins']}, google "
            f"{data['google_wins']}, tie {data['ties']}, both wrong {data['both_wrong']}; "
            f"meaning errors app {errors['app']['rate']}, google {errors['google']['rate']}"
        )
    pooled = report["pooled"]
    print(
        f"[pooled] {pooled['rated']} ratings: app {pooled['app_wins']}, google "
        f"{pooled['google_wins']}, tie {pooled['ties']}, both wrong {pooled['both_wrong']}"
    )
    for pair in report["agreement"]:
        print(
            f"agreement {pair['raters'][0]} vs {pair['raters'][1]}: "
            f"{pair['percent_agreement']}% of {pair['shared_items']} shared, "
            f"kappa {pair['cohen_kappa']}"
        )


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    make = commands.add_parser("prepare", help="Write anonymized sheet.csv and key.json")
    make.add_argument("--results", required=True)
    make.add_argument("--out-dir", required=True)
    make.add_argument("--seed", type=int)
    make.add_argument("--overwrite", action="store_true")
    rate = commands.add_parser("score", help="Unblind filled rating sheets")
    rate.add_argument("--key", required=True)
    rate.add_argument("--ratings", required=True, nargs="+")
    rate.add_argument("--out")
    args = parser.parse_args(argv)
    if args.command == "prepare":
        try:
            info = prepare(args.results, args.out_dir, args.seed, args.overwrite)
        except FileExistsError as error:
            parser.exit(1, f"{error}\n")
        print(f"Wrote {info['rows']} rows to {info['sheet']}; keep {info['key']} away from raters.")
        if info["skipped"]:
            print(f"Skipped (missing a translation): {', '.join(map(str, info['skipped']))}")
        return 0
    report = score(args.key, args.ratings)
    print_summary(report)
    if args.out:
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.out).write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(f"Wrote {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
