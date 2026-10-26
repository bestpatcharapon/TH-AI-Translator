"""Local PaddleOCR detection/recognition; model assets are installed ahead of time."""

import io
import math
import os
import threading
from pathlib import Path

from PIL import Image

from photo_detection import preserve_numeric_pixels

MODEL_ROOT = Path(__file__).resolve().parent / ".ocr/paddle"
DETECTION_MODEL = "PP-OCRv6_medium_det"
THAI_MODEL = "th_PP-OCRv5_mobile_rec"
GENERAL_MODEL = "PP-OCRv6_medium_rec"
# Conservative subset of the official v6 Latin + Chinese/Japanese language list.
GENERAL_LANGUAGES = frozenset(
    "en zh zh-TW ja fr de es vi pt it nl id ms af sq az eu bs ca hr cs da et fi gl hu is ga la lv lt mt mi no oc pl ro sk sl sw sv tl tr uz cy".split()
)
_lock = threading.Lock()
_models = {}


def recognition_model(source):
    codes = set(source.split(","))
    if source == "auto" or ("th" in codes and codes <= {"th", "en"}):
        return THAI_MODEL
    if codes and codes <= GENERAL_LANGUAGES:
        return GENERAL_MODEL
    return None


def models_ready(source="th"):
    model = recognition_model(source)
    if os.getenv("PADDLE_OCR_ENABLED", "1") == "0" or model is None:
        return False
    return all(
        (MODEL_ROOT / name / filename).is_file()
        for name in (DETECTION_MODEL, model)
        for filename in ("inference.json", "inference.pdiparams", "inference.yml")
    )


def status():
    return {
        "enabled": os.getenv("PADDLE_OCR_ENABLED", "1") != "0",
        "ready": models_ready(),
        "detector": DETECTION_MODEL,
        "thai_recognizer": THAI_MODEL,
        "general_recognizer": GENERAL_MODEL,
        "general_ready": models_ready("en"),
        "local_inference": True,
    }


def _model(name):
    # Local paths and disabled host probes keep inference independent of model hubs.
    os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
    if name not in _models:
        from paddleocr import TextDetection, TextRecognition

        kind = TextDetection if name == DETECTION_MODEL else TextRecognition
        _models[name] = kind(
            model_name=name,
            model_dir=str(MODEL_ROOT / name),
            device="cpu",
            enable_mkldnn=False,
            cpu_threads=max(1, min(8, int(os.getenv("PADDLE_OCR_THREADS", "2")))),
        )
    return _models[name]


def _crop(image, polygon):
    import cv2
    import numpy as np

    points = np.asarray(polygon, dtype="float32")
    if len(points) != 4:
        points = cv2.boxPoints(cv2.minAreaRect(points))
    sums, differences = points.sum(axis=1), np.diff(points, axis=1).reshape(-1)
    corners = np.array(
        [
            points[sums.argmin()],
            points[differences.argmin()],
            points[sums.argmax()],
            points[differences.argmax()],
        ],
        dtype="float32",
    )
    width = max(
        2,
        int(max(np.linalg.norm(corners[0] - corners[1]), np.linalg.norm(corners[2] - corners[3]))),
    )
    height = max(
        2,
        int(max(np.linalg.norm(corners[0] - corners[3]), np.linalg.norm(corners[1] - corners[2]))),
    )
    transform = cv2.getPerspectiveTransform(
        corners,
        np.array(
            [[0, 0], [width - 1, 0], [width - 1, height - 1], [0, height - 1]], dtype="float32"
        ),
    )
    crop = cv2.warpPerspective(image, transform, (width, height), borderMode=cv2.BORDER_REPLICATE)
    return cv2.rotate(crop, cv2.ROTATE_90_COUNTERCLOCKWISE) if height > width * 1.7 else crop


def recognize_image(normalized, source):
    """Return OCR readings and geometry, or None for an unsupported/uninstalled model.

    A configured engine failure propagates. It must not silently revert to weak OCR.
    """
    if not models_ready(source):
        return None
    import numpy as np

    with Image.open(io.BytesIO(normalized)) as image:
        width, height = image.size
        pixels = np.asarray(image.convert("RGB"))[:, :, ::-1].copy()
    try:
        with _lock:
            detection = _model(DETECTION_MODEL).predict(
                pixels,
                batch_size=1,
                limit_side_len=1600,
                limit_type="max",
                box_thresh=0.5,
                unclip_ratio=1.5,
            )[0]
            polygons = detection["dt_polys"]
            if len(polygons) > 160:
                raise ValueError("รูปมีข้อความเกิน 160 ส่วน กรุณาแบ่งรูปก่อนแปล")
            if not len(polygons):
                raise ValueError("ไม่พบข้อความที่อ่านได้ กรุณาใช้ภาพที่ชัดขึ้น")
            crops = [_crop(pixels, polygon) for polygon in polygons]
            readings = _model(recognition_model(source)).predict(crops, batch_size=8)
        if len(readings) != len(polygons):
            raise RuntimeError("Paddle OCR ส่งข้อความกลับมาไม่ครบ กรุณาลองใหม่")
        regions, protected = [], []
        for polygon, reading in zip(polygons, readings):
            x, y = polygon.min(axis=0)
            right, bottom = polygon.max(axis=0)
            left, top = max(0, int(x) - 2), max(0, int(y) - 2)
            w, h = min(width, math.ceil(right) + 2) - left, min(height, math.ceil(bottom) + 2) - top
            text = str(reading.get("rec_text", "")).strip()
            score = float(reading.get("rec_score", 0))
            if not math.isfinite(score) or not 0 <= score <= 1:
                score = 0
            numeric = preserve_numeric_pixels(text)
            region = dict(
                x=left,
                y=top,
                width=w,
                height=h,
                text=text,
                confidence=score * 100,
                native_ocr=True,
                reading_review=(not text or score < 0.6) and not numeric,
                needs_visual_check=(not text or score < 0.8) and not numeric,
                detected_only=not text,
                preserve_original=numeric,
                recognition_engine="paddle",
                recognition_model=recognition_model(source),
            )
            regions.append(region)
            if numeric:
                protected.append({key: region[key] for key in ("x", "y", "width", "height")})
        regions.sort(key=lambda item: (round(item["y"] / 8), item["x"]))
        return {"regions": regions, "protected_boxes": protected, "engine": "paddle"}
    except ValueError:
        raise
    except Exception as error:
        raise RuntimeError(
            "ระบบ Paddle OCR ไม่พร้อมใช้งาน กรุณาตรวจโมเดลและการติดตั้งบนเซิร์ฟเวอร์"
        ) from error
