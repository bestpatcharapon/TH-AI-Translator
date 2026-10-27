"""Northern first-person ฮา must not acquire an invented laugh interjection."""

import json
import unittest
from unittest.mock import patch

from test_app import completion

import app as server
from dialect_references import introduces_laughter, lexical_references


def reading(central="ฉันจะไปกินข้าวแล้ว", translation="I'm going to eat now."):
    return dict(
        status="ready",
        standard_thai=central,
        translation=translation,
        note="ฮาเป็นสรรพนามของผู้พูดในบริบทภาษาเหนือ",
        questions=[],
        possibilities=[],
        evidence=[{"quote": "ฮา", "meaning": "ฉัน"}],
    )


class NorthernPronounTests(unittest.TestCase):
    def setUp(self):
        env = patch.dict("os.environ", {"TRANSLATION_REVIEW_PROVIDER": "groq"})
        env.start()
        self.addCleanup(env.stop)
        self.client = server.app.test_client()
        self.body = dict(
            text="ฮาจะไปกินข้าวแล้ว",
            source="th",
            target="en",
            tone="natural",
            thai_mode="northern",
            interface_language="th",
        )

    def test_reference_is_scoped_to_selected_dialect_and_pronoun_context(self):
        for text in ["ฮาจะไปกินข้าวแล้ว", "ฮาจะไปกินข้าว", "ฮาบ่ไปกินข้าว", "ฮากิ๋นข้าวแล้ว"]:
            self.assertTrue(
                any(
                    r["id"] == "northern-first-person-ha"
                    for r in lexical_references(text, "northern")
                )
            )
        for mode, text in [
            ("standard", self.body["text"]),
            ("auto", self.body["text"]),
            ("northern", "ฮ่าๆ จะไปกินข้าว"),
            ("northern", "ฮาฮา ไปกินข้าว"),
            ("northern", "เรื่องนี้ฮามาก"),
            ("northern", "อาหารฮาลาล"),
        ]:
            self.assertFalse(
                any(r["id"] == "northern-first-person-ha" for r in lexical_references(text, mode))
            )
        self.assertFalse(introduces_laughter("ฮาจะไปกินข้าว ฮ่าๆ", "Haha, I'm going to eat."))

    def test_correct_first_person_reaches_prompt_and_allows_one_generation(self):
        with patch.object(server, "get_client") as provider:
            provider.return_value.chat.completions.create.return_value = completion(
                json.dumps(reading())
            )
            response = self.client.post("/api/translate", json=self.body)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.get_json()["translation"], "I'm going to eat now.")
            create = provider.return_value.chat.completions.create
            self.assertEqual(create.call_count, 1)
            payload = json.loads(create.call_args.kwargs["messages"][1]["content"])
            self.assertEqual(payload["source_text"], self.body["text"])
            self.assertTrue(
                any(r["id"] == "northern-first-person-ha" for r in payload["published_references"])
            )

    def test_invented_laughter_is_repaired_in_both_interpretation_and_translation(self):
        for incorrect in [
            reading("ฮ่า ฉันจะไปกินข้าวแล้ว", "Haha, I'm going to eat now."),
            reading(translation="Haha, I'm going to eat now."),
        ]:
            with self.subTest(incorrect=incorrect), patch.object(server, "get_client") as provider:
                create = provider.return_value.chat.completions.create
                create.side_effect = [
                    completion(json.dumps(incorrect)),
                    completion(json.dumps(reading())),
                ]
                response = self.client.post("/api/translate", json=self.body)
                self.assertEqual(response.status_code, 200, response.get_json())
                self.assertEqual(
                    response.get_json()["interpretation"]["standard_thai"], "ฉันจะไปกินข้าวแล้ว"
                )
                self.assertEqual(response.get_json()["translation"], "I'm going to eat now.")
                self.assertEqual(create.call_count, 2)

    def test_repeated_bad_output_is_not_returned_or_cached_as_success(self):
        with patch.object(server, "get_client") as provider:
            create = provider.return_value.chat.completions.create
            create.return_value = completion(
                json.dumps(reading("ฮ่า ฉันจะไปกินข้าวแล้ว", "Haha, I'm going to eat now."))
            )
            for _ in range(2):
                response = self.client.post("/api/translate", json=self.body)
                self.assertEqual(response.status_code, 503)
                self.assertNotIn("translation", response.get_json())
            self.assertEqual(create.call_count, 4)

    def test_explicit_laughter_and_speaker_clarification_take_precedence(self):
        for options in [
            dict(text="ฮาจะไปกินข้าวแล้ว ฮ่าๆ"),
            dict(thai_clarification="ในประโยคนี้ฮาหมายถึงเสียงหัวเราะก่อนพูด"),
        ]:
            with self.subTest(options=options), patch.object(server, "get_client") as provider:
                create = provider.return_value.chat.completions.create
                create.return_value = completion(
                    json.dumps(reading("ฮ่า ฉันจะไปกินข้าวแล้ว", "Haha, I'm going to eat now."))
                )
                response = self.client.post("/api/translate", json={**self.body, **options})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(create.call_count, 1)

    def test_source_suggestions_cannot_add_laughter_to_correct_pronoun(self):
        with patch.object(server, "get_client") as provider:
            create = provider.return_value.chat.completions.create
            create.side_effect = [
                completion(
                    json.dumps(
                        {"pronunciation": "ha ja pai kin khao laeo", "alternatives": choices}
                    )
                )
                for choices in [
                    ["ฮ่า ฉันจะไปกินข้าวแล้ว", "ฮ่า ฉันกำลังจะไปกินข้าว"],
                    ["ฉันจะไปกินข้าวแล้ว", "ฉันกำลังจะไปกินข้าว"],
                ]
            ]
            body = {
                **self.body,
                "action": "source_info",
                "translation": "I'm going to eat now.",
                "interpretation": {"standard_thai": "ฉันจะไปกินข้าวแล้ว"},
            }
            bad = self.client.post("/api/assist", json=body)
            self.assertEqual(bad.status_code, 503)
            good = self.client.post("/api/assist", json=body)
            self.assertEqual(good.status_code, 200)
            self.assertEqual(good.get_json()["alternatives"][0], "ฉันจะไปกินข้าวแล้ว")
