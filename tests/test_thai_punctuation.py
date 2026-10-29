import unittest
from unittest.mock import patch

from test_app import completion

import app as server
from translation_quality import tidy_punctuation


class ThaiPunctuationTest(unittest.TestCase):
    def test_removes_foreign_sentence_final_periods(self):
        cases = {
            "รดน้ำต้นไม้วันเว้นวัน ไม่ใช่วันละสองครั้ง。": "รดน้ำต้นไม้วันเว้นวัน ไม่ใช่วันละสองครั้ง",
            "กำหนดส่งถูกย้ายจากวันศุกร์เป็นวันพุธ.": "กำหนดส่งถูกย้ายจากวันศุกร์เป็นวันพุธ",
            "บรรทัดแรก.\nบรรทัดสอง。": "บรรทัดแรก\nบรรทัดสอง",
            "เขาพูดว่า “ไม่ไป.”": "เขาพูดว่า “ไม่ไป”",
            "ขอบคุณครับ。ไว้เจอกัน": "ขอบคุณครับ ไว้เจอกัน",
        }
        for value, expected in cases.items():
            with self.subTest(value=value):
                self.assertEqual(tidy_punctuation(value, "th"), expected)

    def test_keeps_abbreviations_numbers_and_ellipses(self):
        for value in (
            "นัดเวลา 18:45 น.",
            "ส่งไปที่ กทม. เรียบร้อย",
            "ระยะทาง 5 กม.",
            "ประกาศโดย พ.ศ.",
            "ยอดรวม 1.5",
            "เดี๋ยวก่อน...",
            "อ่านที่ https://example.com/a.",
        ):
            with self.subTest(value=value):
                self.assertEqual(tidy_punctuation(value, "th"), value)

    def test_other_targets_are_untouched(self):
        self.assertEqual(tidy_punctuation("Done.", "en"), "Done.")
        self.assertEqual(tidy_punctuation("好的。", "zh"), "好的。")
        self.assertEqual(tidy_punctuation("ບໍ່ເປັນຫຍັງ.", "lo"), "ບໍ່ເປັນຫຍັງ")

    def test_api_returns_tidied_thai_translation(self):
        with (
            patch.object(server, "get_client") as client,
            patch.object(server, "SEMANTIC_REVIEW_ENABLED", False),
        ):
            client.return_value.chat.completions.create.return_value = completion(
                "เกรงว่าเราจะไม่สามารถมาคืนนี้ได้."
            )
            response = server.app.test_client().post(
                "/api/translate",
                json={
                    "text": "I'm afraid we won't be able to make it tonight.",
                    "source": "en",
                    "target": "th",
                    "tone": "natural",
                    "cache_bypass": True,
                },
            )
        self.assertEqual(response.status_code, 200, response.get_json())
        self.assertEqual(response.get_json()["translation"], "เกรงว่าเราจะไม่สามารถมาคืนนี้ได้")


if __name__ == "__main__":
    unittest.main()
