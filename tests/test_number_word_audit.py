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

    def test_word_only_quantities_detect_small_cardinal_changes(self):
        for source, target, missing, added in (
            ("two groups", "three groups", ["2"], ["3"]),
            ("one ticket", "two tickets", ["1"], ["2"]),
            ("ZERO failures", "one failure", ["0"], ["1"]),
            ("twenty people", "nineteen people", ["20"], ["19"]),
            ("two groups and two people", "two groups", ["2"], []),
            ("two books", "two books and three chairs", [], ["3"]),
        ):
            with self.subTest(source=source, target=target):
                self.assertEqual(
                    self.flags(source, target),
                    [{"kind": "numbers", "missing": missing, "added": added}],
                )

    def test_medication_count_changes_are_flagged(self):
        for unit in ("tablet", "pill", "capsule", "dose"):
            source, target = f"Take one {unit}", f"Take two {unit}s"
            for original, output, missing, added in (
                (source, target, ["1"], ["2"]),
                (target, source, ["2"], ["1"]),
            ):
                with self.subTest(source=original, target=output):
                    self.assertEqual(
                        self.flags(original, output),
                        [{"kind": "numbers", "missing": missing, "added": added}],
                    )

    def test_medication_counts_do_not_flag_unchanged_negation_or_decimal_phrases(self):
        for source, target in (
            ("Do not take one tablet", "Do not take one tablet."),
            ("Take not one but two pills", "Take two pills, not one"),
            ("Take one point five tablets", "Take one point five tablets."),
            ("Take 1,5 tablets", "Take 1.5 tablets"),
            ("Take 0.5 tablets", "Take 0.5 tablets."),
            # Complex signed/decimal phrases must not contribute a partial one.
            ("negative one capsule", "two capsules"),
            ("one point five doses", "two doses"),
        ):
            with self.subTest(source=source, target=target):
                self.assertEqual(self.flags(source, target), [])

    def test_medication_numeric_amount_changes_remain_flagged(self):
        for source, target in (
            ("Take 0.5 tablets", "Take 05 tablets"),
            ("Take -1 tablet", "Take 1 tablet"),
            ("Take 1,5 tablets", "Take 15 tablets"),
            ("Do not take one tablet", "Do not take two tablets"),
        ):
            with self.subTest(source=source, target=target):
                self.assertTrue(self.flags(source, target))

    def test_word_only_quantities_do_not_treat_pronoun_one_as_a_number(self):
        for source, target in (
            ("the one I like", "the person I like"),
            ("the one I like", "two people"),
            ("two people", "the one I like"),
            ("one of my friends", "two people"),
            ("two groups and the one I like", "two groups"),
            ("two groups", "two groups and the one I like"),
            ("one ticket", "one ticket"),
            ("Two people", "two persons"),
            # Deliberate limits: no general noun inference or complex parser.
            ("two widgets", "three widgets"),
            ("two", "three"),
            ("twenty-two people", "two people"),
        ):
            with self.subTest(source=source, target=target):
                self.assertEqual(self.flags(source, target), [])

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
