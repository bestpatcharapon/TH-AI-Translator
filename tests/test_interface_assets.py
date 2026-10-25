"""Offline localization preserves UI limits and only publishes complete files."""

import json
import unittest

from language_catalog import CATALOG
from scripts.prepare_interface_locales import (
    DIRECTORY,
    bad_keys,
    decode_labels,
    preserve_number_format,
    read_locale,
)


class InterfaceAssetTests(unittest.TestCase):
    def test_bare_json_keys_are_repaired_without_executing_code(self):
        self.assertEqual(decode_labels('{\n menu: "Menu"\n}'), {"menu": "Menu"})
        self.assertEqual(decode_labels('{"menu": "Menu"}'), {"menu": "Menu"})
        with self.assertRaises(ValueError):
            decode_labels("{\n menu: process.exit()\n}")

    def test_numeric_formatting_keeps_the_same_values(self):
        original = "Up to 3,000 source characters and 9,000 translated characters."
        for value in ("3 000 / 9 000", "3000 / 9000", "3.000 / 9.000", "٣٠٠٠ / ٩٠٠٠"):
            normalized = preserve_number_format(value, original)
            self.assertEqual(bad_keys({"limit": normalized}, {"limit": original}), [])
        wrong = preserve_number_format("5 000 / 9000", original)
        self.assertEqual(bad_keys({"limit": wrong}, {"limit": original}), ["limit"])

    def test_spelled_out_two_can_be_rendered_as_a_numeral(self):
        source = {"choice": "Choose two languages."}
        self.assertEqual(bad_keys({"choice": "2つの言語を選択してください。"}, source), [])
        self.assertEqual(bad_keys({"choice": "二つの言語を選択してください。"}, source), [])
        self.assertEqual(bad_keys({"choice": "3つの言語"}, source), ["choice"])
        self.assertEqual(
            bad_keys({"choice": "2 languages"}, {"choice": "Choose a language"}), ["choice"]
        )

    def test_placeholders_and_numeric_limits_cannot_disappear(self):
        source = {"result": "{count} translations, max 30"}
        for value in (
            "{total} translations, max 30",
            "{count} translations, max 3",
            "translations, max 30",
        ):
            self.assertEqual(bad_keys({"result": value}, source), ["result"])

    def test_all_published_files_match_source_keys_and_limits(self):
        source = json.loads((DIRECTORY / "en.json").read_text())
        for path in DIRECTORY.glob("*.json"):
            if path.stem == "en":
                continue
            with self.subTest(language=path.stem):
                self.assertIn(path.stem, CATALOG)
                self.assertIsNotNone(read_locale(path.stem, source))


if __name__ == "__main__":
    unittest.main()
