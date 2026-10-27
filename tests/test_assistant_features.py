import json
import unittest
from unittest.mock import patch

from test_app import completion

import app as server


class AssistantTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()
        self.context = {
            "text": "สวัสดีครับคนไทย",
            "translation": "Hello, Thai people!",
            "source": "th",
            "target": "en",
            "tone": "natural",
            "interface_language": "en",
        }

    def test_tools_return_validated_results_and_language_context(self):
        results = {
            "source_info": {
                "pronunciation": "Sawatdi khrap khon Thai",
                "alternatives": ["สวัสดีครับ", "สวัสดีครับทุกคน"],
            },
            "explain": {"explanation": "The greeting preserves the polite tone."},
            "check": {
                "assessment": "needs_revision",
                "notes": "Preserve the plural audience.",
                "revision": "Hello, Thai people!",
            },
            "replies": {"replies": ["Hello!", "Nice to meet you.", "How are you?"]},
        }
        with patch.object(server, "get_client") as client:
            for action, expected in results.items():
                with self.subTest(action=action):
                    client.return_value.chat.completions.create.return_value = completion(
                        json.dumps(expected)
                    )
                    response = self.client.post(
                        "/api/assist", json={**self.context, "action": action}
                    )
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(response.get_json(), {**expected, "source_language": "th"})
                    options = client.return_value.chat.completions.create.call_args.kwargs
                    payload = json.loads(options["messages"][1]["content"])
                    self.assertEqual(payload["source_language"], "Thai")
                    self.assertEqual(payload["target_language"], "English")
                    self.assertEqual(options["response_format"], {"type": "json_object"})

    def test_bilingual_reply_cards_keep_draft_and_outgoing_languages_separate(self):
        replies = [
            {"style": "friendly", "text": "Okay, thanks!", "translation": "โอเค ขอบคุณนะ"},
            {
                "style": "professional",
                "text": "Noted, thank you.",
                "translation": "รับทราบ ขอบคุณครับ",
            },
            {"style": "short", "text": "Got it.", "translation": "เข้าใจแล้ว"},
        ]
        with patch.object(server, "get_client") as client:
            client.return_value.chat.completions.create.return_value = completion(
                json.dumps({"replies": list(reversed(replies))})
            )
            response = self.client.post("/api/assist", json={**self.context, "action": "replies"})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.get_json()["replies"], [item["text"] for item in replies])
            self.assertEqual(response.get_json()["reply_details"], replies)
            prompt = client.return_value.chat.completions.create.call_args.kwargs["messages"][0][
                "content"
            ]
            self.assertIn("TARGET", prompt)
            self.assertIn("SOURCE", prompt)

    def test_invalid_bilingual_replies_are_rejected(self):
        good = [
            {"style": "friendly", "text": "Thanks!", "translation": "ขอบคุณนะ"},
            {"style": "professional", "text": "Thank you.", "translation": "ขอบคุณครับ"},
            {"style": "short", "text": "Okay.", "translation": "โอเค"},
        ]
        bad = [
            good[:2],
            [good[0], good[0], good[2]],
            [good[0], good[1], {**good[2], "translation": ""}],
            [good[0], good[1], {**good[2], "text": ["invalid"]}],
            [good[0], good[1], {**good[2], "style": "unexpected"}],
            [good[0], good[1], {**good[2], "translation": "a" * 2001}],
            [good[0], good[1], {**good[2], "text": good[0]["text"]}],
        ]
        with patch.object(server, "get_client") as client:
            for replies in bad:
                with self.subTest(replies=replies):
                    client.return_value.chat.completions.create.return_value = completion(
                        json.dumps({"replies": replies})
                    )
                    response = self.client.post(
                        "/api/assist", json={**self.context, "action": "replies"}
                    )
                    self.assertEqual(response.status_code, 503)

    def test_bad_inputs_do_not_call_model(self):
        with patch.object(server, "get_client") as client:
            for overrides in [
                {"action": []},
                {"action": "invalid"},
                {"action": "check", "translation": ""},
                {"action": "replies", "translation": []},
                {"action": "source_info", "text": "a" * 1501},
                {"action": "explain", "interface_language": []},
            ]:
                response = self.client.post("/api/assist", json={**self.context, **overrides})
                self.assertEqual(response.status_code, 400)
                self.assertIn("error", response.get_json())
            client.assert_not_called()

    def test_invalid_or_truncated_ai_output_is_not_presented_as_success(self):
        with patch.object(server, "get_client") as client:
            bad_results = [
                ("source_info", '{"pronunciation":"Hello","alternatives":["same","same"]}'),
                ("explain", "[]"),
                ("check", '{"assessment":"good","notes":"ok"}'),
                ("check", '{"assessment":"needs_revision","notes":"bad","revision":""}'),
                ("replies", '{"replies":["one"]}'),
                ("explain", "not json"),
            ]
            for action, result in bad_results:
                with self.subTest(action=action, result=result):
                    client.return_value.chat.completions.create.return_value = completion(result)
                    response = self.client.post(
                        "/api/assist", json={**self.context, "action": action}
                    )
                    self.assertEqual(response.status_code, 503)
                    self.assertIn("error", response.get_json())
            client.return_value.chat.completions.create.return_value = completion(
                '{"explanation":"partial"}', "length"
            )
            response = self.client.post("/api/assist", json={**self.context, "action": "explain"})
            self.assertEqual(response.status_code, 503)

    def test_auto_detected_language_is_returned_for_reply_direction(self):
        with patch.object(server, "get_client") as client:
            client.return_value.chat.completions.create.return_value = completion("Hello")
            response = self.client.post(
                "/api/translate", json={"text": "สวัสดีครับ", "source": "auto", "target": "en"}
            )
            self.assertEqual(response.get_json()["source_language"], "th")
            client.return_value.chat.completions.create.return_value = completion(
                '{"replies":["Hello!","How are you?","Good morning."]}'
            )
            response = self.client.post(
                "/api/assist", json={**self.context, "source": "auto", "action": "replies"}
            )
            self.assertEqual(response.get_json()["source_language"], "th")


if __name__ == "__main__":
    unittest.main()
