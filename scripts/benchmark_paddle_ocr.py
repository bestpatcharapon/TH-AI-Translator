"""Real local-model check on a generated menu, not a Google Lens comparison."""

import io
import json
import sys
import time
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def fixture():
    image = Image.new("RGB", (640, 1000), "#101010")
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype(str(ROOT / "static/fonts/NotoSansThai-Bold.ttf"), 15)
    english = ImageFont.truetype("DejaVuSans.ttf", 20)
    draw.text((35, 25), "Menu.", font=english, fill="white")
    headings = [(100, "อาหารตามสั่ง"), (150, "อาหารจานเดียว"), (470, "เมนูต้ม")]
    dishes = [
        "ข้าวผัด",
        "ข้าวผัดทะเล",
        "ข้าวกะเพราไก่",
        "ข้าวกะเพราหมู",
        "ข้าวกะเพราทะเล",
        "ข้าวกะเพราเนื้อ",
        "ข้าวกะเพราปลา",
        "ข้าวไข่ทอด",
        "ต้มยำไก่",
        "ต้มยำหมู",
        "ต้มยำทะเล",
        "ต้มยำปลาหมึก",
        "ต้มยำเนื้อ",
        "ต้มยำปลา",
    ]
    for y, text in headings:
        draw.rounded_rectangle((30, y, 260, y + 30), radius=12, fill="#f6b317")
        draw.text((40, y + 3), text, font=font, fill="black")
    for index, text in enumerate(dishes):
        y = 200 + index * 30 if index < 8 else 520 + (index - 8) * 30
        draw.text((35, y), text, font=font, fill="white")
        draw.text((260, y), "50 Baht", font=font, fill="white")
    draw.text((35, 850), "Open daily 10:00-20:00", font=english, fill="white")
    draw.text((35, 885), "Call 091-234-5678", font=english, fill="white")
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue(), [text for _, text in headings] + dishes


def main():
    from paddle_ocr_backend import recognize_image, status

    data, expected = fixture()
    runs = []
    result = None
    for _ in range(2):
        started = time.perf_counter()
        result = recognize_image(data, "th,en")
        if result is None:
            raise SystemExit("Install models first: python scripts/setup_paddle_ocr.py")
        runs.append(round(time.perf_counter() - started, 3))
    if result is None:
        raise RuntimeError("No OCR result was produced")
    readings = [region["text"] for region in result["regions"]]
    report = {
        "scope": "Generated 640x1000 menu with 15px Thai; raw exact matches, no corrections. Not a Google comparison or a test on the user's original photo.",
        "models": status(),
        "seconds_first_and_warm": runs,
        "thai_expected": len(expected),
        "thai_exact": sum(text in readings for text in expected),
        "thai_missing_or_different": [text for text in expected if text not in readings],
        "prices_expected": 14,
        "prices_exact": readings.count("50 Baht"),
        "readings": readings,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
