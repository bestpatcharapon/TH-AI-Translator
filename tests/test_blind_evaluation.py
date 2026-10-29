import contextlib
import csv
import io
import json
import tempfile
import unittest
from pathlib import Path

from scripts.blind_evaluation import cohen_kappa, main, prepare, score

RESULTS = {
    "results": [
        {
            "id": f"case-{index}",
            "source": "th",
            "target": "en" if index % 2 else "zh",
            "text": f"ข้อความ {index}",
            "check": f"criteria {index}",
            "app": {"translation": f"APP-OUTPUT-{index}", "model": "secret-model"},
            "google": {"translation": f"GOOGLE-OUTPUT-{index}", "url": "https://translate"},
        }
        for index in range(12)
    ]
    + [{"id": "missing", "source": "th", "target": "en", "text": "x", "app": {"error": "x"}}]
}


class BlindEvaluationTest(unittest.TestCase):
    def setUp(self):
        self.directory = Path(tempfile.mkdtemp())
        self.results = self.directory / "results.json"
        self.results.write_text(json.dumps(RESULTS, ensure_ascii=False), encoding="utf-8")

    def read_sheet(self, folder):
        raw = (folder / "sheet.csv").read_bytes()
        self.assertTrue(raw.startswith(b"\xef\xbb\xbf"))
        with (folder / "sheet.csv").open(encoding="utf-8-sig", newline="") as handle:
            return list(csv.DictReader(handle)), raw.decode("utf-8-sig")

    def test_prepare_is_deterministic_with_seed(self):
        prepare(self.results, self.directory / "one", seed=7)
        prepare(self.results, self.directory / "two", seed=7)
        for name in ("sheet.csv", "key.json"):
            self.assertEqual(
                (self.directory / "one" / name).read_bytes(),
                (self.directory / "two" / name).read_bytes(),
            )

    def test_sheet_does_not_reveal_systems_and_key_is_consistent(self):
        info = prepare(self.results, self.directory / "out", seed=3)
        self.assertEqual(info["skipped"], ["missing"])
        rows, text = self.read_sheet(self.directory / "out")
        self.assertEqual(len(rows), 12)
        visible = text.lower().replace("app-output", "").replace("google-output", "")
        for leak in ("app", "google", "secret-model", "https://"):
            self.assertNotIn(leak, visible)
        key = json.loads((self.directory / "out" / "key.json").read_text(encoding="utf-8"))["key"]
        for row in rows:
            system = key[row["id"]]["A"]
            self.assertTrue(row["translation_A"].startswith(system.upper()))
            self.assertEqual(row["winner"], "")
        # Both assignments should occur across a dozen rows.
        self.assertEqual({entry["A"] for entry in key.values()}, {"app", "google"})

    def test_refuses_overwrite(self):
        out = self.directory / "out"
        prepare(self.results, out, seed=1)
        with self.assertRaises(FileExistsError):
            prepare(self.results, out, seed=1)
        with self.assertRaises(SystemExit), contextlib.redirect_stderr(io.StringIO()):
            main(["prepare", "--results", str(self.results), "--out-dir", str(out)])
        prepare(self.results, out, seed=2, overwrite=True)

    def write_ratings(self, path, rows, choose):
        with path.open("w", encoding="utf-8-sig", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            for row in rows:
                writer.writerow({**row, **choose(row)})

    def test_score_unblinds_correctly(self):
        out = self.directory / "out"
        prepare(self.results, out, seed=5)
        rows, _ = self.read_sheet(out)

        def prefers_app(row):
            if row["id"] == "case-0":
                return {"winner": ""}
            if row["id"] == "case-1":
                return {"winner": "tie", "meaning_error_A": "n", "meaning_error_B": "n"}
            letter = "A" if row["translation_A"].startswith("APP") else "B"
            other = "B" if letter == "A" else "A"
            return {
                "winner": letter,
                f"meaning_error_{letter}": "n",
                f"meaning_error_{other}": "y",
            }

        first, second = self.directory / "r1.csv", self.directory / "r2.csv"
        self.write_ratings(first, rows, prefers_app)
        self.write_ratings(second, rows, lambda row: {"winner": "both_wrong"})
        report = score(out / "key.json", [first, second])
        rater = report["per_rater"]["r1"]
        self.assertEqual((rater["app_wins"], rater["google_wins"], rater["ties"]), (10, 0, 1))
        self.assertEqual(rater["blank_rows"], 1)
        self.assertEqual(rater["meaning_error_rate"]["google"]["errors"], 10)
        self.assertEqual(rater["meaning_error_rate"]["app"]["errors"], 0)
        self.assertEqual(rater["meaning_error_rate"]["google"]["marked"], 11)
        self.assertEqual(sum(p["rated"] for p in rater["by_language_pair"].values()), 11)
        self.assertEqual(report["pooled"]["rated"], 23)
        self.assertEqual(report["pooled"]["both_wrong"], 12)
        self.assertEqual(report["agreement"][0]["shared_items"], 11)
        self.assertEqual(report["agreement"][0]["same_winner"], 0)
        self.assertIn("raters", report["caveat"])

    def test_cohen_kappa_known_example(self):
        # Observed agreement 0.7; expected 0.5*0.6 + 0.5*0.4 = 0.5 -> kappa 0.4.
        first = ["A"] * 5 + ["B"] * 5
        second = ["A"] * 4 + ["B"] + ["A"] * 2 + ["B"] * 3
        kappa = cohen_kappa(first, second)
        assert kappa is not None
        self.assertAlmostEqual(kappa, 0.4)
        self.assertEqual(cohen_kappa(["A", "B"], ["A", "B"]), 1.0)
        self.assertIsNone(cohen_kappa([], []))
        self.assertIsNone(cohen_kappa(["tie", "tie"], ["tie", "tie"]))

    def test_constant_agreement_reports_undefined_kappa_in_json(self):
        out = self.directory / "out"
        prepare(self.results, out, seed=5)
        rows, _ = self.read_sheet(out)
        first, second = self.directory / "r1.csv", self.directory / "r2.csv"
        for path in (first, second):
            self.write_ratings(path, rows, lambda row: {"winner": "tie"})

        report = json.loads(json.dumps(score(out / "key.json", [first, second])))
        pair = report["agreement"][0]
        self.assertEqual(pair["shared_items"], 12)
        self.assertEqual(pair["same_winner"], 12)
        self.assertEqual(pair["percent_agreement"], 100.0)
        self.assertIsNone(pair["cohen_kappa"])


if __name__ == "__main__":
    unittest.main()
