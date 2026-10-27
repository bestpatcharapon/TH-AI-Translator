import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from openai import OpenAIError
from test_app import completion

import app as server
from dialect_references import corpus_references, lexical_references, normalize
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
