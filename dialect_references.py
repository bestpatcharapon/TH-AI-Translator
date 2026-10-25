"""Local, attributed dialect retrieval. Related examples are never replacement text."""

import json
import re
import sqlite3
import unicodedata
from contextlib import closing
from difflib import SequenceMatcher
from functools import lru_cache

from project_config import PROJECT_ROOT

CURATED = PROJECT_ROOT / "data/dialects/curated.json"
INDEX = PROJECT_ROOT / ".data/dialects/reference.sqlite"
SOURCE_URL = "https://zenodo.org/records/13283454"


def normalize(text):
    return re.sub(r"\s+", "", unicodedata.normalize("NFC", text))


def reference_identity():
    return tuple(
        (path.stat().st_mtime_ns, path.stat().st_size) if path.exists() else None
        for path in (CURATED, INDEX)
    )


@lru_cache(maxsize=2)
def _curated(version):
    return json.loads(CURATED.read_text()) if version is not None else []


def lexical_references(text, mode):
    query = normalize(text)
    result = []
    for entry in _curated(reference_identity()[0]):
        if mode not in ("auto", "slang", entry["dialect"]):
            continue
        aliases = [entry["term"], *entry.get("aliases", [])]
        pattern = entry.get("match_pattern")
        if pattern and not re.search(pattern, unicodedata.normalize("NFC", text)):
            continue
        if any(normalize(alias) in query for alias in aliases):
            result.append({**entry, "kind": "lexical", "match": "exact_term"})
    # Bounded context for messages containing several distinct expressions.
    result.sort(key=lambda item: len(normalize(item["term"])), reverse=True)
    selected = []
    for item in result:
        if any(normalize(item["term"]) in normalize(other["term"]) for other in selected):
            continue
        selected.append(item)
    return selected[:8]


def corpus_references(text, mode, *, index=INDEX, limit=3):
    query = normalize(text)
    if not index.exists() or not query or len(query) > 800:
        return []
    varieties = (
        ("khummuang",)
        if mode == "northern"
        else ("khummuang", "korat", "pattani")
        if mode == "auto"
        else ()
    )
    if not varieties:
        return []
    placeholders = ",".join("?" for _ in varieties)
    try:
        with closing(sqlite3.connect(f"{index.as_uri()}?mode=ro", uri=True, timeout=0.5)) as db:
            exact = db.execute(
                f"SELECT id,variety,source,central,normalized FROM examples WHERE variety IN ({placeholders}) AND normalized=? LIMIT ?",
                (*varieties, query, limit),
            ).fetchall()
            if exact:
                rows = [(row, "exact_sentence") for row in exact]
            elif mode == "northern" and len(query) >= 5:
                # Bounded OR query retrieves candidates; similarity only ranks examples.
                grams = list(dict.fromkeys(query[i : i + 3] for i in range(len(query) - 2)))
                if len(grams) > 18:
                    grams = [grams[int(i * (len(grams) - 1) / 17)] for i in range(18)]
                match = " OR ".join('"' + gram.replace('"', '""') + '"' for gram in grams)
                candidates = db.execute(
                    "SELECT e.id,e.variety,e.source,e.central,e.normalized FROM search JOIN examples e ON e.id=search.rowid WHERE search MATCH ? AND e.variety='khummuang' ORDER BY bm25(search) LIMIT 40",
                    (match,),
                ).fetchall()
                scored = [
                    (SequenceMatcher(None, query, row[4], autojunk=False).ratio(), row)
                    for row in candidates
                ]
                rows = [
                    (row, "related_example")
                    for score, row in sorted(scored, key=lambda pair: pair[0], reverse=True)[:limit]
                    if score >= 0.6
                ]
            else:
                rows = []
    except sqlite3.Error:
        # A missing/broken optional index must not make translation unavailable.
        return []
    return [
        {
            "id": f"tdc-{row[1]}-{row[0]}",
            "kind": "corpus_example",
            "variety": row[1],
            "text": row[2],
            "central_thai": row[3],
            "match": match,
            "sources": [
                {
                    "title": f"Thai Local Language Translation Dataset — {row[1]}",
                    "url": SOURCE_URL,
                    "license": "CC-BY-SA-4.0",
                }
            ],
            "usage": "Published parallel example; may contain noise. Related examples do not establish the meaning of different words or negation in the current input.",
        }
        for row, match in rows
    ]


def retrieve_references(text, mode):
    return lexical_references(text, mode) + corpus_references(text, mode)
