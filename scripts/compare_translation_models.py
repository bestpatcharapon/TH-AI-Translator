"""Compare raw translations, measured latency and token usage; human review is required."""

import argparse
import json
import os
import statistics
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

CASES = [
    "ช่วยจองโต๊ะสำหรับสองคนเย็นพรุ่งนี้ให้หน่อยได้ไหมครับ",
    "ไม่ใส่ถั่วลิสงนะครับ ผมแพ้ถั่วลิสงอย่างรุนแรง",
    "ถ้าฝนไม่ตก เราค่อยออกเดินทางตอนห้าโมงเย็น",
    "ราคาเดิม 150 บาท ลดเหลือ 50 บาท ไม่ใช่ 5 บาท",
    "เขายังไม่ได้จ่ายเงิน แต่บอกว่าจะโอนให้พรุ่งนี้",
    "เรื่องนี้มันลูบหน้าปะจมูก ผมเลยไม่อยากเข้าไปยุ่ง",
    "ขอเลื่อนนัดจากวันจันทร์เป็นวันอังคาร เวลาเดิมนะครับ",
    "บ่เป็นหยัง เดี๋ยวมื้ออื่นค่อยเว้ากันใหม่",
]
# USD per million tokens, checked 2026-10-24. Estimates exclude free tiers/caching.
PRICES = {"groq": (0.15, 0.60), "gemini": (0.30, 2.50)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", action="store_true", help="Send real paid API requests")
    parser.add_argument(
        "--providers", nargs="+", choices=["groq", "gemini"], default=["groq", "gemini"]
    )
    parser.add_argument("--output", type=Path, default=Path("reports/model-comparison.json"))
    args = parser.parse_args()
    if not args.live:
        print(
            json.dumps(
                {
                    "cases": CASES,
                    "note": "Pass --live to consume provider quota. No accuracy ranking is generated.",
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return
    from app import build_system_prompt, get_client
    from linguistic_guidance import linguistic_guidance
    from model_routing import DEFAULT_REVIEW_MODEL, _gemini_client
    from project_config import MODEL, TRANSLATION_REASONING_EFFORT

    # Validate all keys before spending quota on either provider.
    for provider in args.providers:
        key = "GEMINI_API_KEY" if provider == "gemini" else "GROQ_API_KEY"
        if not os.getenv(key):
            parser.error(f"Missing {key}; add it locally to .env, never to a report")
    providers = {}
    if "groq" in args.providers:
        providers["groq"] = (get_client(), MODEL)
    if "gemini" in args.providers:
        providers["gemini"] = (
            _gemini_client(os.environ["GEMINI_API_KEY"]),
            os.getenv("GEMINI_REVIEW_MODEL", DEFAULT_REVIEW_MODEL),
        )
    rows = []
    for text in CASES:
        for provider, (client, model) in providers.items():
            row = {"provider": provider, "model": model, "source": text}
            started = time.perf_counter()
            try:
                options = (
                    {"reasoning_effort": TRANSLATION_REASONING_EFFORT}
                    if provider == "groq"
                    and model.startswith("openai/gpt-oss")
                    and TRANSLATION_REASONING_EFFORT
                    else {}
                )
                response = client.chat.completions.create(
                    model=model,
                    temperature=0.2,
                    max_completion_tokens=2500,
                    timeout=30,
                    messages=[
                        {
                            "role": "system",
                            "content": build_system_prompt("th", "en", "natural")
                            + linguistic_guidance(text),
                        },
                        {"role": "user", "content": text},
                    ],
                    **options,
                )
                choice = response.choices[0]
                row.update(translation=choice.message.content, finish_reason=choice.finish_reason)
                if response.usage:
                    usage = response.usage
                    row.update(
                        input_tokens=usage.prompt_tokens, output_tokens=usage.completion_tokens
                    )
                    # Only apply published rates to the exact models these prices describe.
                    priced = model == (
                        "openai/gpt-oss-120b" if provider == "groq" else DEFAULT_REVIEW_MODEL
                    )
                    row["estimated_usd"] = (
                        (
                            usage.prompt_tokens * PRICES[provider][0]
                            + usage.completion_tokens * PRICES[provider][1]
                        )
                        / 1_000_000
                        if priced
                        else None
                    )
            except Exception as error:
                # Avoid logging request URLs, headers, credentials or raw provider errors.
                row["error_type"] = type(error).__name__
            row["seconds"] = round(time.perf_counter() - started, 3)
            rows.append(row)
    summary = {}
    for provider in providers:
        samples = [r for r in rows if r["provider"] == provider and not r.get("error_type")]
        summary[provider] = {
            "completed": len(samples),
            "median_seconds": statistics.median(r["seconds"] for r in samples) if samples else None,
            "estimated_usd": sum(r.get("estimated_usd") or 0 for r in samples),
        }
    report = {
        "created": datetime.now(timezone.utc).isoformat(),
        "scope": "8 Thai-English sentences; raw single-pass translations, not the whole app pipeline. Not a blind accuracy benchmark. Thinking tokens are included in reported output usage when supplied by provider.",
        "pricing_checked": "2026-10-24",
        "summary": summary,
        "results": rows,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"report": str(args.output), "summary": summary}, indent=2))


if __name__ == "__main__":
    main()
