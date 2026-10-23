"""Opt-in real provider check using synthetic speech, not a human microphone benchmark."""

import argparse
import asyncio
import io
import json
import sys
import time
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--live", action="store_true", help="Use Edge TTS and consume Groq API quota"
    )
    args = parser.parse_args()
    if not args.live:
        parser.error("Pass --live to run cloud requests.")
    import app
    from services import create_speech
    from speech_recognition import transcript_result

    samples = [
        ("th", "en", "ขอจองโต๊ะสำหรับสองคนตอนหนึ่งทุ่มครึ่งครับ"),
        ("th", "en", "ผมแพ้ถั่วลิสง กรุณาอย่าใส่ถั่วและน้ำมันถั่วครับ"),
        ("en", "th", "The fare is one hundred and fifty baht, not fifty baht."),
    ]
    report = {
        "scope": "Synthetic TTS, clean audio, single runs. Not real accented/noisy microphone speech or a Google comparison.",
        "samples": [],
    }
    for language, target, expected in samples:
        audio = asyncio.run(create_speech(expected, language))
        sample = {"language": language, "expected": expected, "readings": {}}
        for model in ("whisper-large-v3-turbo", app.SPEECH_MODEL):
            started = time.perf_counter()
            reading = app.get_client().audio.transcriptions.create(
                model=model,
                file=("sample.mp3", audio, "audio/mpeg"),
                language=language,
                response_format="verbose_json",
                temperature=0,
            )
            sample["readings"][model] = {
                **transcript_result(reading, model),
                "seconds": round(time.perf_counter() - started, 3),
            }
        text = sample["readings"][app.SPEECH_MODEL]["text"]
        response = app.app.test_client().post(
            "/api/translate",
            json={"text": text, "source": language, "target": target, "cache_scope": "live"},
        )
        sample["translation_http_status"] = response.status_code
        sample["translation"] = response.json.get("translation", response.json.get("error"))
        report["samples"].append(sample)
    # Silence may produce fluent hallucinations; verify segment evidence gates it.
    audio = io.BytesIO()
    with wave.open(audio, "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(16000)
        output.writeframes(b"\0\0" * 16000 * 3)
    response = app.app.test_client().post(
        "/api/transcribe",
        data={"language": "th", "file": (io.BytesIO(audio.getvalue()), "silence.wav")},
    )
    report["silence"] = {"http_status": response.status_code, "result": response.json}
    report["translation_checks"] = []
    for source, target, text in (
        ("th", "en", "ผมเป็นคนไทย"),
        ("en", "th", "I like people who..."),
        ("th", "en", "ไว้ค่อยว่ากันนะ"),
    ):
        response = app.app.test_client().post(
            "/api/translate",
            json={"text": text, "source": source, "target": target, "cache_scope": "live"},
        )
        report["translation_checks"].append(
            {
                "text": text,
                "translation": response.json.get("translation", response.json.get("error")),
                "http_status": response.status_code,
            }
        )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
