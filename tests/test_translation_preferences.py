import io
import unittest
from unittest.mock import patch

from openai import OpenAIError
from test_app import completion

import app as server
from project_config import STYLE_RULES, TONES, tone_description


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

    def test_six_styles_reach_real_provider_request_with_distinct_rules(self):
        styles = ["standard", "natural", "formal", "casual", "friendly", "business"]
        self.assertEqual(list(TONES), styles)
        self.assertEqual(set(STYLE_RULES), set(styles))
        prompts = []
        with (
            patch.object(server, "get_client") as client,
            patch.object(
                server,
                "review_draft",
                return_value=("ตรวจรายงานด้วยครับ", {"status": "not_requested"}),
            ),
        ):
            client.return_value.chat.completions.create.return_value = completion(
                "ตรวจรายงานด้วยครับ"
            )
            for tone in styles:
                with self.subTest(tone=tone):
                    response = self.client.post(
                        "/api/translate",
                        json={
                            "text": "Please review the report.",
                            "source": "en",
                            "target": "th",
                            "tone": tone,
                        },
                    )
                    self.assertEqual(response.status_code, 200)
                    prompt = client.return_value.chat.completions.create.call_args.kwargs[
                        "messages"
                    ][0]["content"]
                    self.assertIn(STYLE_RULES[tone], prompt)
                    self.assertIn("uncertainty", prompt)
                    self.assertIn("must not add facts or erase intent", prompt)
                    prompts.append(prompt)
            self.assertEqual(client.return_value.chat.completions.create.call_count, 6)
        self.assertEqual(len(set(prompts)), 6)
        self.assertIn("source structure", prompts[0])
        self.assertIn("idiomatic everyday", prompts[1])
        self.assertIn("respectful vocabulary", prompts[2])
        self.assertIn("relaxed spoken", prompts[3])
        self.assertIn("warm conversational", prompts[4])
        self.assertIn("commitments, deadlines", prompts[5])

    def test_business_style_is_carried_into_image_and_assistant_paths(self):
        result = {"regions": [{"text": "Hello", "translation": "สวัสดี"}], "source_language": "en"}
        with (
            patch.object(server, "translate_photo", return_value=result) as photo,
            patch.object(server, "get_client"),
        ):
            response = self.client.post(
                "/api/photo-translate",
                data={
                    "source": "en",
                    "target": "th",
                    "tone": "business",
                    "file": (io.BytesIO(b"photo"), "photo.png"),
                },
            )
            self.assertEqual(response.status_code, 200)
            self.assertEqual(photo.call_args.args[3], tone_description("business"))
        with (
            patch.object(
                server, "assistant_result", return_value={"explanation": "Explanation"}
            ) as assistant,
            patch.object(server, "get_client"),
        ):
            response = self.client.post(
                "/api/assist",
                json={
                    "text": "Hello",
                    "translation": "สวัสดี",
                    "source": "en",
                    "target": "th",
                    "tone": "business",
                    "action": "explain",
                },
            )
            self.assertEqual(response.status_code, 200)
            self.assertEqual(assistant.call_args.args[3]["tone"], tone_description("business"))

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
