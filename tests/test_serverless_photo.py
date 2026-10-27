"""Vercel photo translation uses packaged detection without native OCR binaries."""

import io
import json
import unittest
from unittest.mock import MagicMock, patch

from PIL import Image
from test_app import completion

import app as server
from photo_reading import reading_provider, verify_photo_readings
from photo_translation import MAX_REGIONS, _positioned_text, photo_ocr_backend


def image_bytes(size=(400, 400)):
    output = io.BytesIO()
    Image.new("RGB", size, "white").save(output, format="PNG")
    return output.getvalue()


def box(index=0):
    return dict(
        x=10,
        y=10 + index * 20,
        width=120,
        height=15,
        text="",
        confidence=0,
        detected_only=True,
        needs_visual_check=True,
        reading_review=True,
    )


class ServerlessPhotoTests(unittest.TestCase):
    def test_gemini_is_opt_in_and_does_not_receive_groq_reasoning_options(self):
        primary = MagicMock()
        with patch.dict("os.environ", {"PHOTO_READING_PROVIDER": "groq"}):
            self.assertIs(reading_provider(primary)[0], primary)
        with (
            patch.dict(
                "os.environ",
                {
                    "PHOTO_READING_PROVIDER": "gemini",
                    "GEMINI_API_KEY": "test-only",
                    "GEMINI_PHOTO_MODEL": "image-model",
                },
            ),
            patch("photo_reading._gemini_client") as alternate,
        ):
            client, model, options = reading_provider(primary)
            self.assertIs(client, alternate.return_value)
            self.assertEqual(model, "image-model")
            self.assertEqual(options, {})
            alternate.assert_called_once_with("test-only")
        with patch.dict("os.environ", {"PHOTO_READING_PROVIDER": "gemini", "GEMINI_API_KEY": ""}):
            with self.assertRaises(RuntimeError):
                reading_provider(primary)

    def test_backend_defaults_and_explicit_overrides(self):
        for env, expected in [
            ({}, "local"),
            ({"VERCEL": "1"}, "vision"),
            ({"VERCEL": "1", "PHOTO_OCR_BACKEND": "local"}, "local"),
            ({"PHOTO_OCR_BACKEND": "vision"}, "vision"),
        ]:
            with self.subTest(env=env), patch.dict("os.environ", env, clear=True):
                self.assertEqual(photo_ocr_backend(), expected)
        with patch.dict("os.environ", {"PHOTO_OCR_BACKEND": "bad"}):
            with self.assertRaises(RuntimeError):
                photo_ocr_backend()

    def test_serverless_api_reads_small_photo_and_preserves_numeric_pixels(self):
        with (
            patch.dict("os.environ", {"VERCEL": "1", "PHOTO_OCR_BACKEND": "auto"}),
            patch("photo_translation.text_boxes", return_value=[box(), box(1)]),
            patch("photo_translation.recognize_image") as native,
            patch("photo_translation.ocr_runtime", side_effect=AssertionError("No Tesseract")),
            patch.object(server, "get_client") as provider,
        ):
            provider.return_value.chat.completions.create.side_effect = [
                completion(
                    json.dumps(
                        {
                            "readings": [
                                {"id": 0, "text": "ข้าวผัด", "readable": True},
                                {"id": 1, "text": "50", "readable": True},
                            ]
                        }
                    )
                ),
                completion(json.dumps({"translations": [{"id": 0, "text": "Fried rice"}]})),
            ]
            response = server.app.test_client().post(
                "/api/photo-translate",
                data={
                    "source": "th",
                    "target": "en",
                    "tone": "standard",
                    "file": (io.BytesIO(image_bytes()), "small.png"),
                },
            )
            self.assertEqual(response.status_code, 200, response.get_json())
            self.assertEqual(response.get_json()["ocr_engine"], "rapidocr-vision")
            self.assertEqual(response.get_json()["regions"][0]["translation"], "Fried rice")
            self.assertEqual(response.get_json()["review_required"], 0)
            self.assertTrue(response.get_json()["regions"][1]["preserve_original"])
            self.assertEqual(response.get_json()["regions"][1]["text"], "50")
            self.assertEqual(response.get_json()["regions"][0]["x"], 10)
            native.assert_not_called()

    def test_every_detected_region_is_read_beyond_legacy_thirty_region_limit(self):
        provider = MagicMock()

        # IDs come from deterministic crops; use the batch size to construct replies.
        offset = 0

        def batch_response(**kwargs):
            nonlocal offset
            count = 5 if offset < 30 else 1
            result = completion(
                json.dumps(
                    {
                        "readings": [
                            {"id": i, "text": "Menu", "readable": True}
                            for i in range(offset, offset + count)
                        ]
                    }
                )
            )
            offset += count
            return result

        provider.chat.completions.create.side_effect = batch_response
        regions = [{**box(i), "vision_only": True} for i in range(31)]
        result = verify_photo_readings(image_bytes((640, 900)), regions, provider)
        self.assertEqual(provider.chat.completions.create.call_count, 7)
        self.assertTrue(all(r["text"] == "Menu" and not r["reading_review"] for r in result))

    def test_no_text_or_excessive_regions_fail_before_cloud_reading(self):
        with patch.dict("os.environ", {"PHOTO_OCR_BACKEND": "vision"}):
            for boxes in [[], [box()] * (MAX_REGIONS + 1)]:
                with (
                    self.subTest(count=len(boxes)),
                    patch("photo_translation.text_boxes", return_value=boxes),
                ):
                    with self.assertRaises(ValueError):
                        _positioned_text(image_bytes(), "th")

    def test_ocr_status_discloses_active_backend(self):
        with patch.dict("os.environ", {"VERCEL": "1", "PHOTO_OCR_BACKEND": "auto"}):
            response = server.app.test_client().get("/api/ocr-status")
            self.assertEqual(response.get_json()["photo_backend"], "vision")


class GeminiPhotoBatchTests(unittest.TestCase):
    def test_multiple_full_resolution_sheets_share_one_request_and_resume_after_failure(self):
        provider = MagicMock()
        calls = []

        def respond(**kwargs):
            content = kwargs["messages"][0]["content"]
            ids = [
                int(value)
                for value in content[0]["text"].split("with exactly these ids: ")[-1].split(",")
            ]
            calls.append(ids)
            images = [item for item in content if item["type"] == "image_url"]
            self.assertEqual(len(images), (len(ids) + 4) // 5)
            import base64

            for part in images:
                encoded = part["image_url"]["url"].split(",", 1)[1]
                with Image.open(io.BytesIO(base64.b64decode(encoded))) as sheet:
                    self.assertEqual(sheet.width, 1536)
                    self.assertLessEqual(sheet.height, 1100)
            if len(calls) == 2:
                from openai import OpenAIError

                raise OpenAIError("Simulated rate limit")
            return completion(
                json.dumps(
                    {
                        "readings": [
                            {"id": index, "text": f"Menu {index}", "readable": True}
                            for index in ids
                        ]
                    }
                )
            )

        provider.chat.completions.create.side_effect = respond
        regions = [{**box(i), "vision_only": True} for i in range(45)]
        with (
            patch.dict(
                "os.environ", {"PHOTO_READING_PROVIDER": "gemini", "GEMINI_API_KEY": "test-only"}
            ),
            patch("photo_reading._gemini_client", return_value=provider),
        ):
            from openai import OpenAIError

            with self.assertRaises(OpenAIError):
                verify_photo_readings(image_bytes((640, 1000)), regions, MagicMock())
            result = verify_photo_readings(image_bytes((640, 1000)), regions, MagicMock())
        self.assertEqual([len(ids) for ids in calls], [20, 20, 20, 5])
        self.assertEqual([region["text"] for region in result], [f"Menu {i}" for i in range(45)])
        self.assertTrue(all(not region["reading_review"] for region in result))
