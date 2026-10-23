"""Image evidence, small-text recovery, and truthful partial-result regressions."""

import io
import json
import unittest
from unittest.mock import MagicMock, patch

from openai import OpenAIError
from PIL import Image
from test_app import completion
from test_photo_translation import image_file

from photo_reading import reading_sheet, verify_photo_readings
from photo_translation import _translate_photo, detect_regions, recover_small_regions


def large_image():
    output = io.BytesIO()
    Image.new("RGB", (640, 900), "#101010").save(output, format="PNG")
    return output.getvalue()


def region(text="ข้าวผัด", **values):
    return {"x": 20, "y": 30, "width": 150, "height": 12, "confidence": 70, "text": text, **values}


class PhotoReadingTests(unittest.TestCase):
    def test_crops_are_grounded_and_numbered_without_changing_positions(self):
        source = region()
        with Image.open(io.BytesIO(large_image())) as image:
            sheet = reading_sheet(image, [(7, source)])
        with Image.open(io.BytesIO(sheet)) as image:
            self.assertEqual(image.width, 1020)
            self.assertGreater(image.height, 60)
        self.assertEqual(source["x"], 20)

    def test_verified_transcription_keeps_original_and_measured_boxes(self):
        client = MagicMock()
        client.chat.completions.create.return_value = completion(
            json.dumps(
                {
                    "readings": [
                        {"id": 0, "text": "ข้าวกะเพราไก่", "readable": True},
                        {"id": 1, "text": "", "readable": False},
                    ]
                }
            )
        )
        original = [region("ข้าวกระเพาไก่"), region("อ่านไม่ออก", y=60)]
        result = verify_photo_readings(large_image(), original, client)
        self.assertEqual(result[0]["text"], "ข้าวกะเพราไก่")
        self.assertEqual(result[0]["ocr_text"], original[0]["text"])
        self.assertEqual(result[0]["x"], original[0]["x"])
        self.assertEqual(result[0]["width"], original[0]["width"])
        self.assertTrue(result[0]["reading_verified"])
        self.assertTrue(result[1]["reading_review"])
        self.assertEqual(original[0]["text"], "ข้าวกระเพาไก่")

    def test_invalid_readings_are_not_cached_as_success(self):
        client = MagicMock()
        client.chat.completions.create.side_effect = [
            completion("bad JSON"),
            completion(json.dumps({"readings": [{"id": 0, "text": "ข้าวผัด", "readable": True}]})),
        ]
        first = verify_photo_readings(large_image(), [region()], client)
        second = verify_photo_readings(large_image(), [region()], client)
        self.assertTrue(first[0]["reading_review"])
        self.assertTrue(second[0]["reading_verified"])
        self.assertEqual(client.chat.completions.create.call_count, 2)

    def test_provider_markdown_json_wrapper_is_accepted(self):
        client = MagicMock()
        client.chat.completions.create.return_value = completion(
            '```json\n{"readings":[{"id":0,"text":"ข้าวผัด","readable":true}]}\n```'
        )
        result = verify_photo_readings(large_image(), [region()], client)
        self.assertTrue(result[0]["reading_verified"])

    def test_provider_bare_array_is_accepted(self):
        client = MagicMock()
        client.chat.completions.create.return_value = completion(
            '```json\n[{"id":0,"text":"ข้าวผัด","readable":true}]\n```'
        )
        self.assertTrue(
            verify_photo_readings(large_image(), [region()], client)[0]["reading_verified"]
        )

    def test_provider_failure_is_not_mislabeled_as_an_unreadable_photo(self):
        client = MagicMock()
        client.chat.completions.create.side_effect = OpenAIError("quota reached")
        with self.assertRaises(OpenAIError):
            verify_photo_readings(large_image(), [region()], client)

    def test_vision_cannot_replace_a_strong_reading_with_a_different_dish(self):
        client = MagicMock()
        client.chat.completions.create.return_value = completion(
            '{"readings":[{"id":0,"text":"ข้าวผัดกะเพรา","readable":true}]}'
        )
        result = verify_photo_readings(large_image(), [region("ข้าวผัดทะเล", confidence=95)], client)
        self.assertEqual(result[0]["text"], "ข้าวผัดทะเล")
        self.assertNotIn("ocr_variants", result[0])

    def test_numeric_crop_is_not_rewritten_by_vision(self):
        client = MagicMock()
        client.chat.completions.create.return_value = completion(
            '{"readings":[{"id":0,"text":"50 Baht","readable":true}]}'
        )
        result = verify_photo_readings(
            large_image(), [region("8ลท", confidence=95, preserve_original=True)], client
        )
        self.assertEqual(result[0]["text"], "8ลท")
        client.chat.completions.create.assert_not_called()

    def test_translation_cannot_silently_change_a_price(self):
        client = MagicMock()
        client.chat.completions.create.side_effect = [
            completion('{"translations":[{"id":0,"text":"80 Baht"}]}'),
            completion('{"translations":[{"id":0,"text":"50 Baht"}]}'),
        ]
        with patch("photo_translation.positioned_text", return_value=[region("50 บาท")]):
            result = _translate_photo(image_file(), "th", "en", "natural", client, "model")
        self.assertEqual(result["regions"][0]["translation"], "50 บาท")
        self.assertTrue(result["regions"][0]["preserve_original"])
        client.chat.completions.create.assert_not_called()

    def test_duplicate_or_foreign_reading_ids_cannot_replace_other_labels(self):
        for entries in [
            [{"id": 0, "text": "x", "readable": True}, {"id": 0, "text": "y", "readable": True}],
            [{"id": 0, "text": "x", "readable": True}, {"id": 99, "text": "y", "readable": True}],
        ]:
            client = MagicMock()
            client.chat.completions.create.return_value = completion(
                json.dumps({"readings": entries})
            )
            result = verify_photo_readings(large_image(), [region(), region(y=70)], client)
            self.assertTrue(result[1]["reading_review"])
            if entries[1]["id"] == 0:
                self.assertTrue(result[0]["reading_review"])
                self.assertEqual(result[0]["text"], "ข้าวผัด")
            else:
                self.assertEqual(result[0]["text"], "x")

    def test_unclear_text_is_not_translated_into_an_invented_dish(self):
        with (
            patch("photo_translation.positioned_text", return_value=[region()]),
            patch(
                "photo_translation.verify_photo_readings",
                return_value=[region(reading_review=True)],
            ),
            patch("photo_translation.translate_regions", return_value=[]) as translate,
        ):
            result = _translate_photo(image_file(), "th", "en", "natural", MagicMock(), "model")
        self.assertEqual(translate.call_args.args[0], [])
        self.assertEqual(result["translated_regions"], 0)
        self.assertEqual(result["review_required"], 1)
        self.assertTrue(result["regions"][0]["reading_review"])

    def test_wrong_target_script_is_repaired_once(self):
        client = MagicMock()
        client.chat.completions.create.side_effect = [
            completion('{"translations":[{"id":0,"text":"ข้าวผัด"}]}'),
            completion('{"translations":[{"id":0,"text":"Fried rice"}]}'),
        ]
        with patch("photo_translation.positioned_text", return_value=[region()]):
            result = _translate_photo(image_file(), "th", "en", "natural", client, "model")
        self.assertEqual(result["regions"][0]["translation"], "Fried rice")
        self.assertEqual(client.chat.completions.create.call_count, 2)

    def test_repeated_wrong_target_is_not_reported_as_success(self):
        client = MagicMock()
        client.chat.completions.create.return_value = completion(
            '{"translations":[{"id":0,"text":"ข้าวผัด"}]}'
        )
        with patch("photo_translation.positioned_text", return_value=[region()]):
            with self.assertRaises(RuntimeError):
                _translate_photo(image_file(), "th", "en", "natural", client, "model")
        self.assertEqual(client.chat.completions.create.call_count, 2)

    def test_basil_rice_cooking_method_is_repaired_instead_of_fried_rice(self):
        client = MagicMock()
        client.chat.completions.create.side_effect = [
            completion('{"translations":[{"id":0,"text":"Chicken basil fried rice"}]}'),
            completion('{"translations":[{"id":0,"text":"Rice with holy basil chicken"}]}'),
        ]
        with patch("photo_translation.positioned_text", return_value=[region("ข้าวกระเพราไก่")]):
            result = _translate_photo(image_file(), "th", "en", "natural", client, "model")
        self.assertEqual(result["regions"][0]["translation"], "Rice with holy basil chicken")

    def test_tile_coordinates_map_back_to_the_original_photo(self):
        image = Image.new("RGB", (640, 900), "white")
        with (
            patch("photo_translation.run_ocr", return_value="tsv"),
            patch("photo_translation.parse_tsv", side_effect=lambda *args: [region(confidence=95)]),
        ):
            result = recover_small_regions(
                image, [region(x=500, y=800, width=100, confidence=90)], "th,en"
            )
        self.assertEqual(len(result), 5)
        self.assertIn((302, 426), [(item["x"], item["y"]) for item in result])
        for item in result:
            self.assertLessEqual(item["x"] + item["width"], image.width)
            self.assertLessEqual(item["y"] + item["height"], image.height)

    def test_reliable_white_text_is_not_discarded_from_the_normal_pass(self):
        image = Image.new("RGB", (640, 900), "black")
        caption = region(width=200, height=20, confidence=95)
        with patch("photo_translation.ordered_map", return_value=[[caption], [], []]):
            result = detect_regions(image, "th")
        self.assertEqual(result[0]["text"], "ข้าวผัด")
