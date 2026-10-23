import json
import unittest
from unittest.mock import patch

from test_app import completion

import app as server
from thai_interpretation import relevant_entries, validate_lexicon


def ready():
    return {
        "status": "ready",
        "standard_thai": "แกงนี้อร่อยมาก",
        "translation": "This curry is delicious.",
        "note": "ความหมายตามบริบทอาหาร",
        "questions": [],
        "possibilities": [],
        "evidence": [{"quote": "ลำแต้ๆ", "meaning": "อร่อยมาก"}],
    }


def uncertain():
    return {
        "status": "needs_context",
        "standard_thai": "",
        "translation": "",
        "note": "คำนี้ต้องการบริบทเพิ่ม",
        "questions": ["ในที่นี้ผู้พูดหมายความว่าอะไร?"],
        "possibilities": [],
        "evidence": [],
    }


class ThaiInterpretationTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()
        self.body = {
            "text": "แกงนี้ลำแต้ๆ",
            "source": "th",
            "target": "en",
            "thai_mode": "northern",
            "interface_language": "th",
        }

    def test_bad_inputs_are_rejected_before_calling_provider(self):
        cases = [
            {"thai_mode": []},
            {"thai_mode": "wrong"},
            {"thai_lexicon": None},
            {"thai_clarification": []},
            {"thai_clarification": "x" * 1001},
            {"text": "ก" * 3001},
            {"source": "en"},
            {"interface_language": {}},
        ]
        with patch.object(server, "get_client") as provider:
            for case in cases:
                with self.subTest(case=str(case)[:70]):
                    response = self.client.post("/api/translate", json={**self.body, **case})
                    self.assertEqual(response.status_code, 400)
            provider.assert_not_called()

    def test_known_dialect_returns_central_thai_and_target_translation(self):
        with patch.object(server, "get_client") as provider:
            provider.return_value.chat.completions.create.return_value = completion(
                json.dumps(ready())
            )
            response = self.client.post("/api/translate", json=self.body)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json["translation"], "This curry is delicious.")
            interpretation = response.json["interpretation"]
            self.assertEqual(interpretation["standard_thai"], "แกงนี้อร่อยมาก")
            self.assertEqual(interpretation["matched_entries"][0]["origin"], "starter")
            payload = json.loads(
                provider.return_value.chat.completions.create.call_args.kwargs["messages"][1][
                    "content"
                ]
            )
            self.assertEqual(payload["target_language"], "English")

    def test_uncertainty_never_becomes_a_translation_or_additional_language(self):
        with (
            patch.object(server, "get_client") as provider,
            patch.object(server, "additional_translations") as extra,
        ):
            provider.return_value.chat.completions.create.return_value = completion(
                json.dumps(uncertain())
            )
            response = self.client.post(
                "/api/translate",
                json={**self.body, "text": "คำที่เพิ่งสร้าง", "additional_targets": ["ja"]},
            )
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json["translation"], "")
            self.assertEqual(response.json["interpretation"]["status"], "needs_context")
            self.assertNotIn("audit", response.json)
            extra.assert_not_called()

    def test_personal_definitions_are_scoped_and_override_starter_entries(self):
        custom = validate_lexicon(
            [
                {
                    "term": "ลำแต้ๆ",
                    "meaning": "ความหมายเฉพาะกลุ่ม",
                    "dialect": "northern",
                    "example": "หยอกเพื่อน",
                }
            ]
        )
        matched = relevant_entries(self.body["text"], "northern", custom)
        self.assertEqual(len(matched), 1)
        self.assertEqual(matched[0]["origin"], "personal")
        self.assertEqual(relevant_entries(self.body["text"], "southern", custom), [])
        self.assertEqual(relevant_entries("ไม่ใช่คำนี้", "auto", custom), [])
        with patch.object(server, "get_client") as provider:
            provider.return_value.chat.completions.create.return_value = completion(
                json.dumps(ready())
            )
            response = self.client.post(
                "/api/translate",
                json={
                    **self.body,
                    "thai_lexicon": custom,
                    "thai_clarification": "กำลังชมอาหาร",
                    "extra_context": "คุยกับเจ้าของร้าน",
                },
            )
            self.assertEqual(response.status_code, 200)
            payload = json.loads(
                provider.return_value.chat.completions.create.call_args.kwargs["messages"][1][
                    "content"
                ]
            )
            self.assertEqual(payload["user_clarification"], "กำลังชมอาหาร")
            self.assertEqual(
                payload["personal_and_starter_definitions"][0]["meaning"], "ความหมายเฉพาะกลุ่ม"
            )

    def test_thai_target_returns_central_thai_instead_of_echoing_source(self):
        with patch.object(server, "get_client") as provider:
            provider.return_value.chat.completions.create.return_value = completion(
                json.dumps(ready())
            )
            response = self.client.post("/api/translate", json={**self.body, "target": "th"})
            self.assertEqual(response.json["translation"], "แกงนี้อร่อยมาก")

    def test_invented_evidence_and_inconsistent_model_results_are_rejected(self):
        invented = ready()
        invented["evidence"][0]["quote"] = "ไม่มีในต้นฉบับ"
        guess = uncertain()
        guess["translation"] = "A confident guess"
        no_question = uncertain()
        no_question["questions"] = []
        question_and_ready = ready()
        question_and_ready["questions"] = ["Which meaning?"]
        with patch.object(server, "get_client") as provider:
            for result in [
                invented,
                guess,
                no_question,
                question_and_ready,
                [],
                {"status": "100%"},
            ]:
                provider.return_value.chat.completions.create.return_value = completion(
                    json.dumps(result)
                )
                response = self.client.post("/api/translate", json=self.body)
                self.assertEqual(response.status_code, 503)

    def test_personal_dictionary_validation_needs_no_ai_and_returns_no_stored_history(self):
        good = {"term": "คำใหม่", "meaning": "ความหมายที่ผู้ใช้บอก", "dialect": "slang", "example": ""}
        with patch.object(server, "get_client") as provider:
            response = self.client.post("/api/thai-lexicon/validate", json={"entries": [good]})
            self.assertEqual(response.json["entries"], [good])
            empty = self.client.post("/api/thai-lexicon/validate", json={"entries": []})
            self.assertEqual(empty.json["entries"], [])
            for value in [
                None,
                [good] * 31,
                [good, good],
                [{**good, "dialect": "standard"}],
                [{**good, "term": ""}],
                [{**good, "meaning": "x" * 501}],
            ]:
                self.assertEqual(
                    self.client.post(
                        "/api/thai-lexicon/validate", json={"entries": value}
                    ).status_code,
                    400,
                )
            provider.assert_not_called()

    def test_additional_languages_receive_resolved_meaning(self):
        with (
            patch.object(server, "get_client") as provider,
            patch.object(server, "additional_translations", return_value=[]) as extra,
        ):
            provider.return_value.chat.completions.create.return_value = completion(
                json.dumps(ready())
            )
            self.client.post("/api/translate", json={**self.body, "additional_targets": ["ja"]})
            self.assertIn("แกงนี้อร่อยมาก", extra.call_args.args[5])

    def test_fatigue_is_not_silently_translated_into_pain(self):
        with patch.object(server, "get_client") as provider:
            response = self.client.post(
                "/api/translate", json={**self.body, "text": "มื้อนี้เมื่อยหลาย", "thai_mode": "isan"}
            )
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json["translation"], "")
            self.assertEqual(response.json["interpretation"]["status"], "needs_context")
            self.assertEqual(len(response.json["interpretation"]["possibilities"]), 2)
            provider.return_value.chat.completions.create.assert_not_called()
            result = ready()
            result["evidence"] = []
            result["standard_thai"] = "วันนี้เหนื่อยมาก"
            result["translation"] = "I'm very tired today."
            provider.return_value.chat.completions.create.return_value = completion(
                json.dumps(result)
            )
            confirmed = self.client.post(
                "/api/translate",
                json={
                    **self.body,
                    "text": "มื้อนี้เมื่อยหลาย",
                    "thai_mode": "isan",
                    "thai_clarification": "เหนื่อยล้า ไม่ได้ปวด",
                },
            )
            self.assertEqual(confirmed.json["translation"], "I'm very tired today.")


if __name__ == "__main__":
    unittest.main()
