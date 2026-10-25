import unittest
from unittest.mock import patch

from test_app import completion

import app as server
from translation_quality import audit_translation


class NumberWordAuditTests(unittest.TestCase):
    def test_equivalent_spelled_number_does_not_start_an_unnecessary_repair(self):
        with patch.object(server, "get_client") as provider:
            create = provider.return_value.chat.completions.create
            create.return_value = completion("I'm in two fandoms.")
            self.assertEqual(
                server.translate_text("ฉันอยู่ 2 ด้อม", "th", "en", "natural"), "I'm in two fandoms."
            )
            create.assert_called_once()

    def flags(self, source, translation):
        return [
            issue
            for issue in audit_translation(source, translation, "en", [])["issues"]
            if issue["kind"] == "numbers"
        ]

    def test_small_cardinals_can_change_between_digits_and_words(self):
        for source, target in [
            ("อยู่ 2 ด้อม", "I'm in two fandoms."),
            ("Two people", "2 คน"),
            ("0 failures", "zero failures"),
            ("20 people", "twenty people"),
        ]:
            self.assertEqual(self.flags(source, target), [])

    def test_word_matching_preserves_duplicate_counts_and_actual_changes(self):
        self.assertTrue(self.flags("2 groups and 2 people", "two groups"))
        self.assertTrue(self.flags("2 groups", "three groups"))
        self.assertTrue(self.flags("2 groups", "one or two groups"))
        self.assertTrue(self.flags("2 groups", "two groups and two people"))
        self.assertEqual(self.flags("2 groups and 2 people", "two groups and two people"), [])

    def test_small_word_is_not_taken_from_a_larger_signed_or_fractional_number(self):
        for target in (
            "twenty two",
            "twenty-two",
            "twenty‑two",
            "two hundred",
            "two thousand",
            "minus two",
            "negative two",
            "two point five",
        ):
            with self.subTest(target=target):
                self.assertTrue(self.flags("2", target))

    def test_ordinary_words_do_not_add_flags_or_hide_changed_dates_and_amounts(self):
        self.assertEqual(self.flags("คนที่ชอบ", "the one I like"), [])
        self.assertTrue(self.flags("50 baht", "5 baht"))
        self.assertTrue(self.flags("2/3", "two thirds"))
        self.assertTrue(self.flags("2%", "two"))


if __name__ == "__main__":
    unittest.main()
