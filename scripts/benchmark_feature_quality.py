"""Opt-in synthetic photo/document/speech probes using the real application services."""

import argparse
import asyncio
import io
import json
import sys
import time
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def speech_translation_result(status, reading, translate, source, target):
    """Keep uncertain transcripts for human review instead of translating guessed wording."""
    result = {"transcription_http": status, "reading": reading, "translation": None}
    if status != 200:
        result["status"] = "transcription_failed"
    elif reading.get("review_required"):
        result["status"] = "pending_review"
    else:
        translation = translate(reading["text"], source, target, "live")
        result["translation"] = translation
        result["status"] = "translated" if translation["http"] == 200 else "translation_failed"
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", action="store_true")
    parser.add_argument("--output", type=Path, default=ROOT / "reports/slang-upgrade/features.json")
    args = parser.parse_args()
    if not args.live:
        parser.error("Use --live to call OCR, speech, transcription and translation services")
    import app
    from services import create_speech

    args.output.parent.mkdir(parents=True, exist_ok=True)
    report = {
        "scope": "Synthetic clean images, TXT and TTS clips, real app/provider calls. Not original user photos, live microphone input, accented/noisy speech, blind evaluation or a Google comparison. No ASR/OCR model change is claimed.",
        "results": [],
    }

    def record(kind, expected, run):
        started = time.perf_counter()
        row = {"kind": kind, "expected": expected}
        try:
            row["result"] = run()
        except Exception as error:
            # Provider exception strings can contain request details; never log them.
            row["error_type"] = type(error).__name__
        row["seconds"] = round(time.perf_counter() - started, 3)
        report["results"].append(row)
        args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
        print(json.dumps(row, ensure_ascii=False), flush=True)
        time.sleep(3)

    with app.app.test_client() as client:

        def translate(text, source="th", target="en", scope="text"):
            response = client.post(
                "/api/translate",
                json={
                    "text": text,
                    "source": source,
                    "target": target,
                    "tone": "natural",
                    "cache_scope": scope,
                    "cache_bypass": True,
                },
            )
            return {"http": response.status_code, **response.get_json()}

        def photo():
            image = Image.new("RGB", (1000, 480), "#faf7ef")
            draw = ImageDraw.Draw(image)
            font = ImageFont.truetype(str(ROOT / "static/fonts/NotoSansThai-Bold.ttf"), 35)
            for i, text in enumerate(
                ["เพื่อนป้ายยาหูฟังจนฉันซื้อ", "รุ่นนี้แบตอึด กินขาดจริง", "ราคา 1,250 บาท", "รับประกัน 2 ปี"]
            ):
                draw.text((35, 35 + i * 100), text, font=font, fill="#151515")
            buffer = io.BytesIO()
            image.save(buffer, format="PNG")
            (args.output.parent / "photo-fixture.png").write_bytes(buffer.getvalue())
            response = client.post(
                "/api/photo-translate",
                data={
                    "source": "th",
                    "target": "en",
                    "tone": "natural",
                    "file": (io.BytesIO(buffer.getvalue()), "photo-fixture.png"),
                },
            )
            data = response.get_json()
            # Keep positioned readings/labels and metadata without duplicating base64 pixels.
            data.pop("image", None)
            return {"http": response.status_code, **data}

        record(
            "photo",
            "A friend recommended headphones and speaker bought them; impressive battery performance; price 1,250 baht and two-year warranty stay unchanged.",
            photo,
        )

        def document():
            text = "เพื่อนป้ายยาหูฟัง แต่ฉันยังไม่ได้ซื้อ\nส่งเอกสารให้สมาชิก 50 คน ไม่ใช่ 5 คน\nพยาบาลป้ายยาบนแผลแล้วปิดผ้าก๊อซ"
            (args.output.parent / "document-fixture.txt").write_text(text)
            response = client.post(
                "/api/extract",
                data={
                    "kind": "document",
                    "file": (io.BytesIO(text.encode()), "document-fixture.txt"),
                },
            )
            extraction = response.get_json()
            return {
                "extraction_http": response.status_code,
                "extracted": extraction,
                "translation": translate(extraction["text"], scope="document")
                if response.status_code == 200
                else None,
            }

        record(
            "document",
            "Extract all three lines unchanged; no headphone purchase yet, 50 not 5 members, and medication applied to a wound, not a label.",
            document,
        )

        for source, target, text in [
            ("th", "en", "ฉันอยู่สองด้อม เมนของฉันคือมือกลอง"),
            ("th", "en", "อย่าใส่ถั่วลิสงนะ ฉันแพ้ถั่วลิสง"),
            ("en", "th", "The fare is one hundred and fifty baht, not fifty baht."),
        ]:

            def speech(source=source, target=target, text=text):
                audio = asyncio.run(asyncio.wait_for(create_speech(text, source), timeout=40))
                filename = f"speech-{len(report['results'])}.mp3"
                (args.output.parent / filename).write_bytes(audio)
                response = client.post(
                    "/api/transcribe",
                    data={"language": source, "file": (io.BytesIO(audio), filename)},
                )
                reading = response.get_json()
                return speech_translation_result(
                    response.status_code, reading, translate, source, target
                )

            record("synthetic_speech", text, speech)


if __name__ == "__main__":
    main()
