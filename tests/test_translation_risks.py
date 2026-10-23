import json
import unittest
from unittest.mock import MagicMock

from test_app import completion

from semantic_review import review_reasons, review_translation
from translation_risks import risk_signals


class TranslationRiskTests(unittest.TestCase):
    def test_multilingual_negation_and_restrictions_request_review(self):
        examples = [
            "予約をキャンセルしないでください。",
            "除了周日，每天营业。",
            "아직 결제하지 않았어요.",
            "Ich komme nur, wenn der Zug pünktlich ist.",
            "Vous ne devez pas payer.",
            "No canceles a menos que te lo pida.",
            "We wouldn’t charge you unless you’d approved it.",
            "โอนได้ก็ต่อเมื่อได้รับสินค้าแล้วเท่านั้น",
            "Either item, but not both.",
        ]
        for text in examples:
            with self.subTest(text=text):
                self.assertTrue(review_reasons(text, "general", [], []))

    def test_prices_roles_time_and_uncertainty_are_detected(self):
        for text in (
            "มัดจำ 500 บาท จากยอดรวม 1,500 บาท เหลือ 1,000 บาท",
            "Move from 14:30 to 15:00.",
            "วันมะรืนส่งได้ แต่ยังยืนยันเวลาไม่ได้",
            "It might be ready tomorrow.",
        ):
            with self.subTest(text=text):
                self.assertTrue(risk_signals(text))
        for text in ("Hello, thank you.", "ขอบคุณสำหรับความช่วยเหลือ", "A bowl costs 50 baht."):
            self.assertEqual(risk_signals(text), [])

    def test_normalization_is_only_for_detection_original_source_reaches_reviewer(self):
        text = "We wouldn’t pay unless you’d approved it."
        draft = "เราจะไม่จ่ายจนกว่าคุณจะอนุมัติ"
        provider = MagicMock()
        provider.chat.completions.create.return_value = completion(
            json.dumps({"decision": "keep", "translation": draft, "issues": [], "question": ""})
        )
        result, status = review_translation(
            provider, "model", text, draft, "en", "th", "natural", "general", "", [], []
        )
        payload = json.loads(
            provider.chat.completions.create.call_args.kwargs["messages"][1]["content"]
        )
        self.assertEqual(payload["source_text"], text)
        self.assertTrue(payload["meaning_checks"])
        self.assertEqual(result, draft)
        self.assertEqual(status["status"], "checked")
