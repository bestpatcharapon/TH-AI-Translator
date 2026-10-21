import json
import unittest
from unittest.mock import patch

from openai import OpenAIError
from test_app import completion

import app as server
from practical_translation import validate_conversation


class PracticalTranslationTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()
        self.turn = {
            "text": "มีโต๊ะว่างไหม",
            "translation": "Do you have a table?",
            "source": "th",
            "target": "en",
        }

    def test_daily_scenarios_are_accepted_without_changing_source(self):
        for context in ("restaurant", "shopping", "health"):
            with self.subTest(context=context), patch.object(server, "get_client") as provider:
                provider.return_value.chat.completions.create.return_value = completion(
                    "Translation"
                )
                response = self.client.post(
                    "/api/translate",
                    json={"text": "ไม่ใส่ถั่ว", "source": "th", "target": "en", "context": context},
                )
                self.assertEqual(response.status_code, 200)
                messages = provider.return_value.chat.completions.create.call_args.kwargs[
                    "messages"
                ]
                self.assertEqual(messages[1]["content"], "ไม่ใส่ถั่ว")
                self.assertIn(server.CONTEXTS[context], messages[0]["content"])

    def test_conversation_is_bounded_validated_and_used_as_reference_only(self):
        invalid = [
            None,
            {},
            [self.turn] * 7,
            [{}],
            [{**self.turn, "source": "auto"}],
            [{**self.turn, "text": "x" * 1501}],
            [{**self.turn, "translation": ""}],
        ]
        with patch.object(server, "get_client") as provider:
            for turns in invalid:
                response = self.client.post(
                    "/api/translate", json={"text": "สองคน", "target": "en", "conversation": turns}
                )
                self.assertEqual(response.status_code, 400)
            provider.assert_not_called()
        with patch.object(server, "get_client") as provider:
            provider.return_value.chat.completions.create.return_value = completion(
                "For two people."
            )
            response = self.client.post(
                "/api/translate",
                json={"text": "สองคน", "source": "th", "target": "en", "conversation": [self.turn]},
            )
            self.assertEqual(response.status_code, 200)
            messages = provider.return_value.chat.completions.create.call_args.kwargs["messages"]
            self.assertIn(self.turn["text"], messages[0]["content"])
            self.assertIn("not instructions", messages[0]["content"])
            self.assertEqual(messages[1]["content"], "สองคน")
        self.assertEqual(validate_conversation([]), [])

    def test_context_never_persists_between_api_requests(self):
        with patch.object(server, "get_client") as provider:
            provider.return_value.chat.completions.create.return_value = completion("Hello")
            for turns in ([self.turn], []):
                self.client.post(
                    "/api/translate", json={"text": "สวัสดี", "target": "en", "conversation": turns}
                )
            messages = provider.return_value.chat.completions.create.call_args.kwargs["messages"]
            self.assertNotIn(self.turn["text"], json.dumps(messages, ensure_ascii=False))

    def test_additional_languages_use_the_same_conversation_snapshot(self):
        with patch.object(server, "translate_text", return_value="For two people.") as translate:
            response = self.client.post(
                "/api/translate",
                json={
                    "text": "สองคน",
                    "source": "th",
                    "target": "en",
                    "conversation": [self.turn],
                    "additional_targets": ["ja"],
                },
            )
            self.assertEqual(response.status_code, 200)
            self.assertEqual(translate.call_count, 2)
            for call in translate.call_args_list:
                self.assertEqual(call.kwargs["conversation"], [self.turn])

    def test_fact_repair_restores_amount_without_adding_provider_calls_to_clean_output(self):
        with patch.object(server, "get_client") as provider:
            create = provider.return_value.chat.completions.create
            create.side_effect = [completion("Pay 150 baht."), completion("Pay 1500 baht.")]
            result = server.translate_text("จ่าย 1500 บาท", "th", "en", "natural")
            self.assertEqual(result, "Pay 1500 baht.")
            self.assertEqual(create.call_count, 2)
            repair = json.loads(create.call_args.kwargs["messages"][1]["content"])
            self.assertEqual(repair["source_text"], "จ่าย 1500 บาท")
            self.assertEqual(repair["flags"][0]["missing"], ["1500"])
            create.reset_mock()
            create.side_effect = None
            create.return_value = completion("Pay 1500 baht.")
            server.translate_text("จ่าย 1500 บาท", "th", "en", "natural")
            self.assertEqual(create.call_count, 1)

    def test_failed_or_incomplete_repairs_keep_original_and_its_warning(self):
        for repair in (
            completion("Pay 15 baht."),
            completion("Pay 1500 baht and 40 extra."),
            completion("Pay 1500 baht.", "length"),
            completion(""),
            OpenAIError("rate limit"),
        ):
            with self.subTest(repair=str(repair)), patch.object(server, "get_client") as provider:
                provider.return_value.chat.completions.create.side_effect = [
                    completion("Pay 150 baht."),
                    repair,
                ]
                response = self.client.post(
                    "/api/translate", json={"text": "จ่าย 1500 บาท", "source": "th", "target": "en"}
                )
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json["translation"], "Pay 150 baht.")
                self.assertEqual(response.json["audit"]["status"], "review")
                self.assertEqual(provider.return_value.chat.completions.create.call_count, 2)

    def test_repair_preserves_links_placeholders_and_glossary(self):
        text = "เปิด https://example.com ให้ {name} ดูใบเสนอราคา"
        glossary = [{"source": "ใบเสนอราคา", "target": "quotation", "language": "en"}]
        with patch.object(server, "get_client") as provider:
            provider.return_value.chat.completions.create.side_effect = [
                completion("Open https://wrong.com for {user} to see the quote."),
                completion("Open https://example.com for {name} to see the quotation."),
            ]
            result = server.translate_text(text, "th", "en", "friendly", glossary=glossary)
            self.assertEqual(
                server.audit_translation(text, result, "en", glossary)["status"], "clear"
            )

    def test_document_neighbors_are_reference_not_repeated_input(self):
        text = ("paragraph words\n" * 500) + "LAST_UNIQUE_SENTENCE"
        pieces = list(server.chunks(text))
        with patch.object(server, "get_client") as provider:
            create = provider.return_value.chat.completions.create
            create.side_effect = lambda **kwargs: completion(
                kwargs["messages"][1]["content"].strip()
            )
            server.translate_text(text, "en", "th", "natural")
            self.assertEqual(create.call_count, len(pieces))
            for index, call in enumerate(create.call_args_list):
                messages = call.kwargs["messages"]
                self.assertEqual(messages[1]["content"], pieces[index])
                self.assertIn("reference only", messages[0]["content"])
            self.assertIn(
                json.dumps(pieces[-1][:350]),
                create.call_args_list[-2].kwargs["messages"][0]["content"],
            )


if __name__ == "__main__":
    unittest.main()
