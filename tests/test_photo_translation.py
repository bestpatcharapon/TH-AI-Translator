import io
import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from openai import OpenAIError
from PIL import Image
from test_app import completion

import app as server
from photo_translation import parse_tsv, region_style, translate_regions


def image_file():
    image = Image.new("RGB", (300, 180), "#0066bb")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


class PhotoTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()
        self.regions = [
            {"x": 20, "y": 30, "width": 90, "height": 20, "text": "สวัสดี", "confidence": 95},
            {"x": 160, "y": 30, "width": 90, "height": 20, "text": "ขอบคุณ", "confidence": 95},
        ]

    def test_photo_api_returns_original_pixels_and_positioned_translations(self):
        with (
            patch("photo_translation.positioned_text", return_value=self.regions),
            patch.object(server, "get_client") as client,
        ):
            client.return_value.chat.completions.create.return_value = completion(
                json.dumps(
                    {"translations": [{"id": 1, "text": "Thank you"}, {"id": 0, "text": "Hello"}]}
                )
            )
            response = self.client.post(
                "/api/photo-translate",
                data={
                    "source": "th",
                    "target": "en",
                    "tone": "natural",
                    "file": (io.BytesIO(image_file()), "photo.png"),
                },
            )
            self.assertEqual(response.status_code, 200)
            data = response.json
            self.assertTrue(data["image"].startswith("data:image/png;base64,"))
            self.assertEqual((data["width"], data["height"]), (300, 180))
            self.assertEqual(
                [item["translation"] for item in data["regions"]], ["Hello", "Thank you"]
            )
            self.assertEqual(data["regions"][0]["x"], 20)
            self.assertEqual(data["regions"][0]["background"], "#0066bb")
            self.assertEqual(data["regions"][0]["foreground"], "#ffffff")

    def test_same_language_does_not_call_translation_model(self):
        with patch.object(server, "get_client") as client:
            self.assertEqual(
                translate_regions(self.regions, "th", "th", "natural", client, "model"),
                ["สวัสดี", "ขอบคุณ"],
            )
            client.chat.completions.create.assert_not_called()

    def test_incomplete_or_duplicate_model_ids_are_rejected(self):
        bad_results = [
            {"translations": [{"id": 0, "text": "Hello"}]},
            {"translations": [{"id": 0, "text": "Hello"}, {"id": 0, "text": "Thank you"}]},
            {"translations": [{"id": 0, "text": "Hello"}, {"id": 1, "text": ""}]},
            {"translations": "bad"},
        ]
        with patch.object(server, "get_client") as client:
            for result in bad_results:
                client.chat.completions.create.return_value = completion(json.dumps(result))
                with self.assertRaises(RuntimeError):
                    translate_regions(self.regions, "th", "en", "natural", client, "model")

    def test_retry_reuses_validated_batches_after_a_later_rate_limit(self):
        regions = [{"text": f"รายการ {index}"} for index in range(25)]
        error = OpenAIError("Rate limited")
        error.status_code = 429
        sizes = []
        with patch.object(server, "get_client") as client:

            def provider(**options):
                batch = json.loads(options["messages"][1]["content"])
                sizes.append(len(batch))
                self.assertLessEqual(options["max_completion_tokens"], 4096)
                if len(sizes) == 2:
                    raise error
                return completion(
                    json.dumps(
                        {
                            "translations": [
                                {"id": item["id"], "text": "Item " + item["text"].split()[-1]}
                                for item in batch
                            ]
                        }
                    )
                )

            client.return_value.chat.completions.create.side_effect = provider
            with self.assertRaises(OpenAIError):
                translate_regions(regions, "th", "en", "natural", client.return_value, "model")
            result = translate_regions(regions, "th", "en", "natural", client.return_value, "model")
        self.assertEqual(sizes, [20, 5, 5])
        self.assertEqual(result, [f"Item {index}" for index in range(25)])

    def test_long_alternate_readings_are_split_without_losing_labels(self):
        regions = [{"text": f"label {i}", "ocr_variants": ["x" * 900]} for i in range(3)]
        with patch.object(server, "get_client") as client:

            def provider(**options):
                items = json.loads(options["messages"][1]["content"])
                return completion(
                    json.dumps(
                        {
                            "translations": [
                                {"id": item["id"], "text": "translated " + item["text"]}
                                for item in items
                            ]
                        }
                    )
                )

            client.return_value.chat.completions.create.side_effect = provider
            result = translate_regions(regions, "en", "th", "natural", client.return_value, "model")
            self.assertEqual(client.return_value.chat.completions.create.call_count, 3)
        self.assertEqual(result, ["translated " + r["text"] for r in regions])

    def test_bad_photo_and_invalid_settings_are_json_errors(self):
        for settings in [{"source": "bad"}, {"target": "bad"}, {"tone": "bad"}, {}]:
            response = self.client.post(
                "/api/photo-translate",
                data={**settings, "file": (io.BytesIO(b"not image"), "bad.png")},
            )
            self.assertEqual(response.status_code, 400)
            self.assertIn("error", response.json)
        self.assertEqual(self.client.post("/api/photo-translate").status_code, 400)

    def test_auto_language_is_used_for_positioned_ocr_and_reverse_labels(self):
        with (
            patch("photo_translation.photo_language", return_value="ja"),
            patch("photo_translation.positioned_text", return_value=self.regions) as detect,
            patch.object(server, "get_client") as client,
        ):
            client.return_value.chat.completions.create.return_value = completion(
                '{"translations":[{"id":0,"text":"Hello"},{"id":1,"text":"Thanks"}]}'
            )
            response = self.client.post(
                "/api/photo-translate",
                data={
                    "source": "auto",
                    "target": "en",
                    "file": (io.BytesIO(image_file()), "photo.png"),
                },
            )
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json["source_language"], "ja")
            self.assertEqual(detect.call_args.args[1], "ja")

    def test_successful_photo_is_cached_without_repeating_ai_calls(self):
        with (
            patch("photo_translation.positioned_text", return_value=self.regions),
            patch.object(server, "get_client") as client,
        ):
            client.return_value.chat.completions.create.return_value = completion(
                '{"translations":[{"id":0,"text":"Hello"},{"id":1,"text":"Thanks"}]}'
            )
            for _ in range(2):
                response = self.client.post(
                    "/api/photo-translate",
                    data={
                        "source": "th",
                        "target": "en",
                        "file": (io.BytesIO(image_file()), "photo.png"),
                    },
                )
                self.assertEqual(response.status_code, 200)
            self.assertEqual(client.return_value.chat.completions.create.call_count, 1)

    def test_rate_limit_is_visible_and_failed_results_are_not_cached(self):
        error = OpenAIError("Rate limited")
        error.status_code = 429
        error.response = SimpleNamespace(headers={"retry-after": "2.1"})
        error.body = {"message": "Too many requests"}
        with (
            patch("photo_translation.positioned_text", return_value=self.regions),
            patch.object(server, "get_client") as client,
        ):
            client.return_value.chat.completions.create.side_effect = [
                error,
                completion('{"translations":[{"id":0,"text":"Hello"},{"id":1,"text":"Thanks"}]}'),
            ]
            responses = [
                self.client.post(
                    "/api/photo-translate",
                    data={
                        "source": "th",
                        "target": "en",
                        "file": (io.BytesIO(image_file()), "photo.png"),
                    },
                )
                for _ in range(3)
            ]
            self.assertEqual([response.status_code for response in responses], [429, 200, 200])
            self.assertEqual(responses[0].json["code"], "rate_limit_exceeded")
            self.assertEqual(responses[0].json["retry_after"], 3)
            self.assertEqual(responses[0].headers["Retry-After"], "3")
            self.assertEqual(client.return_value.chat.completions.create.call_count, 2)
        error.response = SimpleNamespace(headers={})
        error.body = {"message": "Please try again in 1m2.5s."}
        self.assertEqual(server.retry_delay(error), 63)

    def test_tsv_literal_quotes_do_not_consume_later_rows(self):
        tsv = "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n"
        tsv += (
            '4\t1\t1\t1\t1\t0\t20\t30\t90\t20\t-1\t\n5\t1\t1\t1\t1\t1\t20\t30\t90\t20\t95\t"Hello\n'
        )
        tsv += "4\t1\t2\t1\t1\t0\t160\t30\t90\t20\t-1\t\n5\t1\t2\t1\t1\t1\t160\t30\t90\t20\t95\tThanks\n"
        regions = parse_tsv(tsv, 1, 300, 180)
        self.assertEqual(len(regions), 2)
        self.assertEqual(regions[1]["text"], "Thanks")
        image = Image.new("RGB", (300, 180), "white")
        self.assertEqual(region_style(image, regions[0]), ("#ffffff", "#111111"))


if __name__ == "__main__":
    unittest.main()
