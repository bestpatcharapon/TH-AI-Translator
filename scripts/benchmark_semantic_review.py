"""Opt-in seeded meaning-error challenge; not a translation accuracy benchmark."""

import argparse
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", action="store_true", help="Consume configured provider quota")
    if not parser.parse_args().live:
        parser.error("Pass --live to send real provider requests")
    from app import MODEL, get_client
    from semantic_review import review_translation

    cases = [
        ("ไม่ใส่ถั่ว ผมแพ้ถั่วลิสง", "Add peanuts; I like peanuts.", "seeded negation and allergy error"),
        ("ถ้าฝนไม่ตกค่อยไป", "Let's go even if it rains.", "seeded reversed condition"),
        ("เขายังไม่ได้จ่ายเงิน", "He has already paid.", "seeded reversed payment state"),
        (
            "ประชุมวันที่ 15 เวลา 14:30 ไม่ใช่ 13:30",
            "The meeting is on the 15th at 13:30, not 14:30.",
            "seeded swapped times; digit counters alone cannot detect this",
        ),
        (
            "ไม่ใส่ถั่วลิสง ผมแพ้ถั่วลิสง",
            "Please don't add peanuts; I'm allergic to peanuts.",
            "adequate draft should remain unchanged",
        ),
    ]
    results = []
    for text, draft, purpose in cases:
        started = time.perf_counter()
        translation, review = review_translation(
            get_client(), MODEL, text, draft, "th", "en", "natural", "general", "", [], []
        )
        results.append(
            {
                "purpose": purpose,
                "source": text,
                "draft": draft,
                "translation": translation,
                "review": review,
                "seconds": round(time.perf_counter() - started, 3),
            }
        )
    print(
        json.dumps(
            {
                "scope": "Small Thai-English challenge with deliberately wrong drafts and one adequate draft. Review judgments require human inspection; this is not an overall accuracy score or Google comparison.",
                "model": MODEL,
                "results": results,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
