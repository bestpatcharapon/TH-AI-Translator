"""Download and index attributed dialect examples; no AI or API keys required."""

import csv
import hashlib
import io
import json
import sqlite3
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
URL = "https://zenodo.org/api/records/13283454/files/train.csv/content"
SHA256 = "dc872806a8a033b8cba4d9fe05e2eb1c4069fc945490381981131cd8912af110"


def build_index(raw, destination):
    from dialect_references import normalize

    if hashlib.sha256(raw).hexdigest() != SHA256:
        raise ValueError("Dataset checksum changed; inspect the publisher's new version first")
    rows = csv.DictReader(io.StringIO(raw.decode("utf-8-sig")))
    if not {"sentence", "thai_sentence", "dialect"} <= set(rows.fieldnames or []):
        raise ValueError("Unexpected dataset schema")
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(".building.sqlite")
    temporary.unlink(missing_ok=True)
    counts = {}
    try:
        with sqlite3.connect(temporary) as db:
            db.execute(
                "CREATE TABLE examples(id INTEGER PRIMARY KEY, variety TEXT, source TEXT, central TEXT, normalized TEXT, UNIQUE(variety,source,central))"
            )
            db.execute("CREATE INDEX exact_source ON examples(variety,normalized)")
            db.execute(
                "CREATE VIRTUAL TABLE search USING fts5(normalized, content='examples', content_rowid='id', tokenize='trigram')"
            )
            for row in rows:
                variety, source, central = (
                    row["dialect"],
                    row["sentence"].strip(),
                    row["thai_sentence"].strip(),
                )
                if (
                    variety not in {"khummuang", "korat", "pattani"}
                    or not source
                    or not central
                    or max(len(source), len(central)) > 500
                ):
                    continue
                db.execute(
                    "INSERT OR IGNORE INTO examples(variety,source,central,normalized) VALUES(?,?,?,?)",
                    (variety, source, central, normalize(source)),
                )
            db.execute("INSERT INTO search(search) VALUES('rebuild')")
            db.execute("CREATE TABLE metadata(key TEXT PRIMARY KEY, value TEXT)")
            db.executemany(
                "INSERT INTO metadata VALUES(?,?)",
                [
                    ("sha256", SHA256),
                    ("source_url", "https://zenodo.org/records/13283454"),
                    ("license", "CC-BY-SA-4.0"),
                    ("schema", "1"),
                ],
            )
            counts = dict(db.execute("SELECT variety,count(*) FROM examples GROUP BY variety"))
        temporary.replace(destination)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise
    return counts


def main():
    destination = ROOT / ".data/dialects/reference.sqlite"
    request = urllib.request.Request(
        URL, headers={"User-Agent": "TH-AI-Translator/dialect-reference-setup"}
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        raw = response.read(8 * 1024 * 1024 + 1)
    if len(raw) > 8 * 1024 * 1024:
        raise ValueError("Dataset exceeds expected size")
    counts = build_index(raw, destination)
    print(
        json.dumps(
            {"index": str(destination), "counts": counts, "license": "CC-BY-SA-4.0"},
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
