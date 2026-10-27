"""Mixed-language menus must not be skipped because their heading is English."""

import io
import json
import unittest
from unittest.mock import MagicMock, patch

from test_app import completion
from test_photo_translation import image_file

import app as server
from photo_translation import _photo_language, _translate_photo, ocr_languages, translate_regions


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
            self.assertEqual(response.status_code, 200, response.get_json())
            self.assertEqual(ocr.call_args.args[1], "th,en")
            self.assertEqual(response.get_json()["regions"][1]["translation"], "Fried rice")
            self.assertEqual(response.get_json()["translated_regions"], 1)
            self.assertEqual(response.get_json()["source_language"], "th")
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
            self.assertEqual(result.get_json()["translated_regions"], 0)

    def test_price_hours_and_phone_words_translate_without_repainting_original_thai(self):
        class Regions(list):
            protected_boxes = []

        originals = ["50 บาท", "เวลา 10:00 - 20:00 น.", "โทร 091 234 5678", "ร้านสุข", "50"]
        translated = ["50 Baht", "Hours 10:00 - 20:00", "Tel 091 234 5678", "Suk Restaurant"]
        regions = Regions(
            [
                {
                    "x": 10,
                    "y": 5 + i * 30,
                    "width": 180,
                    "height": 20,
                    "text": text,
                    "preserve_original": True,
                }
                for i, text in enumerate(originals)
            ]
        )
        regions.protected_boxes = [
            {key: region[key] for key in ("x", "y", "width", "height")} for region in regions
        ]
        client = MagicMock()

        client.chat.completions.create.return_value = completion(
            json.dumps(
                {"translations": [{"id": i, "text": text} for i, text in enumerate(translated)]}
            )
        )
        with patch("photo_translation.positioned_text", return_value=regions):
            result = _translate_photo(image_file(), "th", "en", "natural", client, "model")
        self.assertEqual([r["translation"] for r in result["regions"]], translated + ["50"])
        self.assertTrue(all(not r["preserve_original"] for r in result["regions"][:4]))
        self.assertTrue(result["regions"][4]["preserve_original"])
        self.assertEqual(result["protected_boxes"], [regions.protected_boxes[4]])
        self.assertEqual(result["translated_regions"], 4)
        self.assertEqual(result["review_required"], 0)

    def test_same_language_setting_does_not_skip_foreign_thai_labels(self):
        client = MagicMock()
        client.chat.completions.create.return_value = completion(
            '{"translations":[{"id":0,"text":"50 Baht"}]}'
        )
        result = translate_regions([{"text": "50 บาท"}], "en", "en", "natural", client, "model")
        self.assertEqual(result, ["50 Baht"])
        client.chat.completions.create.assert_called_once()

    def test_price_with_wrong_digits_after_repair_fails_instead_of_returning_success(self):
        client = MagicMock()
        client.chat.completions.create.return_value = completion(
            '{"translations":[{"id":0,"text":"80 Baht"}]}'
        )
        with patch(
            "photo_translation.positioned_text",
            return_value=[{"x": 10, "y": 10, "width": 90, "height": 20, "text": "50 บาท"}],
        ):
            with self.assertRaises(RuntimeError):
                _translate_photo(image_file(), "th", "en", "natural", client, "model")
        self.assertEqual(client.chat.completions.create.call_count, 2)

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

    def test_label_prompt_translates_meaning_instead_of_transliterating(self):
        client = MagicMock()
        client.chat.completions.create.return_value = completion(
            '{"translations":[{"id":0,"text":"Thai National ID Card"}]}'
        )
        result = translate_regions(
            [{"text": "บัตรประจําตัวประชาชน"}], "th", "en", "natural", client, "model"
        )
        self.assertEqual(result, ["Thai National ID Card"])
        prompt = client.chat.completions.create.call_args.kwargs["messages"][0]["content"]
        self.assertIn("never write their Thai pronunciation in Latin letters", prompt)
        self.assertIn("Never add pronunciation, transliteration or phonetic guides", prompt)
