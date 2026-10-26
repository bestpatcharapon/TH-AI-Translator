"""Local PP-OCR detection finds text independently of Tesseract recognition."""

import re
import threading
from pathlib import Path

_detector = None
_detector_lock = threading.Lock()


def numeric_text(text):
    """Numeric facts, not arbitrary words that OCR confused with a digit."""
    value = text.strip()
    digits = sum(char.isdecimal() for char in value)
    if not digits:
        return False
    letters = sum(char.isalpha() for char in value)
    return (
        not letters
        or bool(re.search(r"\d.*(?:baht|บาท|thb|usd|eur)", value, re.I))
        or (digits >= 5 and digits / max(1, digits + letters) >= 0.7)
    )


def preserve_numeric_pixels(text):
    """Keep bare numeric facts, but translate words attached to them (50 บาท)."""
    return numeric_text(text) and not any(char.isalpha() for char in text)


def text_boxes(image):
    # Load only the detector: its bundled model needs no API key, GPU, or network.
    global _detector
    with _detector_lock:
        if _detector is None:
            import rapidocr_onnxruntime
            import yaml
            from rapidocr_onnxruntime.ch_ppocr_det import TextDetector

            root = Path(rapidocr_onnxruntime.__file__).parent
            config = yaml.safe_load((root / "config.yaml").read_text())["Det"]
            config.update(
                model_path=str(root / config["model_path"]),
                intra_op_num_threads=2,
                inter_op_num_threads=1,
                limit_type="max",
                limit_side_len=1600,
            )
            _detector = TextDetector(config)
        import numpy as np

        polygons, _ = _detector(np.asarray(image.convert("RGB"))[:, :, ::-1].copy())
    if polygons is None:
        return []
    boxes = []
    for polygon in polygons[:300]:
        left, top = polygon.min(axis=0)
        right, bottom = polygon.max(axis=0)
        x, y = max(0, int(left) - 2), max(0, int(top) - 2)
        width, height = min(image.width, int(right) + 3) - x, min(image.height, int(bottom) + 3) - y
        if width >= 6 and height >= 4:
            boxes.append(
                dict(
                    x=x,
                    y=y,
                    width=width,
                    height=height,
                    text="",
                    confidence=0,
                    detected_only=True,
                    needs_visual_check=True,
                    reading_review=True,
                )
            )
    return sorted(boxes, key=lambda box: (round(box["y"] / 8), box["x"]))
