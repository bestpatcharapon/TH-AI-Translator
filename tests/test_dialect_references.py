import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from openai import OpenAIError
from test_app import completion

import app as server
from dialect_references import corpus_references, introduces_laughter, lexical_references, normalize
from scripts.setup_dialect_references import build_index


def interpretation(meaning="พ่อมึงเหรอ", translation="Your father, huh?!"):
    return dict(
        status="ready",
        standard_thai=meaning,
        translation=translation,
        note="คำโต้กลับหยาบตามแหล่งอ้างอิง",
        questions=[],
        possibilities=[],
        evidence=[],
    )


class ReferenceRetrievalTests(unittest.TestCase):
    def test_curated_alias_is_attributed_and_does_not_match_literal_father(self):
        for text in ("ป้อคิงหยัง", "ป่อคิงหยัง", "ป่อ คิง หยัง"):
            refs = lexical_references(text, "northern")
            self.assertEqual(refs[0]["central_thai"], "พ่อมึงเหรอ")
            self.assertEqual(len(refs[0]["sources"]), 2)
            self.assertTrue(
                all(source["url"].startswith("https://") for source in refs[0]["sources"])
            )
        literal = lexical_references("ป้อเปิ้นไปกาดแล้ว", "northern")
        self.assertEqual([item["id"] for item in literal], ["northern-father-noun"])
        self.assertEqual(lexical_references("ป้อคิงหยัง", "isan"), [])
        for ordinary in ("ป้องกัน", "ป้อนข้าว", "ป้อมปราการ", "ป้อยอ", "อ่อนป้อแป้"):
            self.assertEqual(lexical_references(ordinary, "auto"), [])
        self.assertNotEqual(normalize("กอ"), normalize("ก่อ"))

    def test_southern_check_in_retrieves_construction_instead_of_only_component(self):
        for text in ("พันพรือมั่ง", "พันพรื่อมั่ง", "พันพรือบ้าง", "พัน พรือ มั่ง", "งานพันพรือมั่ง"):
            with self.subTest(text=text):
                refs = lexical_references(text, "southern")
                ids = {item["id"] for item in refs}
                self.assertIn("southern-phan-phrue", ids)
                self.assertNotIn("southern-how-phrue", ids)
                self.assertIn("unapproved", refs[0]["sources"][0]["title"])
        for text in ("พันเชือก", "หนึ่งพันบาท", "พันพรุ่งนี้"):
            self.assertNotIn(
                "southern-phan-phrue", {item["id"] for item in lexical_references(text, "southern")}
            )
        self.assertEqual(lexical_references("พันพรือมั่ง", "isan"), [])

    def test_researched_regional_notes_keep_modes_and_contextual_contrasts(self):
        cases = [
            ("northern", "บ่อู้", "northern-speak-uu", "slacking"),
            ("northern", "กึ๊ดเติงหาบ้าน", "northern-miss-kuet-tueng", "romance"),
            ("northern", "ไปแอ่วกาด", "northern-visit-aeo", "destination"),
            ("northern", "ลําขนาด", "northern-intensity-khanat", "measurements"),
            ("isan", "เมื่อยบ่", "isan-fatigue-mueai", "aching"),
            ("isan", "ได้บ่", "isan-negation-question-bo", "question"),
            ("isan", "ฮักแม่", "isan-love-hak", "plant"),
            ("isan", "คิดฮอดบ้าน", "isan-miss-khit-hot", "romance"),
            ("isan", "มื้ออื่น", "isan-day-mue", "meal"),
            ("southern", "หลบบ้าน", "southern-return-lop", "hiding"),
            ("southern", "เที่ยวหรอย", "southern-delicious-roi", "activity"),
        ]
        for mode, text, expected, contrast in cases:
            with self.subTest(text=text):
                refs = lexical_references(text, mode)
                ref = next(item for item in refs if item["id"] == expected)
                self.assertEqual(ref["provenance"], "editorial_context_note")
                self.assertIn(contrast, ref["usage"].lower())
                self.assertTrue(
                    all(
                        source["url"].startswith("https://") and source["supports"]
                        for source in ref["sources"]
                    )
                )
                self.assertIn(expected, {item["id"] for item in lexical_references(text, "auto")})
                for other in {"northern", "isan", "southern"} - {mode}:
                    self.assertNotIn(
                        expected, {item["id"] for item in lexical_references(text, other)}
                    )

    def test_research_notes_do_not_erase_literal_homograph_context(self):
        cases = [
            ("northern", "อย่าอู้งาน", "northern-speak-uu", "อู้งาน"),
            ("northern", "ซออู้", "northern-speak-uu", "ซออู้"),
            ("northern", "ขนาด 2 เมตร", "northern-intensity-khanat", "measurements"),
            ("isan", "กินข้าวสามมื้อ", "isan-day-mue", "meal"),
            ("isan", "เสื้อแขนเว้า", "isan-speak-wao", "clothing"),
            ("southern", "หลบฝน", "southern-return-lop", "shelter"),
        ]
        for mode, text, expected, guard in cases:
            with self.subTest(text=text):
                ref = next(
                    item for item in lexical_references(text, mode) if item["id"] == expected
                )
                self.assertIn(guard, ref["usage"])
        for text in ("แลกเงิน", "และ", "แหล่งน้ํา", "ขนมปัง"):
            self.assertFalse(
                any(
                    ref["id"].startswith("southern-")
                    for ref in lexical_references(text, "southern")
                )
            )

    def test_sara_am_spellings_share_exact_normalization_without_fuzzy_matching(self):
        for composed, decomposed in (("ทำถึง", "ทําถึง"), ("ขำ", "ขํา"), ("น้ำ", "น้ํา")):
            with self.subTest(composed=composed):
                self.assertEqual(normalize(composed), normalize(decomposed))
        self.assertNotEqual(normalize("น้ำ"), normalize("นำ"))
        self.assertNotEqual(normalize("①"), normalize("1"))
        self.assertNotEqual(normalize("ทําไม่ถึง"), normalize("ทําถึง"))

    def test_sara_am_curated_terms_and_context_patterns_across_modes(self):
        cases = (
            ("ทำถึง", "contextual-slang-28", {"auto", "slang"}),
            ("ทําถึง", "contextual-slang-28", {"auto", "slang"}),
            ("ทำแกงให้เพื่อน", "contextual-slang-14", {"auto", "slang"}),
            ("ทําแกงให้เพื่อน", "contextual-slang-14", {"auto", "slang"}),
            ("ฮากำลังไปกาด", "northern-first-person-ha", {"northern"}),
            ("ฮากําลังไปกาด", "northern-first-person-ha", {"northern"}),
            ("ฮาไปทำงาน", "northern-first-person-ha", {"northern"}),
            ("ฮาไปทํางาน", "northern-first-person-ha", {"northern"}),
        )
        for text, expected, allowed in cases:
            for mode in ("auto", "slang", "northern", "isan", "southern", "standard"):
                with self.subTest(text=text, mode=mode):
                    ids = [item["id"] for item in lexical_references(text, mode)]
                    self.assertEqual(expected in ids, mode in allowed)

    def test_syllable_suffixes_do_not_trigger_partial_terms(self):
        for text in ("ปังก์", "เพลงปังก์", "แบกะดิน"):
            for mode in ("auto", "slang"):
                with self.subTest(text=text, mode=mode):
                    self.assertEqual(lexical_references(text, mode), [])
        for text, expected in (("ร้านนี้ปังมาก", "ปัง"), ("เพื่อนขิงคอมใหม่", "ขิง")):
            self.assertIn(expected, [item["term"] for item in lexical_references(text, "auto")])

    def test_context_pattern_must_cover_the_actual_term_occurrence(self):
        for text in ("ลิขิต ขิ ต", "ขิ ต ลิขิต", "สั บ สับสน", "ขนมปัง ปั ง"):
            for mode in ("auto", "slang"):
                with self.subTest(text=text, mode=mode):
                    self.assertEqual(lexical_references(text, mode), [])

    def test_overlap_selection_uses_actual_alias_spans_across_modes(self):
        entries = [
            {"id": "long", "dialect": "slang", "term": "สั้น", "aliases": ["คำเต็มยาว"]},
            {"id": "short", "dialect": "slang", "term": "คำเต็ม", "aliases": []},
        ]
        with patch("dialect_references._curated", return_value=entries):
            for mode in ("auto", "slang"):
                for text in ("คำเต็มยาว", "คํ าเต็มยาว", "คำ เต็ม ยาว"):
                    with self.subTest(text=text, mode=mode):
                        self.assertEqual(
                            [item["id"] for item in lexical_references(text, mode)], ["long"]
                        )
            for mode in ("northern", "isan", "southern", "standard"):
                self.assertEqual(lexical_references("คำเต็มยาว", mode), [])

    def test_separate_short_occurrence_survives_compound_overlap(self):
        for mode in ("auto", "slang"):
            for text in ("โดนแกง แต่ทำแกงให้เพื่อน", "ทำแกงให้เพื่อน แต่โดนแกง"):
                with self.subTest(text=text, mode=mode):
                    ids = [item["id"] for item in lexical_references(text, mode)]
                    self.assertEqual(ids, ["contextual-slang-13", "contextual-slang-14"])
        for text in ("ป้อคิงหยัง ป้อเปิ้นไปกาด", "ป่อคิงหยัง ป้อเปิ้นไปกาด"):
            with self.subTest(text=text):
                self.assertEqual(
                    [item["id"] for item in lexical_references(text, "northern")],
                    ["northern-retort-parent", "northern-father-noun"],
                )

    def test_repeated_aliases_are_deduplicated_and_selection_is_bounded(self):
        for text in ("วัดปะล่ะ วัดป่ะล่ะ วัดป่ะละ", "วัด ป่ะ ล่ะ วัดป่ะละ"):
            for mode in ("auto", "slang"):
                with self.subTest(text=text, mode=mode):
                    self.assertEqual(
                        [item["id"] for item in lexical_references(text, mode)],
                        ["contextual-challenge-wat-pa-la"],
                    )
        text = "ไหวไหม ตัวตึง มงลง ได้หมด ของแทร่ เมพ ช็อตฟีล กินขาด ใจบาง ตุย"
        for mode in ("auto", "slang"):
            refs = lexical_references(text, mode)
            self.assertEqual(len(refs), 8)
            self.assertEqual(len({item["id"] for item in refs}), 8)
            self.assertEqual(refs, lexical_references(text, mode))

    def test_unknown_spellings_and_negation_are_not_guessed(self):
        for text in ("ทำไม่ถึง", "ทําไม่ถึง", "ชอตฟีล", "ป่อคิงหญัง", "วัดปะละ", "เอาไม่อยู่"):
            for mode in ("auto", "slang", "northern", "isan", "southern", "standard"):
                with self.subTest(text=text, mode=mode):
                    self.assertEqual(lexical_references(text, mode), [])

    def test_explicit_laughter_accepts_both_sara_am_spellings(self):
        for source in ("ขำมาก", "ขํามาก"):
            self.assertFalse(introduces_laughter(source, "Haha, that was funny."))
        self.assertTrue(introduces_laughter("ฮาจะไปกินข้าว", "Haha, I'm going to eat."))

    def test_corpus_sara_am_spellings_are_exact_across_supported_modes(self):
        with tempfile.TemporaryDirectory() as directory:
            index = Path(directory) / "refs.sqlite"
            with sqlite3.connect(index) as db:
                db.execute(
                    "CREATE TABLE examples(id INTEGER PRIMARY KEY,variety TEXT,source TEXT,central TEXT,normalized TEXT)"
                )
                db.execute(
                    "INSERT INTO examples VALUES(?,?,?,?,?)",
                    (1, "khummuang", "กำเมือง", "คำเมือง", normalize("กำเมือง")),
                )
            for source in ("กำเมือง", "กําเมือง", "กำ เมือง"):
                for mode in ("auto", "northern", "slang", "isan", "southern", "standard"):
                    with self.subTest(source=source, mode=mode):
                        refs = corpus_references(source, mode, index=index)
                        if mode in ("auto", "northern"):
                            self.assertEqual([item["match"] for item in refs], ["exact_sentence"])
                        else:
                            self.assertEqual(refs, [])

    def test_optional_index_exact_retrieval_keeps_varieties_separate(self):
        with tempfile.TemporaryDirectory() as directory:
            index = Path(directory) / "refs.sqlite"
            with sqlite3.connect(index) as db:
                db.execute(
                    "CREATE TABLE examples(id INTEGER PRIMARY KEY,variety TEXT,source TEXT,central TEXT,normalized TEXT)"
                )
                db.executemany(
                    "INSERT INTO examples VALUES(?,?,?,?,?)",
                    [
                        (1, "khummuang", "จ้วย อู้ จ้า จ้า", "กรุณาพูดช้าๆ", normalize("จ้วย อู้ จ้า จ้า")),
                        (
                            2,
                            "korat",
                            "ท่านไม่ควรทำอย่างนี่",
                            "ท่านไม่ควรทำเช่นนี้",
                            normalize("ท่านไม่ควรทำอย่างนี่"),
                        ),
                        (3, "pattani", "ยูวาแบะนอนิห", "ขายยังไง", normalize("ยูวาแบะนอนิห")),
                    ],
                )
                db.execute(
                    "CREATE VIRTUAL TABLE search USING fts5(normalized,content='examples',content_rowid='id',tokenize='trigram')"
                )
                db.execute("INSERT INTO search(search) VALUES('rebuild')")
            result = corpus_references("จ้วยอู้จ้าจ้า", "northern", index=index)
            self.assertEqual(result[0]["central_thai"], "กรุณาพูดช้าๆ")
            self.assertEqual(result[0]["match"], "exact_sentence")
            self.assertEqual(corpus_references("ท่านไม่ควรทำอย่างนี่", "isan", index=index), [])
            self.assertEqual(corpus_references("ยูวาแบะนอนิห", "southern", index=index), [])
            result = corpus_references("ท่านไม่ควรทำอย่างนี่", "auto", index=index)
            self.assertEqual(result[0]["variety"], "korat")
            self.assertEqual(corpus_references('" OR *', "northern", index=index), [])

    def test_missing_or_broken_optional_index_does_not_block_translation(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "index.sqlite"
            self.assertEqual(corpus_references("คำถาม", "northern", index=path), [])
            path.write_bytes(b"not a database")
            self.assertEqual(corpus_references("คำถาม", "northern", index=path), [])

    def test_changed_download_is_rejected_before_index_creation(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "index.sqlite"
            with self.assertRaises(ValueError):
                build_index(b"unexpected download", path)
            self.assertFalse(path.exists())


class GroundedDialectTests(unittest.TestCase):
    def request(self, primary, checked=None, text="ป่อคิงหยัง", target="en", **overrides):
        with (
            patch.object(server, "get_client") as client,
            patch("thai_interpretation.dialect_review_route") as route,
        ):
            if isinstance(primary, Exception):
                client.return_value.chat.completions.create.side_effect = primary
            else:
                client.return_value.chat.completions.create.return_value = completion(
                    json.dumps(primary)
                )
            if checked is None:
                route.return_value = (None, "model", "groq")
            else:
                reviewer = MagicMock()
                if isinstance(checked, Exception):
                    reviewer.chat.completions.create.side_effect = checked
                else:
                    reviewer.chat.completions.create.return_value = completion(json.dumps(checked))
                route.return_value = (reviewer, "review-model", "gemini")
            response = server.app.test_client().post(
                "/api/translate",
                json={
                    "text": text,
                    "source": "th",
                    "target": target,
                    "thai_mode": "northern",
                    "cache_bypass": True,
                    **overrides,
                },
            )
            payload = json.loads(
                client.return_value.chat.completions.create.call_args.kwargs["messages"][1][
                    "content"
                ]
            )
            return response, payload

    def test_sourced_case_translates_without_speaker_definition(self):
        response, payload = self.request(interpretation(), target="th")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["translation"], "พ่อมึงเหรอ")
        self.assertEqual(payload["source_text"], "ป่อคิงหยัง")
        self.assertEqual(payload["published_references"][0]["kind"], "lexical")
        self.assertTrue(response.get_json()["interpretation"]["references"])

    def test_independent_review_corrects_both_meaning_and_translation(self):
        response, _ = self.request(
            interpretation("คุณทำอะไรอยู่", "What are you doing?"), interpretation()
        )
        self.assertEqual(response.get_json()["interpretation"]["standard_thai"], "พ่อมึงเหรอ")
        self.assertEqual(response.get_json()["translation"], "Your father, huh?!")
        self.assertEqual(response.get_json()["quality_review"]["status"], "revised")
        self.assertEqual(response.get_json()["quality_review"]["provider"], "gemini")

    def test_unavailable_review_cannot_expose_a_reference_contradiction_as_ready(self):
        response, _ = self.request(
            interpretation("คุณทำอะไรอยู่", "What are you doing?"), OpenAIError("unavailable")
        )
        self.assertEqual(response.get_json()["translation"], "")
        self.assertEqual(response.get_json()["interpretation"]["status"], "needs_context")
        self.assertEqual(response.get_json()["additional_translations"], [])
        self.assertEqual(response.get_json()["quality_review"]["reason"], "reference_conflict")

    def test_review_cannot_change_prices(self):
        response, _ = self.request(
            interpretation("ของนี้ราคา50บาท", "This costs 50 baht."),
            interpretation("ของนี้ราคา500บาท", "This costs 500 baht."),
            text="ของนี้ราคา50บาท",
        )
        self.assertEqual(response.get_json()["translation"], "This costs 50 baht.")
        self.assertEqual(response.get_json()["quality_review"]["status"], "rejected")

    def test_ordinary_father_and_personal_meaning_are_not_forced_into_insults(self):
        response, _ = self.request(
            interpretation("พ่อเขาไปตลาดแล้ว", "His father has gone to the market."),
            text="ป้อเปิ้นไปกาดแล้ว",
        )
        self.assertEqual(response.get_json()["interpretation"]["status"], "ready")
        response, _ = self.request(
            interpretation("ไงเพื่อน", "Hey, friend."),
            thai_lexicon=[
                {
                    "term": "ป่อคิงหยัง",
                    "meaning": "ไงเพื่อน ใช้เฉพาะกลุ่มสมมติ",
                    "dialect": "northern",
                    "example": "",
                }
            ],
        )
        self.assertEqual(response.get_json()["translation"], "Hey, friend.")

    def test_invalid_draft_evidence_is_repaired_by_independent_review(self):
        primary = interpretation()
        primary["evidence"] = [
            {"quote": "dictionary title absent from source", "meaning": "พ่อมึงเหรอ"}
        ]
        response, _ = self.request(primary, interpretation())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["interpretation"]["status"], "ready")
        self.assertEqual(
            response.get_json()["quality_review"]["reason"], "invalid_primary_repaired"
        )
        self.assertEqual(response.get_json()["interpretation"]["evidence"], [])


class ReferenceContextTests(unittest.TestCase):
    def test_followup_explanations_use_server_references_not_client_claimed_sources(self):
        from thai_interpretation import meaning_context

        result = meaning_context(
            {
                "thai_mode": "northern",
                "interpretation": {
                    "standard_thai": "พ่อมึงเหรอ",
                    "references": [{"url": "https://attacker.invalid"}],
                },
            },
            "ป่อคิงหยัง",
        )
        self.assertEqual(result["published_references"][0]["id"], "northern-retort-parent")
        self.assertNotIn("attacker.invalid", json.dumps(result))
