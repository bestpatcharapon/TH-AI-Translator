"""Reproducible latency checks. --live uses the configured API quota via Flask."""

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch


def controlled():
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    import app

    text = "paragraph words\n" * 650
    pieces = list(app.chunks(text))

    def provider(**kwargs):
        time.sleep(0.05)
        return SimpleNamespace(
            choices=[
                SimpleNamespace(
                    finish_reason="stop",
                    message=SimpleNamespace(content=kwargs["messages"][1]["content"].strip()),
                )
            ]
        )

    started = time.perf_counter()
    baseline = [
        provider(messages=[{}, {"content": piece}]).choices[0].message.content for piece in pieces
    ]
    before = time.perf_counter() - started
    with patch.object(app, "get_client") as client:
        client.return_value.chat.completions.create.side_effect = provider
        started = time.perf_counter()
        after = app.translate_text(text, "en", "th", "natural")
        elapsed = time.perf_counter() - started
    return {
        "kind": "controlled synthetic provider, fixed 50ms per chunk; not an AI accuracy benchmark",
        "chunks": len(pieces),
        "serial_seconds": round(before, 4),
        "parallel_seconds": round(elapsed, 4),
        "same_complete_ordered_content": after == "\n\n".join(baseline),
    }


def request_sample(base, path, body, content_type="application/json"):
    request = urllib.request.Request(
        base.rstrip("/") + path, data=body, headers={"Content-Type": content_type}
    )
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            data = response.read()
            status = response.status
            headers = response.headers
    except urllib.error.HTTPError as error:
        data = error.read()
        status = error.code
        headers = error.headers
    elapsed = time.perf_counter() - started
    result = {
        "seconds": round(elapsed, 4),
        "http_status": status,
        "cache": headers.get("X-Result-Cache"),
        "server_timing": headers.get("Server-Timing"),
    }
    if "json" in headers.get("Content-Type", ""):
        value = json.loads(data)
        result.update(
            {key: value[key] for key in ("translation", "text", "audit", "error") if key in value}
        )
        if "regions" in value:
            result["regions"] = [
                {"text": region["text"], "translation": region["translation"]}
                for region in value["regions"]
            ]
    return result, data


def photo_request():
    import pymupdf

    with pymupdf.open() as document:
        page = document.new_page(width=700, height=450)
        for y, text in [
            (70, "MENU"),
            (140, "Fried rice 50 baht"),
            (210, "Chicken soup 80 baht"),
            (280, "No peanuts please"),
        ]:
            page.insert_text((45, y), text, fontsize=28)
        data = page.get_pixmap(alpha=False).tobytes("png")
    boundary = "translator-performance-fixture"
    body = b""
    for key, value in {"source": "en", "target": "th", "tone": "natural"}.items():
        body += f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode()
    body += (
        f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="benchmark.png"\r\nContent-Type: image/png\r\n\r\n'.encode()
        + data
        + f"\r\n--{boundary}--\r\n".encode()
    )
    return body, "multipart/form-data; boundary=" + boundary


def speech_samples(url):
    payload = json.dumps({"text": "Hello, welcome.", "language": "en"}).encode()
    samples = [request_sample(url, "/api/speech", payload) for _ in range(2)]
    report = {"speech": [sample for sample, _ in samples]}
    if samples[-1][0]["http_status"] == 200:
        boundary = "translator-voice-benchmark"
        body = (
            f'--{boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\nen\r\n'
            f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="voice.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n'
        ).encode()
        body += samples[-1][1] + f"\r\n--{boundary}--\r\n".encode()
        report["transcription"] = [
            request_sample(
                url, "/api/transcribe", body, "multipart/form-data; boundary=" + boundary
            )[0]
            for _ in range(2)
        ]
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--live", action="store_true", help="Call real text/photo APIs; consumes provider quota"
    )
    parser.add_argument("--url", default="http://127.0.0.1:5000")
    parser.add_argument("--baseline-url")
    parser.add_argument(
        "--speech", action="store_true", help="Also test actual speech output and reuse"
    )
    parser.add_argument("--out", default="/tmp/translator-performance.json")
    args = parser.parse_args()
    report = {"measured_at": datetime.now(timezone.utc).isoformat(), "controlled": controlled()}
    if args.live:
        text = json.dumps(
            {
                "text": "ขอเลื่อนนัดเป็นวันที่ 28 เวลา 10:30 น. ราคา 1500 บาท ไม่ใช่ 150 บาท",
                "source": "th",
                "target": "en",
                "context": "work",
                "tone": "friendly",
            },
            ensure_ascii=False,
        ).encode()
        photo, content_type = photo_request()
        report["live_note"] = (
            "Single sample per path, same model and translation policy; provider/network variation is not controlled. Inspect translations and OCR for quality. Cache-hit speed is not uncached generation speed."
        )
        report["live"] = {}
        for name, url, repetitions in [
            ("baseline", args.baseline_url, 1),
            ("optimized", args.url, 2),
        ]:
            if not url:
                continue
            result = {"url": url, "text": [], "photo": []}
            for _ in range(repetitions):
                result["text"].append(request_sample(url, "/api/translate", text)[0])
            for _ in range(repetitions):
                result["photo"].append(
                    request_sample(url, "/api/photo-translate", photo, content_type)[0]
                )
            report["live"][name] = result
        if args.speech:
            report.update(speech_samples(args.url))
    Path(args.out).write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
