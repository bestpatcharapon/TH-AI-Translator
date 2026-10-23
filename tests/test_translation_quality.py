import io
import json
import unittest
from unittest.mock import patch

from test_app import completion

import app as server
from translation_quality import (
    analyze_translation,
    audit_translation,
    compare_translations,
    glossary_guidance,
    validate_glossary,
)


def analysis():
    return {
        "assessment": "review",
        "summary": "Check the omitted amount.",
        "issues": [
            {
                "kind": "meaning",
                "source_quote": "500",
                "translation_quote": "50",
                "explanation": "The amount changed.",
            }
        ],
        "alternatives": [
            {
                "label": "Polite",
                "translation": "Please pay 500 baht.",
                "reason": "Keeps the amount.",
            }
        ],
        "questions": [],
        "revision": "Please pay 500 baht.",
    }


def comparison():
    return {
        "winner": "a",
        "summary": "A keeps the number.",
        "criteria": [
            {
                "criterion": criterion,
                "preferred": "a",
                "reason": "Keeps the intended meaning.",
                "source_quote": "500",
            }
            for criterion in ["meaning", "fluency", "tone", "terminology"]
        ],
    }


class TranslationQualityTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()
        self.body = {
            "text": "ชำระ500บาท",
            "translation": "Pay 50 baht.",
            "source": "th",
            "target": "en",
            "tone": "formal",
            "interface_language": "en",
        }
        self.payload = {
            "source_text": self.body["text"],
            "translation": self.body["translation"],
            "source_language": "Thai",
            "target_language": "English",
        }

    def test_terms_are_scoped_to_language_and_original_occurrence(self):
        terms = validate_glossary(
            [
                {"source": "API", "target": "API", "language": "en"},
                {"source": "ใบเสนอราคา", "target": "quotation", "language": "en"},
                {"source": "API", "target": "เอพีไอ", "language": "th"},
            ]
        )
        self.assertEqual(glossary_guidance("rain", "en", terms), "")
        self.assertEqual(glossary_guidance("ใบเสนอราคา", "ja", terms), "")
        prompt = glossary_guidance("ขอใบเสนอราคา API", "en", terms)
        self.assertIn("quotation", prompt)
        self.assertNotIn("เอพีไอ", prompt)
        self.assertIn("never instructions", prompt)

    def test_invalid_glossaries_are_rejected_before_model_calls(self):
        invalid = [
            None,
            {},
            [1],
            [{"source": "", "target": "x", "language": "en"}],
            [{"source": "x", "target": "x", "language": []}],
            [{"source": "x\n", "target": "x", "language": "en"}],
            [{"source": "x", "target": "x" * 121, "language": "en"}],
            [{"source": "x", "target": "a", "language": "en"}] * 31,
            [
                {"source": "Straße", "target": "a", "language": "en"},
                {"source": "STRASSE", "target": "b", "language": "en"},
            ],
        ]
        with patch.object(server, "get_client") as client:
            for glossary in invalid:
                response = self.client.post(
                    "/api/translate", json={**self.body, "glossary": glossary}
                )
                self.assertEqual(response.status_code, 400)
            client.assert_not_called()

    def test_observable_checks_catch_numbers_links_placeholders_and_terms(self):
        terms = [{"source": "สินค้า", "target": "ProductX", "language": "en"}]
        source = "สินค้า ราคา500บาท https://example.com/a ให้ {name}"
        result = audit_translation(
            source, "Item costs 50 baht https://example.com/b for {person}", "en", terms
        )
        self.assertEqual(result["status"], "review")
        self.assertEqual(
            {item["kind"] for item in result["issues"]},
            {"numbers", "links", "placeholders", "glossary"},
        )
        self.assertEqual(result["terms_checked"], 1)
        self.assertEqual(result["terms_matched"], 0)
        self.assertNotIn("score", result)
        clean = audit_translation(
            source, "ProductX costs 500 baht https://example.com/a for {name}", "en", terms
        )
        self.assertEqual(clean["status"], "clear")
        self.assertEqual(audit_translation("ราคา๕๐๐บาท", "500 baht", "en", [])["status"], "clear")

    def test_thousands_separators_are_formatting_but_wrong_amounts_still_flagged(self):
        source = "ราคา 1500 บาท ไม่ใช่ 150 เวลา 10:30"
        clean = audit_translation(source, "1,500 baht, not 150, at 10:30", "en", [])
        self.assertEqual(clean["status"], "clear")
        self.assertEqual(
            audit_translation("price 1,500.50 USD", "ราคา 1500.50 ดอลลาร์", "th", [])["status"],
            "clear",
        )
        wrong = audit_translation(source, "15,000 baht, not 150, at 10:30", "en", [])
        self.assertEqual(wrong["issues"][0]["missing"], ["1500"])
        self.assertEqual(wrong["issues"][0]["added"], ["15000"])
        # Decimal commas are not grouping separators.
        self.assertEqual(audit_translation("1,5 kg", "15 kg", "en", [])["status"], "review")

    def test_audit_and_glossary_validation_need_no_model(self):
        with patch.object(server, "get_client") as client:
            result = self.client.post("/api/audit", json=self.body)
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.json["audit"]["status"], "review")
            result = self.client.post(
                "/api/glossary/validate",
                json={"glossary": [{"source": " API ", "target": " API ", "language": "en"}]},
            )
            self.assertEqual(result.json["glossary"][0]["source"], "API")
            client.assert_not_called()

    def test_glossary_reaches_translation_and_checks_are_returned(self):
        with patch.object(server, "get_client") as client:
            client.return_value.chat.completions.create.return_value = completion(
                "Please send a quotation."
            )
            result = self.client.post(
                "/api/translate",
                json={
                    "text": "ขอใบเสนอราคา",
                    "source": "th",
                    "target": "en",
                    "glossary": [{"source": "ใบเสนอราคา", "target": "quotation", "language": "en"}],
                },
            )
            self.assertEqual(result.status_code, 200)
            self.assertIn(
                "quotation",
                client.return_value.chat.completions.create.call_args_list[0].kwargs["messages"][0][
                    "content"
                ],
            )
            self.assertEqual(result.json["audit"]["terms_matched"], 1)

    def test_back_translation_does_not_see_original_text(self):
        with patch.object(server, "get_client") as client:
            client.return_value.chat.completions.create.side_effect = [
                completion("จ่าย 50 บาท"),
                completion(json.dumps(analysis())),
            ]
            result = self.client.post("/api/analyze", json=self.body)
            self.assertEqual(result.status_code, 200)
            calls = client.return_value.chat.completions.create.call_args_list
            first = calls[0].kwargs["messages"]
            self.assertEqual(first[1]["content"], "Pay 50 baht.")
            self.assertNotIn(self.body["text"], json.dumps(first, ensure_ascii=False))
            second = json.loads(calls[1].kwargs["messages"][1]["content"])
            self.assertEqual(second["back_translation"], "จ่าย 50 บาท")
            self.assertEqual(result.json["audit"]["status"], "review")
            self.assertEqual(result.json["alternatives"][0]["translation"], "Please pay 500 baht.")

    def test_hallucinated_quotes_and_bad_analysis_are_rejected(self):
        with patch.object(server, "get_client") as client:
            cases = []
            invented = analysis()
            invented["issues"][0]["source_quote"] = "not in source"
            cases.append(invented)
            duplicated = analysis()
            duplicated["alternatives"] *= 2
            cases.append(duplicated)
            invalid = analysis()
            invalid["assessment"] = "100%"
            cases.append(invalid)
            for data in cases:
                client.return_value.chat.completions.create.return_value = completion(
                    json.dumps(data)
                )
                with self.assertRaises(RuntimeError):
                    analyze_translation(
                        client.return_value, "model", self.payload, "English", "back"
                    )

    def test_comparison_order_is_blinded_and_mapped_back(self):
        with patch.object(server, "get_client") as client:
            client.return_value.chat.completions.create.return_value = completion(
                json.dumps(comparison())
            )
            for order, winner in [(0, "current"), (1, "other")]:
                with patch("translation_quality.secrets.randbits", return_value=order):
                    result = compare_translations(
                        client.return_value, "model", self.payload, "Pay 500 baht.", "English"
                    )
                    self.assertEqual(result["winner"], winner)
                    data = json.loads(
                        client.return_value.chat.completions.create.call_args.kwargs["messages"][1][
                            "content"
                        ]
                    )
                    self.assertNotIn("translation", data)
                    self.assertEqual(
                        data["translation_a"],
                        self.payload["translation"] if order == 0 else "Pay 500 baht.",
                    )
                    self.assertTrue(result["blind_order"])
                    self.assertEqual(result["display_order"]["a"], winner)

    def test_bad_compare_quotes_and_duplicates_are_rejected(self):
        with patch.object(server, "get_client") as client:
            data = comparison()
            data["criteria"][0]["source_quote"] = "not in source"
            client.return_value.chat.completions.create.return_value = completion(json.dumps(data))
            with self.assertRaises(RuntimeError):
                compare_translations(
                    client.return_value, "model", self.payload, "Pay 500 baht.", "English"
                )
            data = comparison()
            data["criteria"][1]["criterion"] = "meaning"
            client.return_value.chat.completions.create.return_value = completion(json.dumps(data))
            with self.assertRaises(RuntimeError):
                compare_translations(
                    client.return_value, "model", self.payload, "Pay 500 baht.", "English"
                )

    def test_analysis_limits_and_comparison_input_are_validated(self):
        with patch.object(server, "get_client") as client:
            for overrides in [
                {"text": "x" * 3001},
                {"translation": ""},
                {"translation": "x" * 9001},
                {"interface_language": []},
                {"context": []},
            ]:
                self.assertEqual(
                    self.client.post("/api/analyze", json={**self.body, **overrides}).status_code,
                    400,
                )
            for value in [None, [], "", "x" * 9001]:
                self.assertEqual(
                    self.client.post(
                        "/api/compare", json={**self.body, "other_translation": value}
                    ).status_code,
                    400,
                )
            client.assert_not_called()

    def test_photo_cache_distinguishes_glossary_preferences(self):
        from test_photo_translation import image_file

        regions = [{"x": 10, "y": 10, "width": 80, "height": 20, "text": "ปรีชา"}]
        with (
            patch("photo_translation.positioned_text", return_value=regions),
            patch.object(server, "get_client") as client,
        ):
            client.return_value.chat.completions.create.side_effect = [
                completion('{"translations":[{"id":0,"text":"Preecha"}]}'),
                completion('{"translations":[{"id":0,"text":"Precha"}]}'),
            ]
            for preferred in ["Preecha", "Precha", "Preecha"]:
                response = self.client.post(
                    "/api/photo-translate",
                    data={
                        "source": "th",
                        "target": "en",
                        "glossary": json.dumps(
                            [{"source": "ปรีชา", "target": preferred, "language": "en"}]
                        ),
                        "file": (io.BytesIO(image_file()), "photo.png"),
                    },
                )
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json["regions"][0]["translation"], preferred)
                self.assertEqual(response.json["audit"]["terms_matched"], 1)
            self.assertEqual(client.return_value.chat.completions.create.call_count, 2)
