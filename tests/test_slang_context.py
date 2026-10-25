"""Context and operation-isolation regressions for shared lexical guidance."""

import json
import unittest
from unittest.mock import MagicMock, patch

from test_app import completion

import app as server
from assistant_features import assistant_result
from dialect_references import lexical_references
from linguistic_guidance import language_notes
from performance import ResultCache
from photo_translation import translate_regions
from semantic_review import review_reasons


class SlangContextTests(unittest.TestCase):
    def test_challenge_variants_get_contextual_guidance_but_temples_do_not(self):
        for source in ("วัดปะล่ะ", "วัดป่ะล่ะ?", "เล่นเกมกับเราหน่อย วัดป่ะละ", "วัด ป่ะ ล่ะ"):
            with self.subTest(source=source):
                notes = language_notes(source)
                challenge = [note for note in notes if note["quote"] == "วัดปะล่ะ"]
                self.assertEqual(len(challenge), 1)
                self.assertIn("challenge", challenge[0]["readings"])
                self.assertIn("not physical violence", challenge[0]["readings"])
                self.assertIn("context takes precedence", challenge[0]["readings"])
                self.assertIn("idiom_or_regional_usage", review_reasons(source, "general", [], []))
        for source in ("วัดไหน", "พรุ่งนี้ไปวัด", "วัดป่าอยู่ไหน", "วัดปะละ", "วัดความยาวโต๊ะ 50 เซนติเมตร"):
            with self.subTest(source=source):
                self.assertNotIn("วัดปะล่ะ", [note["quote"] for note in language_notes(source)])

    def test_context_changes_reading_without_replacing_source(self):
        pairs = [
            ("เพื่อนขิงคอมใหม่", "ชาขิงไม่ใส่น้ำตาล", "ginger"),
            ("สุ่มแล้วเกลืออีก", "ใส่เกลือ 10 กรัม", "salt"),
            ("โดนป้ายยาหูฟัง", "ป้ายยาบนแผล", "medication"),
            ("เรือแตกเพราะคู่ที่ชิป", "เรือแตกกลางทะเล", "shipwreck"),
        ]
        for figurative, literal, cue in pairs:
            for source in (figurative, literal):
                with self.subTest(source=source):
                    self.assertTrue(language_notes(source))
                    self.assertIn(cue, json.dumps(language_notes(source)).lower())
                    self.assertIn(
                        "idiom_or_regional_usage", review_reasons(source, "general", [], [])
                    )

    def test_partial_word_collisions_do_not_trigger_slang(self):
        for text in (
            "เมนูอาหาร",
            "คอมเมนต์",
            "โดเมนใหม่",
            "เมนบอร์ด",
            "โมเมนต์",
            "เมนทอล",
            "สับสน",
            "สับปะรด",
            "ขนมปัง",
            "ชิปปิ้ง",
            "ฉันอยากกินข้าว",
            "คนอยากกลับบ้าน",
            "ฉันอยู่บ้าน",
            "คุณลิขิต",
            "พรหมลิขิต",
            "หอไอเฟล",
            "ด้อม ๆ มอง ๆ",
        ):
            with self.subTest(text=text):
                self.assertEqual(lexical_references(text, "auto"), [])

    def test_subject_and_dating_cues_trigger_review_without_changing_explicit_pronouns(self):
        cases = [
            ("ทำงานมาสิบชั่วโมงแล้ว ไหวไหม", "LISTENER"),
            ("บอกว่าฉันผิดทั้งที่ยังไม่อ่าน ไปพักก่อน", "LISTENER"),
            ("อยากคุยจริงจัง ไม่ได้คุยเผื่อเลือก", "ROMANTIC CONTEXT CUE"),
        ]
        for source, cue in cases:
            with self.subTest(source=source):
                self.assertIn(cue, json.dumps(language_notes(source), ensure_ascii=False))
                self.assertIn("idiom_or_regional_usage", review_reasons(source, "general", [], []))

    def test_context_selectors_leave_explicit_literal_and_self_rest_readings_alone(self):
        for source, term in [
            ("ไฟลนก้นกระทะจนดำ", "ไฟลนก้น"),
            ("ไฟลนก้นหม้อ", "ไฟลนก้น"),
            ("ฉันขอไปพักก่อนนะ", "ไปพักก่อน"),
            ("ฉันอยากไปพักก่อน", "ไปพักก่อน"),
            ("ขอคุยจริงจังเรื่องงบประมาณกับแฟน", "คุยจริงจัง"),
            ("หัวหน้าขอคุยจริงจังเรื่องงาน", "คุยจริงจัง"),
        ]:
            with self.subTest(source=source):
                self.assertNotIn(term, [note["quote"] for note in language_notes(source)])
        self.assertIn(
            "คุยจริงจัง", [note["quote"] for note in language_notes("อยากคุยจริงจังกับเธอ ไม่ได้คุยเผื่อเลือก")]
        )

    def test_retrieval_deduplicates_overlaps_and_retains_multiple_distinct_senses(self):
        refs = lexical_references("โดนแกงจนช็อตฟีล แต่ยังชอบคนในด้อม", "auto")
        terms = [r["term"] for r in refs]
        self.assertIn("โดนแกง", terms)
        self.assertNotIn("แกง", terms)
        self.assertIn("ช็อตฟีล", terms)
        self.assertIn("ด้อม", terms)
        self.assertLessEqual(len(refs), 8)
        self.assertEqual(language_notes("Hello, how are you?"), [])

    def test_photo_labels_receive_their_own_notes_and_keep_original_text(self):
        regions = [{"text": "ป้ายยาบนแผล"}, {"text": "เมนูอาหาร"}]
        provider = MagicMock()
        provider.chat.completions.create.return_value = completion(
            json.dumps(
                {
                    "translations": [
                        {"id": 0, "text": "Apply medication to the wound"},
                        {"id": 1, "text": "Menu"},
                    ]
                }
            )
        )
        self.assertEqual(
            len(translate_regions(regions, "th", "en", "natural", provider, "model")), 2
        )
        labels = json.loads(
            provider.chat.completions.create.call_args.kwargs["messages"][1]["content"]
        )
        self.assertEqual(labels[0]["text"], regions[0]["text"])
        self.assertIn("medication", labels[0]["linguistic_notes"][0]["readings"])
        self.assertEqual(labels[1]["linguistic_notes"], [])
        self.assertNotIn("linguistic_notes", regions[0])

    def test_assistant_uses_context_without_mutating_it(self):
        context = {"source_text": "เขาพูดช็อตฟีล", "translation": "He killed the mood."}
        provider = MagicMock()
        provider.chat.completions.create.return_value = completion(
            json.dumps({"explanation": "อธิบายว่าทำให้เสียบรรยากาศ"})
        )
        assistant_result(provider, "model", "explain", context, "Thai")
        payload = json.loads(
            provider.chat.completions.create.call_args.kwargs["messages"][1]["content"]
        )
        self.assertIn("buzzkill", payload["linguistic_notes"][0]["readings"])
        self.assertNotIn("linguistic_notes", context)

    def test_photo_cache_invalidates_when_lexical_data_changes(self):
        import photo_translation as photo

        with (
            patch.object(photo, "_photo_result_cache", ResultCache()),
            patch.object(photo, "reference_identity", return_value=((1, 10), None)) as identity,
            patch.object(photo, "_translate_photo", return_value={"regions": []}) as translate,
        ):
            provider = MagicMock()
            self.assertEqual(
                photo.translate_photo(b"fixture", "th", "en", "natural", provider, "model")[
                    "cache_status"
                ],
                "miss",
            )
            self.assertEqual(
                photo.translate_photo(b"fixture", "th", "en", "natural", provider, "model")[
                    "cache_status"
                ],
                "hit",
            )
            identity.return_value = ((2, 20), None)
            self.assertEqual(
                photo.translate_photo(b"fixture", "th", "en", "natural", provider, "model")[
                    "cache_status"
                ],
                "miss",
            )
            self.assertEqual(translate.call_count, 2)

    def test_text_and_document_scope_do_not_mix_notes_between_requests(self):
        with patch.object(server, "get_client") as provider:
            provider.return_value.chat.completions.create.side_effect = [
                completion("The fandom"),
                completion("Menu"),
            ]
            server.translate_text("คนในด้อม", "th", "en", "natural")
            server.translate_text("เมนูอาหาร", "th", "en", "natural")
            calls = provider.return_value.chat.completions.create.call_args_list
            self.assertIn("Fandom", calls[0].kwargs["messages"][0]["content"])
            self.assertNotIn("Fandom", calls[1].kwargs["messages"][0]["content"])


if __name__ == "__main__":
    unittest.main()
