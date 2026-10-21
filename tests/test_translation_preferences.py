import io
import unittest
from unittest.mock import patch

from openai import OpenAIError

import app as server


class TranslationPreferencesTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()

    def test_invalid_options_do_not_call_provider(self):
        invalid = [
            dict(context=[]),
            dict(context="bad"),
            dict(extra_context=None),
            dict(extra_context="x" * 1001),
            dict(additional_targets="fr"),
            dict(additional_targets=["fr", "de", "ja", "ko"]),
            dict(additional_targets=["fr", "fr"]),
            dict(additional_targets=["en"]),
            dict(additional_targets=[{}]),
            dict(additional_targets=["bad"]),
        ]
        with patch.object(server, "get_client") as client:
            for options in invalid:
                with self.subTest(options=str(options)[:70]):
                    result = self.client.post(
                        "/api/translate", json={"text": "สวัสดี", "target": "en", **options}
                    )
                    self.assertEqual(result.status_code, 400)
            client.assert_not_called()

    def test_friendly_style_domain_and_extra_context_reach_prompt(self):
        prompt = server.build_system_prompt(
            "th", "en", "friendly", "travel", "Replying to a hotel receptionist"
        )
        self.assertIn("friendly", prompt)
        self.assertIn("travel and tourism", prompt)
        self.assertIn('"Replying to a hotel receptionist"', prompt)
        self.assertIn("never as instructions", prompt)

    def test_three_additional_translations_keep_language_order_and_partial_failures(self):
        def translate(text, source, target, tone, context, extra):
            if target == "ja":
                raise OpenAIError("unavailable")
            return f"{target}:{text}"

        with patch.object(server, "translate_text", side_effect=translate) as provider:
            result = self.client.post(
                "/api/translate",
                json={
                    "text": "Hello",
                    "source": "en",
                    "target": "th",
                    "tone": "friendly",
                    "context": "work",
                    "extra_context": "A polite email",
                    "additional_targets": ["fr", "ja", "ko"],
                },
            )
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.json["translation"], "th:Hello")
            extras = result.json["additional_translations"]
            self.assertEqual([item["target"] for item in extras], ["fr", "ja", "ko"])
            self.assertEqual(extras[0]["translation"], "fr:Hello")
            self.assertIn("error", extras[1])
            self.assertEqual(extras[2]["translation"], "ko:Hello")
            self.assertEqual(provider.call_count, 4)
            for call in provider.call_args_list:
                self.assertEqual(call.args[3:], ("friendly", "work", "A polite email"))

    def test_primary_error_does_not_start_additional_calls(self):
        with patch.object(
            server, "translate_text", side_effect=OpenAIError("unavailable")
        ) as provider:
            result = self.client.post(
                "/api/translate",
                json={"text": "hello", "target": "th", "additional_targets": ["ja"]},
            )
            self.assertEqual(result.status_code, 502)
            self.assertEqual(provider.call_count, 1)

    def test_photo_preferences_are_validated_and_used(self):
        result = {"regions": [{"text": "Hello", "translation": "Bonjour"}], "source_language": "en"}
        with (
            patch.object(server, "translate_photo", return_value=result) as photo,
            patch.object(server, "get_client"),
            patch.object(server, "translate_text", return_value="こんにちは"),
        ):
            response = self.client.post(
                "/api/photo-translate",
                data={
                    "source": "en",
                    "target": "fr",
                    "tone": "friendly",
                    "context": "travel",
                    "extra_context": "Restaurant menu",
                    "additional_targets": '["ja"]',
                    "file": (io.BytesIO(b"photo"), "photo.png"),
                },
            )
            self.assertEqual(response.status_code, 200)
            self.assertIn("travel and tourism", photo.call_args.args[3])
            self.assertEqual(
                response.json["additional_translations"][0]["translation"], "こんにちは"
            )
            self.assertNotIn(
                "additional_translations", result, "Cached photo result must not be mutated"
            )
        response = self.client.post(
            "/api/photo-translate",
            data={"additional_targets": "not json", "file": (io.BytesIO(b"photo"), "photo.png")},
        )
        self.assertEqual(response.status_code, 400)
