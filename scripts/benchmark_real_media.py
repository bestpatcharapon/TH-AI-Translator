"""Opt-in OCR/speech check on REAL user photos and recordings listed in a manifest.

Runs each file through the app's own /api/photo-translate or /api/transcribe route
(in-process Flask test client, so the real provider calls and quota are used) and
reports character error rate (CER) against the human-written expected text.
"""

import argparse
import json
import mimetypes
import statistics
import sys
import time
import unicodedata
from collections import defaultdict
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

DEFAULT_MANIFEST = ROOT / "data/real-media/manifest.json"
# Scripts written without spaces between words: spacing is arbitrary, so compare
# characters with all whitespace removed.
UNSPACED_LANGUAGES = {"th", "lo", "km", "my", "zh", "zh-TW", "yue", "ja", "bo"}
KINDS = ("image", "audio")


def normalize_text(text, language=""):
    """NFKC, casefold, drop punctuation, collapse spaces (or remove them for unspaced scripts).

    NFKC also unifies Thai/Lao SARA AM with its decomposed NIKHAHIT + SARA AA spelling.
    """
    text = unicodedata.normalize("NFKC", text or "").casefold()
    text = "".join(
        " " if unicodedata.category(char).startswith(("P", "Z", "C")) or char.isspace() else char
        for char in text
    )
    if language in UNSPACED_LANGUAGES:
        return "".join(text.split())
    return " ".join(text.split())


def levenshtein(first, second):
    if len(first) < len(second):
        first, second = second, first
    previous = list(range(len(second) + 1))
    for index, left in enumerate(first, 1):
        current = [index]
        for position, right in enumerate(second, 1):
            current.append(
                min(
                    previous[position] + 1,
                    current[position - 1] + 1,
                    previous[position - 1] + (left != right),
                )
            )
        previous = current
    return previous[-1]


def character_error_rate(expected, actual, language=""):
    """Edit distance over normalized characters divided by expected length (may exceed 1)."""
    reference = normalize_text(expected, language)
    hypothesis = normalize_text(actual, language)
    if not reference:
        return 0.0 if not hypothesis else 1.0
    return levenshtein(reference, hypothesis) / len(reference)


def summarize(items):
    scored = [item for item in items if item.get("cer") is not None]
    rates = [item["cer"] for item in scored]

    def stats(values):
        return {
            "count": len(values),
            "mean_cer": round(statistics.fmean(values), 4) if values else None,
            "median_cer": round(statistics.median(values), 4) if values else None,
        }

    groups = defaultdict(list)
    for item in scored:
        groups[(item["kind"], item["language"])].append(item["cer"])
    return {
        "items": len(items),
        "failed": len(items) - len(scored),
        **stats(rates),
        "by_kind": {kind: stats([i["cer"] for i in scored if i["kind"] == kind]) for kind in KINDS},
        "by_language": {
            f"{kind}:{language}": stats(values)
            for (kind, language), values in sorted(groups.items())
        },
    }


def load_manifest(path):
    items = json.loads(Path(path).read_text(encoding="utf-8"))
    items = items.get("items", items) if isinstance(items, dict) else items
    for index, item in enumerate(items):
        missing = [
            field for field in ("file", "kind", "language", "expected_text") if not item.get(field)
        ]
        if missing:
            raise ValueError(f"Manifest item {index} is missing {', '.join(missing)}")
        if item["kind"] not in KINDS:
            raise ValueError(f"Manifest item {index}: kind must be 'image' or 'audio'")
    return items


def run_item(client, item, base):
    path = (base / item["file"]).resolve()
    data = path.read_bytes()
    mimetype = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    upload = (BytesIO(data), path.name, mimetype)
    started = time.perf_counter()
    if item["kind"] == "image":
        response = client.post(
            "/api/photo-translate",
            data={
                "file": upload,
                "source": item["language"],
                "target": item.get("target") or ("en" if item["language"] == "th" else "th"),
                "tone": "natural",
            },
        )
        body = response.get_json(silent=True) or {}
        text = "\n".join(region.get("text", "") for region in body.get("regions", []))
        extra = {
            "translation": "\n".join(r.get("translation", "") for r in body.get("regions", [])),
            "review_required": body.get("review_required"),
        }
    else:
        response = client.post(
            "/api/transcribe", data={"file": upload, "language": item["language"]}
        )
        body = response.get_json(silent=True) or {}
        text = body.get("text", "")
        extra = {
            "review_required": body.get("review_required"),
            "review_reasons": body.get("review_reasons"),
        }
    result = {
        **{key: item.get(key) for key in ("file", "kind", "language", "notes")},
        "http_status": response.status_code,
        "seconds": round(time.perf_counter() - started, 3),
        "expected_text": item["expected_text"],
        "recognized_text": text,
        **extra,
    }
    if response.status_code == 200:
        result["cer"] = round(
            character_error_rate(item["expected_text"], text, item["language"]), 4
        )
    else:
        result["cer"] = None
        result["error"] = body.get("error", f"HTTP {response.status_code}")
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", action="store_true", help="Consume real OCR/speech API quota")
    parser.add_argument("--manifest", default=str(DEFAULT_MANIFEST))
    parser.add_argument("--out-dir", default=str(ROOT / "reports/real-media"))
    args = parser.parse_args(argv)
    if not args.live:
        parser.error("Pass --live: real files are sent to the configured OCR/speech providers.")
    manifest = Path(args.manifest)
    items = load_manifest(manifest)
    import app

    client = app.app.test_client()
    results = []
    for item in items:
        try:
            result = run_item(client, item, manifest.parent)
        except OSError as error:
            result = {**item, "cer": None, "error": str(error)}
        results.append(result)
        print(item["file"], result.get("cer"), result.get("error", ""))
    report = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "manifest": str(manifest),
        "scope": (
            "Real user media, single run per file. CER = Levenshtein distance over normalized "
            "characters / expected length; region order in photos affects CER. Small samples "
            "are indicative only."
        ),
        "summary": summarize(results),
        "items": results,
    }
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    output = out_dir / f"{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    summary = report["summary"]
    print(
        f"{summary['items']} items, {summary['failed']} failed, mean CER {summary['mean_cer']}, "
        f"median CER {summary['median_cer']}; wrote {output}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
