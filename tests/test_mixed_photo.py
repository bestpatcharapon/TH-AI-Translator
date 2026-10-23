"""Mixed-language menus must not be skipped because their heading is English."""

import io
import unittest
from unittest.mock import patch

from test_app import completion
from test_photo_translation import image_file

import app as server
from photo_translation import _photo_language, ocr_languages, translate_regions


class MixedPhotoTests(unittest.TestCase):
    def test_detector_accepts_multiple_languages_and_both_chinese_scripts(self):
        for answer, expected in [("th,en", "th,en"), ("en,zh-tw", "en,zh-TW"), ("th,th", "th")]:
            with self.subTest(answer=answer), patch.object(server, "get_client") as provider:
                provider.return_value.chat.completions.create.return_value = completion(answer)
                self.assertEqual(_photo_language(image_file(), provider()), expected)
        self.assertEqual(ocr_languages("th,en"), "tha+eng")
        self.assertEqual(ocr_languages("zh-TW,en"), "chi_tra+eng")

    def test_auto_english_heading_does_not_skip_thai_labels(self):
        regions = [
            {"x": 10, "y": 10, "width": 90, "height": 20, "text": "Menu"},
            {"x": 10, "y": 50, "width": 90, "height": 20, "text": "ข้าวผัด"},
        ]
        with (
            patch("photo_translation.photo_language", return_value="en"),
            patch("photo_translation.positioned_text", return_value=regions) as ocr,
            patch.object(server, "get_client") as provider,
        ):
            provider.return_value.chat.completions.create.return_value = completion(
                '{"translations":[{"id":0,"text":"Menu"},{"id":1,"text":"Fried rice"}]}'
            )
            response = server.app.test_client().post(
                "/api/photo-translate",
                data={
                    "source": "auto",
                    "target": "en",
                    "file": (io.BytesIO(image_file()), "menu.png"),
                },
            )
            self.assertEqual(response.status_code, 200, response.json)
            self.assertEqual(ocr.call_args.args[1], "th,en")
            self.assertEqual(response.json["regions"][1]["translation"], "Fried rice")
            self.assertEqual(response.json["translated_regions"], 1)
            self.assertEqual(response.json["source_language"], "th")
            prompt = provider.return_value.chat.completions.create.call_args.kwargs["messages"][0][
                "content"
            ]
            self.assertIn("EACH label", prompt)

    def test_all_unchanged_labels_are_reported_as_zero_changes(self):
        region = {"x": 10, "y": 10, "width": 90, "height": 20, "text": "Menu"}
        with (
            patch("photo_translation.positioned_text", return_value=[region]),
            patch.object(server, "get_client"),
        ):
            result = server.app.test_client().post(
                "/api/photo-translate",
                data={
                    "source": "en",
                    "target": "en",
                    "file": (io.BytesIO(image_file()), "menu.png"),
                },
            )
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.json["translated_regions"], 0)

    def test_mixed_label_prompt_keeps_existing_target_text(self):
        with patch.object(server, "get_client") as provider:
            provider.return_value.chat.completions.create.return_value = completion(
                '{"translations":[{"id":0,"text":"Fried rice"}]}'
            )
            self.assertEqual(
                translate_regions(
                    [{"text": "ข้าวผัด"}], "auto", "en", "natural", provider(), "model"
                ),
                ["Fried rice"],
            )
            prompt = provider.return_value.chat.completions.create.call_args.kwargs["messages"][0][
                "content"
            ]
            self.assertIn("already in the target language unchanged", prompt)
