import os
import unittest
from unittest.mock import MagicMock, patch

from model_routing import review_route, routing_identity


class ModelRoutingTests(unittest.TestCase):
    def route(self, text="ไม่ใส่ถั่ว ผมแพ้ถั่วลิสง", **kwargs):
        return review_route(
            self.primary, text, "No peanuts.", "th", "en", "general", [], [], **kwargs
        )

    def setUp(self):
        self.primary = MagicMock()
        self.env = patch.dict(
            os.environ, {"TRANSLATION_REVIEW_PROVIDER": "gemini", "GEMINI_API_KEY": "test-only"}
        )
        self.env.start()
        self.addCleanup(self.env.stop)

    @patch("model_routing._gemini_client")
    def test_risk_uses_alternate_but_ordinary_chat_stays_primary(self, client):
        self.assertEqual(self.route()[2], "gemini")
        self.assertIs(self.route(text="สวัสดีครับ", chat=True)[0], self.primary)
        client.assert_called_once_with("test-only")

    @patch("model_routing._gemini_client")
    def test_missing_key_disabled_same_language_and_long_text_do_not_call_gemini(self, client):
        with patch.dict(os.environ, {"GEMINI_API_KEY": ""}):
            self.assertIs(self.route()[0], self.primary)
        self.assertIs(self.route(enabled=False)[0], self.primary)
        self.assertIs(self.route(text="ไม่" * 1600)[0], self.primary)
        self.assertIs(
            review_route(self.primary, "ไม่", "ไม่", "th", "th", "general", [], [])[0], self.primary
        )
        client.assert_not_called()

    def test_cache_identity_tracks_provider_model_and_key_presence_without_secret(self):
        first = routing_identity()
        self.assertNotIn("test-only", str(first))
        with patch.dict(os.environ, {"GEMINI_API_KEY": ""}):
            self.assertNotEqual(first, routing_identity())
        with patch.dict(os.environ, {"GEMINI_REVIEW_MODEL": "another-model"}):
            self.assertNotEqual(first, routing_identity())


class RoutedReviewAPITests(unittest.TestCase):
    def test_gemini_failure_preserves_draft_and_does_not_cache_or_retry_on_groq(self):
        from openai import OpenAIError

        import app as server

        draft = "Please do not add peanuts."
        with (
            patch.dict(
                os.environ, {"TRANSLATION_REVIEW_PROVIDER": "gemini", "GEMINI_API_KEY": "test-only"}
            ),
            patch.object(server, "get_client") as primary,
            patch.object(server, "translate_text", return_value=draft),
            patch("model_routing._gemini_client") as alternate,
        ):
            create = alternate.return_value.chat.completions.create
            create.side_effect = OpenAIError("unavailable")
            body = {"text": "ไม่ใส่ถั่ว ผมแพ้ถั่วลิสง", "source": "th", "target": "en"}
            client = server.app.test_client()
            for _ in range(2):
                response = client.post("/api/translate", json=body)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.get_json()["translation"], draft)
                self.assertEqual(response.get_json()["quality_review"]["provider"], "gemini")
                self.assertEqual(response.get_json()["quality_review"]["status"], "unavailable")
                self.assertNotEqual(response.headers["X-Result-Cache"], "hit")
            self.assertEqual(create.call_count, 2)
            primary.return_value.chat.completions.create.assert_not_called()


class ReasoningOptionsTests(unittest.TestCase):
    def test_configured_reasoning_options_match_sdk_contract(self):
        from project_config import reasoning_options

        self.assertEqual(reasoning_options(""), {})
        for effort in ("none", "minimal", "low", "medium", "high", "xhigh", "max"):
            with self.subTest(effort=effort):
                self.assertEqual(reasoning_options(effort), {"reasoning_effort": effort})
        with self.assertRaises(ValueError):
            reasoning_options("unsupported-level")
