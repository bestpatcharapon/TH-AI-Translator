import json
import os
import unittest
from unittest.mock import MagicMock, patch

from openai import OpenAIError
from test_app import completion

import app as server
from semantic_review import review_translation

TEXT = "ไม่ต้องจ่าย 150 บาท"
DRAFT = "Pay 150 baht."


def decision(**values):
    return {
        "decision": "revise",
        "translation": "You don't have to pay 150 baht.",
        "issues": [
            {
                "kind": "negation",
                "source_quote": "ไม่ต้องจ่าย",
                "draft_quote": "Pay",
                "explanation": "The negation was reversed.",
            }
        ],
        "question": "",
        **values,
    }


def review(client, **values):
    return review_translation(
        client,
        "model",
        values.pop("text", TEXT),
        values.pop("draft", DRAFT),
        "th",
        "en",
        "natural",
        "general",
        "",
        [],
        [],
        **values,
    )


class SemanticReviewTests(unittest.TestCase):
    def setUp(self):
        # This suite mocks the primary provider; never use a developer's real Gemini key.
        provider = patch.dict(os.environ, {"TRANSLATION_REVIEW_PROVIDER": "groq"})
        provider.start()
        self.addCleanup(provider.stop)

    def test_no_risk_and_disabled_checks_do_not_call_provider(self):
        client = MagicMock()
        for kwargs in ({"text": "สวัสดี"}, {"enabled": False}, {"text": "ไม่" * 1600}):
            _, status = review(client, **kwargs)
            self.assertIn(status["status"], {"not_requested", "length_limit"})
        client.chat.completions.create.assert_not_called()

    def test_grounded_negation_correction_is_applied_with_numbers_intact(self):
        client = MagicMock()
        client.chat.completions.create.return_value = completion(json.dumps(decision()))
        text, status = review(client)
        self.assertEqual(text, decision()["translation"])
        self.assertEqual(status["status"], "revised")
        self.assertTrue(status["applied"])

    def test_fabricated_quotes_and_inconsistent_keep_are_not_applied(self):
        for data in (
            decision(issues=[{**decision()["issues"][0], "source_quote": "แพ้ถั่ว"}]),
            decision(decision="keep"),
            decision(translation=DRAFT),
        ):
            client = MagicMock()
            client.chat.completions.create.return_value = completion(json.dumps(data))
            text, status = review(client)
            self.assertEqual(text, DRAFT)
            self.assertEqual(status["status"], "unavailable")

    def test_revision_cannot_introduce_price_link_or_placeholder_drift(self):
        for candidate in (
            "You don't have to pay 50 baht.",
            "You don't have to pay 150 baht. Visit https://fake.test",
            "You don't have to pay 150 baht, {name}.",
        ):
            client = MagicMock()
            client.chat.completions.create.return_value = completion(
                json.dumps(decision(translation=candidate))
            )
            text, status = review(client)
            self.assertEqual(text, DRAFT)
            self.assertEqual(status["status"], "rejected")

    def test_adequate_translation_stays_byte_for_byte_unchanged(self):
        client = MagicMock()
        client.chat.completions.create.return_value = completion(
            json.dumps(decision(decision="keep", translation=DRAFT, issues=[]))
        )
        self.assertEqual(
            review(client),
            (DRAFT, {"status": "checked", "triggers": ["negation_or_exception"], "applied": False}),
        )

    def test_ambiguity_keeps_source_and_requires_explicit_context(self):
        client = MagicMock()
        client.chat.completions.create.return_value = completion(
            json.dumps(
                decision(decision="needs_context", translation=DRAFT, question="Who is paying?")
            )
        )
        text, status = review(client)
        self.assertEqual(text, DRAFT)
        self.assertEqual(status["status"], "needs_context")
        self.assertEqual(status["question"], "Who is paying?")

    def test_failed_review_does_not_claim_checked_or_cache_as_success(self):
        with (
            patch.object(server, "get_client") as provider,
            patch.object(server, "translate_text", return_value=DRAFT),
        ):
            create = provider.return_value.chat.completions.create
            create.side_effect = [OpenAIError("quota"), completion(json.dumps(decision()))]
            body = {"text": TEXT, "source": "th", "target": "en"}
            client = server.app.test_client()
            first = client.post("/api/translate", json=body)
            self.assertEqual(first.json["translation"], DRAFT)
            self.assertEqual(first.json["quality_review"]["status"], "unavailable")
            second = client.post("/api/translate", json=body)
            self.assertEqual(second.json["quality_review"]["status"], "revised")
            self.assertEqual(
                client.post("/api/translate", json=body).headers["X-Result-Cache"], "hit"
            )
            self.assertEqual(create.call_count, 2)

    def test_ambiguous_source_does_not_launch_additional_language_translations(self):
        with (
            patch.object(server, "get_client") as provider,
            patch.object(server, "translate_text", return_value=DRAFT),
            patch.object(server, "extra_results") as extras,
        ):
            provider.return_value.chat.completions.create.return_value = completion(
                json.dumps(
                    decision(decision="needs_context", translation=DRAFT, question="Who is paying?")
                )
            )
            response = server.app.test_client().post(
                "/api/translate",
                json={"text": TEXT, "source": "th", "target": "en", "additional_targets": ["ja"]},
            )
            self.assertEqual(response.json["quality_review"]["status"], "needs_context")
            self.assertEqual(response.json["additional_translations"], [])
            extras.assert_not_called()


class AdditionalReviewTests(unittest.TestCase):
    def test_additional_target_passes_through_the_same_meaning_review(self):
        with (
            patch.object(server, "translate_text", return_value=DRAFT),
            patch.object(
                server, "review_draft", return_value=("Corrected", {"status": "revised"})
            ) as check,
        ):
            result = server.additional_translations(TEXT, "th", ["en"], "natural", "general", "")
            self.assertEqual(result[0]["translation"], "Corrected")
            self.assertEqual(result[0]["quality_review"]["status"], "revised")
            check.assert_called_once()

    def test_unclear_additional_target_has_no_translation_to_save_or_speak(self):
        with (
            patch.object(server, "translate_text", return_value=DRAFT),
            patch.object(
                server,
                "review_draft",
                return_value=(DRAFT, {"status": "needs_context", "question": "Who pays?"}),
            ),
        ):
            result = server.additional_translations(TEXT, "th", ["en"], "natural", "general", "")
            self.assertNotIn("translation", result[0])
            self.assertEqual(result[0]["error"], "Who pays?")


class NeutralRegisterTests(unittest.TestCase):
    def test_meaning_revision_does_not_introduce_gendered_thai_particles(self):
        text = "아직 결제하지 않았어요. 내일 결제할게요."
        draft = "ชำระเงินแล้ว พรุ่งนี้จะชำระเงิน"
        candidate = "ยังไม่ได้ชำระเงินค่ะ พรุ่งนี้จะชำระเงินค่ะ"
        client = MagicMock()
        client.chat.completions.create.return_value = completion(
            json.dumps(
                {
                    "decision": "revise",
                    "translation": candidate,
                    "question": "",
                    "issues": [
                        {
                            "kind": "negation",
                            "source_quote": "아직",
                            "draft_quote": "ชำระเงินแล้ว",
                            "explanation": "Not yet was omitted.",
                        }
                    ],
                }
            )
        )
        result, status = review_translation(
            client, "model", text, draft, "ko", "th", "natural", "general", "", [], []
        )
        self.assertEqual(result, draft)
        self.assertEqual(status["status"], "rejected")
        self.assertEqual(status["reason"], "unsupported_register")

    def test_register_detection_does_not_match_inside_words_or_block_existing_register(self):
        from semantic_review import new_thai_register

        self.assertFalse(new_thai_register("source", "คาดคะเน", "คะเนไว้ก่อน"))
        self.assertFalse(new_thai_register("source", "รอสักครู่ครับ", "กรุณารอครับ"))
        self.assertTrue(new_thai_register("source", "กรุณารอ", "กรุณารอค่ะ"))


class ReviewWhitespaceTests(unittest.TestCase):
    def test_keep_with_whitespace_normalization_preserves_original_bytes(self):
        draft = "ไม่ต้องจ่าย\n150\u202fบาท"
        client = MagicMock()
        client.chat.completions.create.return_value = completion(
            json.dumps(
                {
                    "decision": "keep",
                    "translation": "ไม่ต้องจ่าย 150 บาท",
                    "issues": [],
                    "question": "",
                }
            )
        )
        result, status = review_translation(
            client, "model", TEXT, draft, "th", "en", "natural", "general", "", [], []
        )
        self.assertEqual(result, draft)
        self.assertEqual(status["status"], "checked")

    def test_keep_cannot_change_digits_negation_or_punctuation(self):
        for candidate in ("Pay 15 baht.", "Don't pay 150 baht.", "Pay 150 baht?"):
            client = MagicMock()
            client.chat.completions.create.return_value = completion(
                json.dumps(
                    {"decision": "keep", "translation": candidate, "issues": [], "question": ""}
                )
            )
            result, status = review(client)
            self.assertEqual(result, DRAFT)
            self.assertEqual(status["status"], "unavailable")
