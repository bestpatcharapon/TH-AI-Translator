"""Image evidence, small-text recovery, and truthful partial-result regressions."""

import io
import json
import os
import unittest
from unittest.mock import MagicMock, patch

from openai import OpenAIError
from PIL import Image
from test_app import completion
from test_photo_translation import image_file

from photo_reading import (
    _reading_batch_cache,
    _reading_cache,
    reading_sheet,
    verify_photo_readings,
)
from photo_translation import _translate_photo, detect_regions, recover_small_regions


def large_image():
    output = io.BytesIO()
    Image.new("RGB", (640, 900), "#101010").save(output, format="PNG")
    return output.getvalue()


def region(text="ข้าวผัด", **values):
    return {"x": 20, "y": 30, "width": 150, "height": 12, "confidence": 70, "text": text, **values}


class PhotoReadingTests(unittest.TestCase):
    def test_dense_typhoon_menu_batches_unread_regions_with_vision(self):
        from document_ocr import NoReadableTextError
        vision = MagicMock()
        vision.chat.completions.create.side_effect = self.readable_batch
        with (
            patch.dict(os.environ, {"PHOTO_READING_PROVIDER": "typhoon", "TYPHOON_API_KEY": "test", "PHOTO_READING_FALLBACK": "groq"}),
            patch("photo_reading._typhoon_client", return_value=MagicMock()),
            patch("photo_reading._transcribe_page", side_effect=NoReadableTextError("unread")),
        ):
            result = verify_photo_readings(large_image(), [region(y=20+i*15) for i in range(43)], vision)
        self.assertEqual(len(result), 43)
        self.assertTrue(all(r["reading_verified"] and not r["reading_review"] for r in result))
        self.assertEqual(vision.chat.completions.create.call_count, 9)

    def setUp(self):
        _reading_cache.clear()
        _reading_batch_cache.clear()
        env = patch.dict(
            os.environ,
            {
                "PHOTO_READING_PROVIDER": "groq",
                "PHOTO_READING_TIMEOUT_SECONDS": "45",
                "PHOTO_READING_MAX_REQUESTS": "12",
            },
        )
        env.start()
        self.addCleanup(env.stop)

    @staticmethod
    def readable_batch(**options):
        prompt = options["messages"][0]["content"][0]["text"]
        ids = [int(value) for value in prompt.split("with exactly these ids: ")[1].split(",")]
        return completion(
            json.dumps(
                {"readings": [{"id": index, "text": "ข้าวผัด", "readable": True} for index in ids]}
            )
        )

    def test_local_ocr_uses_configured_reading_provider(self):
        groq = MagicMock()
        gemini = MagicMock()
        gemini.chat.completions.create.side_effect = self.readable_batch
        with (
            patch.dict(os.environ, {"PHOTO_READING_PROVIDER": "gemini", "GEMINI_API_KEY": "test"}),
            patch("photo_reading._gemini_client", return_value=gemini),
        ):
            result = verify_photo_readings(large_image(), [region()], groq)
        self.assertTrue(result[0]["reading_verified"])
        gemini.chat.completions.create.assert_called_once()
        groq.chat.completions.create.assert_not_called()

    def test_typhoon_reads_individual_detected_crop(self):
        client = MagicMock()
        with (
            patch.dict(os.environ, {"PHOTO_READING_PROVIDER": "typhoon", "TYPHOON_API_KEY": "test"}),
            patch("photo_reading._typhoon_client", return_value=client),
            patch("photo_reading._transcribe_page", return_value="ข้าวผัด") as transcribe,
        ):
            result = verify_photo_readings(large_image(), [region()], MagicMock())
        self.assertTrue(result[0]["reading_verified"])
        self.assertEqual(result[0]["text"], "ข้าวผัด")
        self.assertEqual(transcribe.call_args.args[2], "image/png")

    def test_typhoon_verifies_high_confidence_native_ocr(self):
        client = MagicMock()
        with (
            patch.dict(os.environ, {"PHOTO_READING_PROVIDER": "typhoon", "TYPHOON_API_KEY": "test"}),
            patch("photo_reading._typhoon_client", return_value=client),
            patch("photo_reading._transcribe_page", return_value="กาแฟเย็น 60 บาท"),
        ):
            result = verify_photo_readings(large_image(), [region("กาแฟเย็น 60 บาที", height=40, confidence=90, native_ocr=True)], MagicMock())
        self.assertTrue(result[0]["reading_verified"])
        self.assertEqual(result[0]["text"], "กาแฟเย็น 60 บาท")

    def test_typhoon_prioritizes_uncertain_text_when_budget_is_small(self):
        client = MagicMock()
        sources = [region("หัวข้อ", confidence=95, native_ocr=True), region("ข้าวผัด", y=100)]
        with (
            patch.dict(os.environ, {"PHOTO_READING_PROVIDER": "typhoon", "TYPHOON_API_KEY": "test", "PHOTO_READING_MAX_REQUESTS": "1"}),
            patch("photo_reading._typhoon_client", return_value=client),
            patch("photo_reading._transcribe_page", return_value="ข้าวผัด"),
        ):
            result = verify_photo_readings(large_image(), sources, MagicMock())
        self.assertTrue(result[1]["reading_verified"])
        self.assertFalse(result[0].get("reading_review", False))
        self.assertEqual(result[0]["text"], "หัวข้อ")

    def test_local_limit_leaves_excess_eligible_regions_for_review_on_retries(self):
        client = MagicMock()
        client.chat.completions.create.side_effect = self.readable_batch
        sources = [
            region(y=10 + index * 25, reading_verified=True, reading_review=False)
            for index in range(31)
        ]
        sources.append(region("50", preserve_original=True))
        for _ in range(2):
            result = verify_photo_readings(large_image(), sources, client)
            self.assertTrue(all(item["reading_verified"] for item in result[:30]))
            self.assertTrue(result[30]["reading_review"])
            self.assertFalse(result[30]["reading_verified"])
            self.assertEqual(result[30]["text"], sources[30]["text"])
            self.assertEqual(result[31], sources[31])
            self.assertFalse(_reading_cache._entries)
        self.assertEqual(client.chat.completions.create.call_count, 3)
        self.assertFalse(sources[30]["reading_review"])

    def test_default_budget_allows_31_vision_regions_in_seven_calls(self):
        client = MagicMock()
        now = [100.0]

        def provider(**options):
            self.assertEqual(options["timeout"], 18)
            now[0] += 1
            return self.readable_batch(**options)

        client.chat.completions.create.side_effect = provider
        sources = [region(y=10 + index * 25, vision_only=True) for index in range(31)]
        with (
            patch.dict(os.environ, {"PHOTO_READING_PROVIDER": "groq"}, clear=True),
            patch("photo_reading.monotonic", side_effect=lambda: now[0]),
        ):
            result = verify_photo_readings(large_image(), sources, client)
        self.assertTrue(all(item["reading_verified"] for item in result))
        self.assertEqual(client.chat.completions.create.call_count, 7)

    def test_deadline_bounds_call_timeouts_and_retry_reuses_successes(self):
        client = MagicMock()
        now = [100.0]
        timeouts = []

        def provider(**options):
            timeouts.append(options["timeout"])
            now[0] += 6
            return self.readable_batch(**options)

        client.chat.completions.create.side_effect = provider
        sources = [region(y=10 + index * 25) for index in range(30)]
        with (
            patch.dict(os.environ, {"PHOTO_READING_TIMEOUT_SECONDS": "10"}),
            patch("photo_reading.monotonic", side_effect=lambda: now[0]),
        ):
            first = verify_photo_readings(large_image(), sources, client)
            self.assertTrue(all(item["reading_verified"] for item in first[:20]))
            self.assertTrue(all(item["reading_review"] for item in first[20:]))
            self.assertTrue(all(not item["reading_verified"] for item in first[20:]))
            self.assertFalse(_reading_cache._entries)
            second = verify_photo_readings(large_image(), sources, client)
        self.assertEqual(timeouts, [10, 4, 10])
        self.assertTrue(all(item["reading_verified"] for item in second))

    def test_reading_preparation_spends_deadline_without_provider_calls(self):
        client = MagicMock()
        sources = [region()]
        with patch("photo_reading.monotonic", side_effect=[100, 145]):
            result = verify_photo_readings(large_image(), sources, client)
        client.chat.completions.create.assert_not_called()
        self.assertTrue(result[0]["reading_review"])
        self.assertFalse(result[0]["reading_verified"])
        self.assertFalse(_reading_cache._entries)
        self.assertFalse(_reading_batch_cache._entries)

    def test_request_budget_counts_only_uncached_calls_across_retries(self):
        client = MagicMock()
        client.chat.completions.create.side_effect = self.readable_batch
        sources = [region(y=10 + index * 25, vision_only=True) for index in range(31)]
        with (
            patch.dict(os.environ, {"PHOTO_READING_MAX_REQUESTS": "2"}),
            patch("photo_reading.monotonic", return_value=100),
        ):
            for attempt, verified in enumerate((10, 20, 30, 31), start=1):
                result = verify_photo_readings(large_image(), sources, client)
                self.assertEqual(sum(item["reading_verified"] for item in result), verified)
                self.assertTrue(all(item["reading_review"] for item in result[verified:]))
                self.assertTrue(all(not item["reading_verified"] for item in result[verified:]))
                self.assertEqual(client.chat.completions.create.call_count, min(attempt * 2, 7))
                if verified < 31:
                    self.assertFalse(_reading_cache._entries)
            verify_photo_readings(large_image(), sources, client)
        self.assertEqual(client.chat.completions.create.call_count, 7)

    def test_invalid_response_spends_request_budget_but_is_not_cached(self):
        client = MagicMock()
        client.chat.completions.create.side_effect = [
            completion("bad JSON"),
            self.readable_batch(
                messages=[
                    {
                        "content": [
                            {"text": "with exactly these ids: " + ",".join(map(str, range(10, 20)))}
                        ]
                    }
                ]
            ),
        ]
        sources = [region(y=10 + index * 25) for index in range(30)]
        with (
            patch.dict(os.environ, {"PHOTO_READING_MAX_REQUESTS": "2"}),
            patch("photo_reading.monotonic", return_value=100),
        ):
            first = verify_photo_readings(large_image(), sources, client)
            self.assertEqual(client.chat.completions.create.call_count, 2)
            self.assertTrue(all(item["reading_review"] for item in first[:10] + first[20:]))
            client.chat.completions.create.side_effect = self.readable_batch
            with patch.dict(os.environ, {"PHOTO_READING_MAX_REQUESTS": "1"}):
                second = verify_photo_readings(large_image(), sources, client)
            self.assertEqual(client.chat.completions.create.call_count, 3)
            # The second batch is cached and still usable after the one new call.
            self.assertTrue(all(item["reading_verified"] for item in second[:20]))
            self.assertTrue(all(item["reading_review"] for item in second[20:]))
            third = verify_photo_readings(large_image(), sources, client)
        self.assertEqual(client.chat.completions.create.call_count, 4)
        self.assertTrue(all(item["reading_verified"] for item in third))

    def test_batch_cache_retains_provider_identity(self):
        sources = [region(y=10 + index * 25) for index in range(20)]
        with patch.dict(os.environ, {"PHOTO_READING_MAX_REQUESTS": "1"}):
            for client in (MagicMock(), MagicMock()):
                client.chat.completions.create.side_effect = self.readable_batch
                result = verify_photo_readings(large_image(), sources, client)
                self.assertEqual(client.chat.completions.create.call_count, 1)
                self.assertTrue(result[0]["reading_verified"])
                self.assertTrue(result[10]["reading_review"])

    def test_invalid_budget_configuration_has_clear_errors(self):
        for name, values in (
            ("PHOTO_READING_TIMEOUT_SECONDS", ("", "abc", "0", "-1", "nan", "inf", "-inf")),
            ("PHOTO_READING_MAX_REQUESTS", ("", "abc", "0", "-1", "1.5", "nan", "inf")),
        ):
            for value in values:
                with self.subTest(name=name, value=value), patch.dict(os.environ, {name: value}):
                    client = MagicMock()
                    with self.assertRaisesRegex(RuntimeError, name):
                        verify_photo_readings(large_image(), [region()], client)
                    client.chat.completions.create.assert_not_called()

    def test_crops_are_grounded_and_numbered_without_changing_positions(self):
        source = region()
        with Image.open(io.BytesIO(large_image())) as image:
            sheet = reading_sheet(image, [(7, source)])
        with Image.open(io.BytesIO(sheet)) as image:
            self.assertEqual(image.width, 1020)
            self.assertGreater(image.height, 60)
        self.assertEqual(source["x"], 20)

    def test_many_crops_use_a_compact_sheet_without_dropping_region_ids(self):
        with Image.open(io.BytesIO(large_image())) as image:
            regions = [region(y=10 + i * 25) for i in range(30)]
            sheet = reading_sheet(image, list(enumerate(regions)), regions)
        with Image.open(io.BytesIO(sheet)) as image:
            self.assertEqual(image.width, 1020)
            self.assertLessEqual(image.height, 1500)

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

    def test_rate_limited_reading_retry_resumes_after_successful_small_batches(self):
        client = MagicMock()
        sources = [region(y=10 + index * 30) for index in range(20)]
        calls = []
        error = OpenAIError("rate limited")

        def provider(**options):
            prompt = options["messages"][0]["content"][0]["text"]
            ids = [int(value) for value in prompt.split("with exactly these ids: ")[1].split(",")]
            calls.append(ids)
            self.assertLessEqual(len(ids), 10)
            if len(calls) == 2:
                raise error
            return completion(
                json.dumps(
                    {
                        "readings": [
                            {"id": index, "text": "ข้าวผัด", "readable": True} for index in ids
                        ]
                    }
                )
            )

        client.chat.completions.create.side_effect = provider
        with self.assertRaises(OpenAIError):
            verify_photo_readings(large_image(), sources, client)
        result = verify_photo_readings(large_image(), sources, client)
        self.assertEqual([len(batch) for batch in calls], [10, 10, 10])
        self.assertEqual(calls[1], calls[2])
        self.assertTrue(all(region["reading_verified"] for region in result))

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
        self.assertTrue(result[0]["reading_review"])
        self.assertFalse(result[0]["reading_verified"])
        self.assertFalse(_reading_cache._entries)

    def test_conflicting_ingredient_or_strong_ocr_always_requires_review(self):
        for text, confidence in (("ข้าวผัดไก่", 70), ("อาหารจานเดียว", 95)):
            with self.subTest(text=text):
                client = MagicMock()
                client.chat.completions.create.return_value = completion(
                    '{"readings":[{"id":0,"text":"ข้าวผัด","readable":true}]}'
                )
                for _ in range(2):
                    result = verify_photo_readings(
                        large_image(), [region(text, confidence=confidence)], client
                    )
                    self.assertEqual(result[0]["text"], text)
                    self.assertTrue(result[0]["reading_review"])
                    self.assertFalse(result[0]["reading_verified"])
                    self.assertNotIn("ocr_variants", result[0])
                    self.assertFalse(_reading_cache._entries)
                self.assertEqual(client.chat.completions.create.call_count, 1)

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

    def test_visual_verification_cannot_silently_change_numeric_words(self):
        client = MagicMock()
        client.chat.completions.create.return_value = completion(
            '{"readings":[{"id":0,"text":"80 บาท","readable":true}]}'
        )
        result = verify_photo_readings(large_image(), [region("50 บาท")], client)
        self.assertEqual(result[0]["text"], "50 บาท")
        self.assertTrue(result[0]["reading_review"])
        self.assertFalse(result[0]["reading_verified"])

    def test_translation_cannot_silently_change_a_price(self):
        client = MagicMock()
        client.chat.completions.create.side_effect = [
            completion('{"translations":[{"id":0,"text":"80 Baht"}]}'),
            completion('{"translations":[{"id":0,"text":"50 Baht"}]}'),
        ]
        with patch("photo_translation.positioned_text", return_value=[region("50 บาท")]):
            result = _translate_photo(image_file(), "th", "en", "natural", client, "model")
        self.assertEqual(result["regions"][0]["translation"], "50 Baht")
        self.assertFalse(result["regions"][0]["preserve_original"])
        self.assertEqual(client.chat.completions.create.call_count, 2)

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
