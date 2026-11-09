"""Offline shared-deadline regressions: fake time, no live providers or native OCR."""

import io
import json
import os
import subprocess
import unittest
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from openai import OpenAI
from PIL import Image

import operation_budget as budget
import photo_reading as reading
import photo_translation as photo


def completion(payload):
    return SimpleNamespace(
        choices=[
            SimpleNamespace(
                message=SimpleNamespace(content=json.dumps(payload)), finish_reason="stop"
            )
        ]
    )


def region(index=0):
    return {
        "x": 10,
        "y": 10 + index * 25,
        "width": 100,
        "height": 12,
        "confidence": 70,
        "text": f"รายการ {index}",
    }


class PhotoDeadlineTests(unittest.TestCase):
    def setUp(self):
        self.now = 100.0
        self.client = MagicMock()
        self.sources = [region()]
        self.positioned_text = photo.positioned_text
        output = io.BytesIO()
        Image.new("RGB", (640, 900), "white").save(output, format="PNG")
        self.image = output.getvalue()
        for cache in (
            photo._photo_result_cache,
            photo._label_result_cache,
            photo._ocr_result_cache,
            photo._language_cache,
            photo._normalized_cache,
            reading._reading_cache,
            reading._reading_batch_cache,
        ):
            cache.clear()
            self.addCleanup(cache.clear)
        for patcher in (
            patch.dict(
                os.environ,
                {
                    "PHOTO_TRANSLATION_TIMEOUT_SECONDS": "10",
                    "PHOTO_READING_TIMEOUT_SECONDS": "45",
                    "PHOTO_READING_MAX_REQUESTS": "12",
                    "PHOTO_READING_PROVIDER": "groq",
                    "PHOTO_OCR_BACKEND": "vision",
                },
            ),
            patch("operation_budget.monotonic", side_effect=lambda: self.now),
            patch("photo_reading.monotonic", side_effect=lambda: self.now),
            patch("photo_translation.normalized_photo", side_effect=lambda data: data),
            patch("photo_translation.positioned_text", side_effect=lambda *_: self.sources),
        ):
            patcher.start()
            self.addCleanup(patcher.stop)

    def run_photo(self, source="th"):
        return photo.translate_photo(
            self.image, source, "en", "natural", self.client, "offline-model"
        )

    @staticmethod
    def translated(options, text=None):
        items = json.loads(options["messages"][1]["content"])
        return completion(
            {
                "translations": [
                    {"id": item["id"], "text": text or "Item " + item["text"].split()[-1]}
                    for item in items
                ]
            }
        )

    @staticmethod
    def readings(options):
        prompt = options["messages"][0]["content"][0]["text"]
        ids = map(int, prompt.split("with exactly these ids: ")[1].split(","))
        return completion(
            {
                "readings": [
                    {"id": index, "text": f"รายการ {index}", "readable": True} for index in ids
                ]
            }
        )

    def test_configuration_is_positive_finite_bounded_even_for_cache_hits(self):
        with patch("photo_translation._translate_photo", return_value={}):
            for value in ("", "abc", "0", "-1", "nan", "inf", "-inf", "300.1"):
                with (
                    self.subTest(value=value),
                    patch.dict(os.environ, {"PHOTO_TRANSLATION_TIMEOUT_SECONDS": value}),
                ):
                    with self.assertRaisesRegex(RuntimeError, "PHOTO_TRANSLATION_TIMEOUT_SECONDS"):
                        self.run_photo()
            for value in ("0.1", "300"):
                with patch.dict(os.environ, {"PHOTO_TRANSLATION_TIMEOUT_SECONDS": value}):
                    self.run_photo()
        self.assertIsNone(budget._photo_deadline.get())
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(budget.whole_photo_budget(lambda: budget.photo_timeout(999))(), 120)

    def test_reading_and_translation_share_remaining_budget(self):
        timeouts = []

        def provider(**options):
            timeouts.append(options["timeout"])
            self.now += 4
            return self.readings(options) if len(timeouts) == 1 else self.translated(options)

        self.client.chat.completions.create.side_effect = provider
        result = self.run_photo()
        self.assertEqual(timeouts, [10, 6])
        self.assertEqual(result["regions"][0]["translation"], "Item 0")
        self.assertEqual(self.run_photo()["cache_status"], "hit")
        self.assertEqual(len(timeouts), 2)

    def test_reading_expiry_stops_translation_and_retry_reuses_first_batch(self):
        self.sources = [region(index) for index in range(21)]
        timeouts = []

        def provider(**options):
            timeouts.append(options["timeout"])
            self.now += 2 if len(timeouts) == 1 else 8 if len(timeouts) == 2 else 1
            if options["messages"][0]["role"] == "user":
                return self.readings(options)
            return self.translated(options)

        self.client.chat.completions.create.side_effect = provider
        with self.assertRaisesRegex(RuntimeError, "deadline exceeded"):
            self.run_photo()
        self.assertEqual(timeouts, [10, 8])
        self.assertFalse(photo._photo_result_cache._entries)
        self.assertFalse(reading._reading_cache._entries)
        self.assertEqual(len(reading._reading_batch_cache._entries), 1)
        result = self.run_photo()
        self.assertEqual(result["translated_regions"], 21)
        self.assertEqual(timeouts, [10, 8, 10, 9, 8, 7])

    def test_translation_expiry_does_not_cache_late_batch_retry_reuses_success(self):
        self.sources = [region(index) for index in range(21)]
        timeouts, sizes = [], []

        def provider(**options):
            timeouts.append(options["timeout"])
            sizes.append(len(json.loads(options["messages"][1]["content"])))
            self.now += 2 if len(timeouts) != 2 else 8
            return self.translated(options)

        self.client.chat.completions.create.side_effect = provider
        with patch("photo_translation.verify_photo_readings", side_effect=lambda _, rows, __: rows):
            with self.assertRaisesRegex(RuntimeError, "deadline exceeded"):
                self.run_photo()
            self.assertFalse(photo._photo_result_cache._entries)
            self.assertEqual(len(photo._label_result_cache._entries), 1)
            self.assertEqual(self.run_photo()["translated_regions"], 21)
        self.assertEqual(timeouts, [10, 8, 10])
        self.assertEqual(sizes, [20, 1, 1])

    def test_repair_gets_only_remaining_budget_and_late_success_is_rejected(self):
        timeouts = []

        def provider(**options):
            timeouts.append(options["timeout"])
            self.now += 4 if len(timeouts) % 2 else 6
            return self.translated(options, "ผิด" if len(timeouts) % 2 else "Item 0")

        self.client.chat.completions.create.side_effect = provider
        with patch("photo_translation.verify_photo_readings", side_effect=lambda _, rows, __: rows):
            for _ in range(2):
                with self.assertRaisesRegex(RuntimeError, "deadline exceeded"):
                    self.run_photo()
                self.assertFalse(photo._photo_result_cache._entries)
                self.assertFalse(photo._label_result_cache._entries)
        self.assertEqual(timeouts, [10, 6, 10, 6])

    def test_expiry_during_validation_prevents_repair_call(self):
        def needs_repair(*_):
            self.now += 10
            return True

        self.client.chat.completions.create.side_effect = lambda **kw: self.translated(kw, "ผิด")
        with (
            patch("photo_translation.verify_photo_readings", side_effect=lambda _, rows, __: rows),
            patch("photo_translation.photo_needs_repair", side_effect=needs_repair),
        ):
            with self.assertRaisesRegex(RuntimeError, "deadline exceeded"):
                self.run_photo()
        self.assertEqual(self.client.chat.completions.create.call_count, 1)
        self.assertFalse(photo._photo_result_cache._entries)

    def test_detection_expiry_stops_reading_and_does_not_cache_ocr(self):
        def detect(*_):
            self.now += 10
            return {"regions": self.sources, "protected_boxes": []}

        with (
            patch("photo_translation.positioned_text", wraps=self.positioned_text),
            patch("photo_translation.models_ready", return_value=False),
            patch("photo_translation._positioned_text", side_effect=detect),
            patch("photo_translation.verify_photo_readings") as verify,
        ):
            with self.assertRaisesRegex(RuntimeError, "deadline exceeded"):
                self.run_photo()
        verify.assert_not_called()
        self.client.chat.completions.create.assert_not_called()
        self.assertFalse(photo._ocr_result_cache._entries)

    def test_auto_language_uses_budget_and_expiry_prevents_detection(self):
        def provider(**options):
            self.assertEqual(options["timeout"], 10)
            self.now += 10
            return completion("th")

        self.client.chat.completions.create.side_effect = provider
        with patch("photo_translation.positioned_text") as detect:
            with self.assertRaisesRegex(RuntimeError, "deadline exceeded"):
                self.run_photo(source="auto")
        detect.assert_not_called()
        self.assertFalse(photo._language_cache._entries)

    def test_reading_preparation_expiry_stops_all_provider_calls(self):
        def sheet(*_, **__):
            self.now += 10
            return b"offline-sheet"

        with patch("photo_reading.reading_sheet", side_effect=sheet):
            with self.assertRaisesRegex(RuntimeError, "deadline exceeded"):
                self.run_photo()
        self.client.chat.completions.create.assert_not_called()
        self.assertFalse(reading._reading_cache._entries)
        self.assertFalse(photo._photo_result_cache._entries)

    def test_native_ocr_overrun_prevents_legacy_fallback(self):
        def native(*_):
            self.now += 10
            return None

        with (
            patch.dict(os.environ, {"PHOTO_OCR_BACKEND": "local"}),
            patch("photo_translation.recognize_image", side_effect=native),
            patch("photo_translation._legacy_positioned_text") as legacy,
        ):
            call = budget.whole_photo_budget(lambda: photo._positioned_text(self.image, "th"))
            with self.assertRaisesRegex(RuntimeError, "deadline exceeded"):
                call()
        legacy.assert_not_called()

    def test_worker_inherits_budget_subprocess_timeout_and_stops_after_expiry(self):
        image = Image.new("RGB", (10, 10))
        timeouts = []

        def subprocess_run(*_, **options):
            timeouts.append(options["timeout"])
            self.now += 10
            raise subprocess.TimeoutExpired("offline-ocr", options["timeout"])

        @budget.whole_photo_budget
        def operation():
            worker = budget.bind_photo_budget(lambda: photo.run_ocr(image, "eng"))
            with ThreadPoolExecutor(max_workers=1) as pool:
                with self.assertRaisesRegex(RuntimeError, "deadline exceeded"):
                    pool.submit(worker).result()
                with self.assertRaisesRegex(RuntimeError, "deadline exceeded"):
                    pool.submit(worker).result()

        with (
            patch("photo_translation.ocr_runtime", return_value=("offline-ocr", {})),
            patch("photo_translation.subprocess.run", side_effect=subprocess_run),
        ):
            with self.assertRaisesRegex(RuntimeError, "deadline exceeded"):
                operation()
        self.assertEqual(timeouts, [10])
        self.assertIsNone(budget._photo_deadline.get())

    def test_real_sdk_retries_disabled_without_network_or_mock_interface_change(self):
        client = OpenAI(api_key="offline-only")
        self.addCleanup(client.close)
        configured = MagicMock()
        configured.chat.completions.create.return_value = "done"
        with patch.object(client, "with_options", return_value=configured) as options:
            call = budget.whole_photo_budget(lambda: budget.photo_completion(client, timeout=35))
            self.assertEqual(call(), "done")
        options.assert_called_once_with(max_retries=0)
        configured.chat.completions.create.assert_called_once_with(timeout=10)


if __name__ == "__main__":
    unittest.main()
