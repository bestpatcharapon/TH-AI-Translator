"""Shared language choices and per-feature availability, loaded by Python and JS.

Whisper language identifiers: https://github.com/openai/whisper/blob/main/whisper/tokenizer.py
Display names use Unicode CLDR via Intl.DisplayNames. Voice IDs were checked with
edge_tts.list_voices(); availability can change at the speech provider.
Text choices are AI translation requests, not a claim of evaluated model quality.
"""

import json
from pathlib import Path

CATALOG = json.loads(
    (Path(__file__).parent / "static/language-catalog.json").read_text(encoding="utf-8")
)
LANGUAGES = {code: entry["name"] for code, entry in CATALOG.items()}
VOICES = {code: entry["voice"] for code, entry in CATALOG.items() if entry["voice"]}
OCR_LANGUAGES = {code: entry["ocr"] for code, entry in CATALOG.items() if entry["ocr"]}
