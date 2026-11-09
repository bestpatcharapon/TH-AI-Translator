"""Reproducible synthetic dense-menu benchmark; --live calls configured providers."""

import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def main():
    from scripts.benchmark_real_media import run_item, summarize

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", action="store_true")
    parser.add_argument("--out-dir", default="/tmp/translator-dense-photo-eval")
    args = parser.parse_args()
    dest = Path(args.out_dir)
    dest.mkdir(parents=True, exist_ok=True)
    font = ImageFont.truetype(str(ROOT / "static/fonts/IBMPlexSansThai-Regular.ttf"), 24)
    dishes = ["ข้าวผัดหมู", "ต้มยำกุ้ง", "ผัดไทย", "ข้าวมันไก่"]
    image = Image.new("RGB", (1400, 1100), "#eee8da")
    draw = ImageDraw.Draw(image)
    lines = []
    for row in range(4):
        for col in range(4):
            x, y = 35 + col * 345, 40 + row * 260
            # Colorful non-text shapes between captions approximate a busy menu.
            draw.ellipse(
                (x + 45, y + 55, x + 220, y + 170), fill="#609945", outline="#776633", width=6
            )
            title = dishes[(row + col) % 4]
            detail = f"ราคา {50 + row * 10 + col * 5} บาท"
            draw.text((x, y + 180), title, font=font, fill="#302819")
            draw.text((x, y + 217), detail, font=font, fill="#302819")
        # Detector orders by visual line, then x, rather than card order.
        lines.extend(dishes[(row + c) % 4] for c in range(4))
        lines.extend(f"ราคา {50 + row * 10 + c * 5} บาท" for c in range(4))
    variants = {
        "clean": image,
        "blur": image.filter(ImageFilter.GaussianBlur(0.65)),
        "tilted": image.rotate(2, fillcolor="#eee8da"),
    }
    items = []
    for name, variant in variants.items():
        variant.save(dest / f"{name}.jpg", quality=85)
        items.append(
            dict(
                file=f"{name}.jpg",
                kind="image",
                language="th",
                target="en",
                expected_text="\n".join(lines),
            )
        )
    (dest / "manifest.json").write_text(json.dumps(items, ensure_ascii=False, indent=2))
    if args.live:
        import app

        results = [run_item(app.app.test_client(), item, dest) for item in items]
        report = dict(
            scope="Synthetic 4-column, 16-card menu. CER includes region ordering; translation accuracy is not scored.",
            summary=summarize(results),
            items=results,
        )
        (dest / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
        print(json.dumps(report["summary"], ensure_ascii=False))
    print(dest)


if __name__ == "__main__":
    main()
