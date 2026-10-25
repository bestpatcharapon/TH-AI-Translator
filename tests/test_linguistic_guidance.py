import json
import unittest
from unittest.mock import MagicMock, patch

from test_app import completion

import app as server
from dialect_references import lexical_references
from linguistic_guidance import language_notes, linguistic_guidance
from semantic_review import review_reasons, review_translation


class LinguisticGuidanceTests(unittest.TestCase):
    def test_slang_review_can_correct_recipient_mistranslation_with_source_evidence(self):
        client = MagicMock()
        client.chat.completions.create.return_value = completion(
            json.dumps(
                {
                    "decision": "revise",
                    "translation": "Go for it, buddy!",
                    "question": "",
                    "issues": [
                        {
                            "kind": "meaning",
                            "source_quote": "สาดไปสมาชิก",
                            "draft_quote": "Send it to the members.",
                            "explanation": "The supplied phrase meaning is encouragement, not delivery to recipients.",
                        }
                    ],
                }
            )
        )
        translation, review = review_translation(
            client,
            "model",
            "สาดไปสมาชิก",
            "Send it to the members.",
            "th",
            "en",
            "natural",
            "general",
            "",
            [],
            [],
        )
        self.assertEqual(translation, "Go for it, buddy!")
        self.assertEqual(review["status"], "revised")

    def test_user_slang_reaches_standard_generation_and_review_without_mode_switch(self):
        text = "สาดไปสมาชิก"
        note = language_notes(text)[0]
        self.assertIn("ลุยเลย", note["central_thai"])
        self.assertEqual(note["provenance"], "project_user_definition")
        self.assertEqual(note["sources"], [])
        self.assertIn("idiom_or_regional_usage", review_reasons(text, "general", [], []))
        with patch.object(server, "get_client") as provider:
            provider.return_value.chat.completions.create.return_value = completion(
                "Go for it, buddy!"
            )
            server.translate_text(text, "th", "en", "natural")
            messages = provider.return_value.chat.completions.create.call_args.kwargs["messages"]
            self.assertEqual(messages[1]["content"], text)
            self.assertIn("not a recipient list", messages[0]["content"])
        client = MagicMock()
        client.chat.completions.create.return_value = completion(
            json.dumps(
                {
                    "decision": "keep",
                    "translation": "Go for it, buddy!",
                    "issues": [],
                    "question": "",
                }
            )
        )
        review_translation(
            client, "model", text, "Go for it, buddy!", "th", "en", "natural", "general", "", [], []
        )
        payload = json.loads(
            client.chat.completions.create.call_args.kwargs["messages"][1]["content"]
        )
        self.assertEqual(payload["linguistic_notes"][0], note)

    def test_slang_retrieval_handles_spacing_and_context_without_matching_literal_words(self):
        for text in (
            "สาดไปสมาชิก",
            "สาดไป สมาชิก!",
            "ได้เลย สาดไปสมาชิก",
            "คำว่า สาดไปสมาชิก หมายความว่าอะไร",
        ):
            for mode in ("auto", "slang"):
                references = lexical_references(text, mode)
                self.assertEqual(references[0]["id"], "slang-saat-pai-samachik")
                self.assertIn("quotation", references[0]["usage"])
        for text in (
            "สาดน้ำใส่สมาชิก",
            "ส่งไปให้สมาชิก",
            "ส่งเอกสารให้สมาชิก 50 คน",
            "จัดไปเพื่อน",
            "สาดสีไปที่กำแพง",
        ):
            self.assertEqual(lexical_references(text, "auto"), [])

    def test_notes_preserve_literal_readings_and_do_not_replace_sentences(self):
        for text in ("งานนี้ทำแบบผักชีโรยหน้า", "ข้าวต้มใส่ผักชีโรยหน้า"):
            notes = linguistic_guidance(text)
            self.assertIn("literal food", notes)
            self.assertIn("work/performance", notes)
        self.assertEqual(language_notes("สวัสดีครับ"), [])

    def test_dialect_question_cues_do_not_turn_standard_crows_into_questions(self):
        self.assertTrue(
            any("polar-question" in note["readings"] for note in language_notes("กิ๋นข้าวแล้วกา"))
        )
        for text in ("ผมเห็นกา", "เปิ้นเห็นกา", "จ้องหน้าคนอื่นทำไม"):
            self.assertFalse(
                any("polar-question" in note["readings"] for note in language_notes(text))
            )
        self.assertTrue(any("Isan" in note["readings"] for note in language_notes("เจ้ากินข้าวแล้วบ่")))

    def test_frequency_units_and_smart_apostrophes_are_recognized(self):
        for text in ("every other day", "every other Friday", "I’m afraid we won’t make it"):
            self.assertTrue(language_notes(text))
            self.assertIn("idiom_or_regional_usage", review_reasons(text, "general", [], []))

    def test_original_source_and_notes_reach_generation_and_review(self):
        text = "กิ๋นข้าวแล้วกา"
        with patch.object(server, "get_client") as provider:
            provider.return_value.chat.completions.create.return_value = completion(
                "Have you eaten yet?"
            )
            translated = server.translate_text(text, "th", "en", "natural")
            request = provider.return_value.chat.completions.create.call_args.kwargs
            self.assertEqual(request["messages"][1]["content"], text)
            self.assertIn("polar-question", request["messages"][0]["content"])
        client = MagicMock()
        client.chat.completions.create.return_value = completion(
            json.dumps(
                {"decision": "keep", "translation": translated, "issues": [], "question": ""}
            )
        )
        review_translation(
            client, "model", text, translated, "th", "en", "natural", "general", "", [], []
        )
        payload = json.loads(
            client.chat.completions.create.call_args.kwargs["messages"][1]["content"]
        )
        self.assertEqual(payload["source_text"], text)
        self.assertEqual(payload["linguistic_notes"], language_notes(text))

    def test_conflict_idiom_triggers_review_even_without_negation(self):
        text = "ตรวจบัญชีบริษัทญาติทีไรก็ลูบหน้าปะจมูกทุกที"
        notes = language_notes(text)
        self.assertTrue(any("personally connected" in note["readings"] for note in notes))
        self.assertTrue(any("Do not invent corruption" in note["readings"] for note in notes))
        self.assertIn("idiom_or_regional_usage", review_reasons(text, "general", [], []))
        self.assertEqual(language_notes("เขาลูบหน้าแล้วจับจมูก"), [])

    def test_consideration_notes_cover_permission_and_reluctance_without_replacing_source(self):
        for text in ("ไม่ต้องเกรงใจ หยิบเพิ่มได้เลย", "ผมเกรงใจที่จะรบกวนคุณนอกเวลางาน"):
            notes = language_notes(text)
            self.assertTrue(
                any("permission, reassurance or reluctance" in note["readings"] for note in notes)
            )
            self.assertIn("idiom_or_regional_usage", review_reasons(text, "general", [], []))
        self.assertEqual(language_notes("ไม่ต้องกลัว"), [])

    def test_sourced_dialect_cue_reaches_standard_translation_as_well(self):
        notes = language_notes("ป่อคิงหยัง")
        self.assertEqual(notes[0]["central_thai"], "พ่อมึงเหรอ")
        self.assertTrue(notes[0]["sources"])
        self.assertIn("idiom_or_regional_usage", review_reasons("ป่อคิงหยัง", "general", [], []))
        with patch.object(server, "get_client") as provider:
            provider.return_value.chat.completions.create.return_value = completion("Your dad?")
            server.translate_text("ป่อคิงหยัง", "th", "en", "natural")
            system = provider.return_value.chat.completions.create.call_args.kwargs["messages"][0][
                "content"
            ]
            self.assertIn("พ่อมึงเหรอ", system)
            self.assertIn("rhetorical retort", system)
