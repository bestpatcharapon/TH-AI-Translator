"""Native OCR routing, evidence preservation and provider fallback contracts."""

import io
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

import numpy as np
from PIL import Image

import paddle_ocr_backend as backend
from photo_reading import verify_photo_readings


def photo():
    output = io.BytesIO()
    Image.new("RGB", (640, 900), "black").save(output, format="PNG")
    return output.getvalue()


class PaddleOCRTests(unittest.TestCase):
    def test_supported_scripts_select_their_actual_recognizer(self):
        for source in ("th", "th,en", "en,th", "auto"):
            self.assertEqual(backend.recognition_model(source), backend.THAI_MODEL)
        for source in ("en", "zh", "zh-TW", "ja,en", "fr,de"):
            self.assertEqual(backend.recognition_model(source), backend.GENERAL_MODEL)
        for source in ("ar", "ko", "hi", "th,zh", "unknown"):
            self.assertIsNone(backend.recognition_model(source))

    def test_partial_install_and_disabled_engine_do_not_look_ready(self):
        with (
            tempfile.TemporaryDirectory() as folder,
            patch.object(backend, "MODEL_ROOT", Path(folder)),
            patch.dict(os.environ, {"PADDLE_OCR_ENABLED": "1"}),
        ):
            self.assertFalse(backend.models_ready())
            for model in (backend.DETECTION_MODEL, backend.THAI_MODEL):
                root = Path(folder) / model
                root.mkdir()
                for filename in ("inference.json", "inference.pdiparams", "inference.yml"):
                    (root / filename).touch()
            self.assertTrue(backend.models_ready("th,en"))
            self.assertFalse(backend.models_ready("en"))
            with patch.dict(os.environ, {"PADDLE_OCR_ENABLED": "0"}):
                self.assertFalse(backend.models_ready())

    def test_missing_models_use_legacy_without_loading_predictors(self):
        with (
            patch.object(backend, "models_ready", return_value=False),
            patch.object(backend, "_model") as model,
        ):
            self.assertIsNone(backend.recognize_image(b"", "ar"))
            model.assert_not_called()

    def test_readings_keep_original_numbers_and_flag_weak_text(self):
        polygons = np.array(
            [[[10, y], [110, y], [110, y + 16], [10, y + 16]] for y in (10, 40, 70)],
            dtype="float32",
        )
        detector, recognizer = MagicMock(), MagicMock()
        detector.predict.return_value = [{"dt_polys": polygons}]
        recognizer.predict.return_value = [
            {"rec_text": "50 Baht", "rec_score": 0.96},
            {"rec_text": "ข้าวผัด", "rec_score": 0.5},
            {"rec_text": "เมนูต้ม", "rec_score": 0.95},
        ]
        with (
            patch.object(backend, "models_ready", return_value=True),
            patch.object(backend, "_model", side_effect=[detector, recognizer]),
        ):
            result = backend.recognize_image(photo(), "th")
        self.assertEqual(result["engine"], "paddle")
        price, weak, confident = result["regions"]
        self.assertEqual(price["text"], "50 Baht")
        self.assertTrue(price["preserve_original"])
        self.assertEqual(len(result["protected_boxes"]), 1)
        self.assertTrue(weak["reading_review"])
        self.assertTrue(weak["needs_visual_check"])
        self.assertFalse(confident["reading_review"])
        self.assertEqual(confident["recognition_model"], backend.THAI_MODEL)
        client = MagicMock()
        self.assertEqual(
            verify_photo_readings(photo(), [price, confident], client), [price, confident]
        )
        client.chat.completions.create.assert_not_called()

    def test_configured_engine_failure_is_visible_instead_of_silent_fallback(self):
        with (
            patch.object(backend, "models_ready", return_value=True),
            patch.object(backend, "_model", side_effect=OSError("broken predictor")),
        ):
            with self.assertRaisesRegex(RuntimeError, "Paddle OCR"):
                backend.recognize_image(photo(), "th")

    def test_incomplete_recognition_is_rejected(self):
        detector, recognizer = MagicMock(), MagicMock()
        detector.predict.return_value = [
            {"dt_polys": np.array([[[10, 10], [110, 10], [110, 26], [10, 26]]])}
        ]
        recognizer.predict.return_value = []
        with (
            patch.object(backend, "models_ready", return_value=True),
            patch.object(backend, "_model", side_effect=[detector, recognizer]),
        ):
            with self.assertRaises(RuntimeError):
                backend.recognize_image(photo(), "th")
