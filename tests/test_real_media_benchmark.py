import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path

from scripts.benchmark_real_media import (
    character_error_rate,
    levenshtein,
    load_manifest,
    main,
    normalize_text,
    summarize,
)


class RealMediaBenchmarkTest(unittest.TestCase):
    def test_levenshtein(self):
        self.assertEqual(levenshtein("kitten", "sitting"), 3)
        self.assertEqual(levenshtein("", "abc"), 3)
        self.assertEqual(levenshtein("ข้าว", "ข้าว"), 0)

    def test_normalization_spaced_and_unspaced_scripts(self):
        self.assertEqual(normalize_text("  Hello,   WORLD! ", "en"), "hello world")
        self.assertEqual(normalize_text("ข้าว ผัด, 50 บาท", "th"), "ข้าวผัด50บาท")
        self.assertEqual(normalize_text("请问 附近？", "zh"), "请问附近")
        # Precomposed and decomposed SARA AM compare equal.
        self.assertEqual(normalize_text("น้\u0e33", "th"), normalize_text("น้\u0e4d\u0e32", "th"))
        # Full-width Latin from CJK input normalizes to ASCII.
        self.assertEqual(normalize_text("ＡＢＣ", "ja"), "abc")

    def test_cer_uses_characters_for_thai_and_ignores_spacing(self):
        self.assertEqual(character_error_rate("ข้าวผัด", "ข้าว ผัด", "th"), 0.0)
        # One substituted character out of seven.
        self.assertAlmostEqual(character_error_rate("ข้าวผัด", "ข้าวผัก", "th"), 1 / 7)
        self.assertAlmostEqual(character_error_rate("abcd", "abxd", "en"), 0.25)
        self.assertEqual(character_error_rate("", "", "th"), 0.0)
        self.assertEqual(character_error_rate("", "noise", "en"), 1.0)
        self.assertGreater(character_error_rate("ab", "abcdef", "en"), 1.0)

    def test_summary_groups_by_kind_and_language(self):
        summary = summarize(
            [
                {"kind": "image", "language": "th", "cer": 0.1},
                {"kind": "image", "language": "th", "cer": 0.3},
                {"kind": "audio", "language": "en", "cer": 0.2},
                {"kind": "audio", "language": "th", "cer": None},
            ]
        )
        self.assertEqual((summary["items"], summary["failed"]), (4, 1))
        self.assertAlmostEqual(summary["mean_cer"], 0.2)
        self.assertAlmostEqual(summary["median_cer"], 0.2)
        self.assertAlmostEqual(summary["by_language"]["image:th"]["mean_cer"], 0.2)
        self.assertEqual(summary["by_kind"]["audio"]["count"], 1)

    def test_manifest_validation_and_live_flag(self):
        folder = Path(tempfile.mkdtemp())
        manifest = folder / "manifest.json"
        manifest.write_text(json.dumps([{"file": "a.jpg", "kind": "video"}]), encoding="utf-8")
        with self.assertRaises(ValueError):
            load_manifest(manifest)
        with self.assertRaises(SystemExit), contextlib.redirect_stderr(io.StringIO()):
            main(["--manifest", str(manifest)])

    def test_example_manifest_is_valid(self):
        root = Path(__file__).resolve().parents[1]
        items = load_manifest(root / "data/real-media/manifest.example.json")
        self.assertTrue({item["kind"] for item in items} == {"image", "audio"})


if __name__ == "__main__":
    unittest.main()
