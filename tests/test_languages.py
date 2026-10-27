import io
import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import app as server
from language_catalog import CATALOG
from services import detect_language


class LanguageCoverageTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()

    def test_catalog_and_frontend_share_choices(self):
        choices = self.client.get("/api/languages").get_json()
        self.assertGreater(len(choices), 100)
        script = self.client.get("/api/language-catalog.js")
        self.assertEqual(script.mimetype, "application/javascript")
        payload = json.loads(
            script.text.removeprefix("const LANGUAGE_CATALOG = ").removesuffix(";")
        )
        self.assertEqual(set(payload), set(choices))

    def test_new_languages_and_chinese_scripts_reach_translation_prompt(self):
        for code in ["lo", "my", "km", "ar", "hi", "pt", "zh", "zh-TW"]:
            with self.subTest(language=code), patch.object(server, "get_client") as client:
                client.return_value.chat.completions.create.return_value = SimpleNamespace(
                    choices=[
                        SimpleNamespace(
                            message=SimpleNamespace(content="translated"), finish_reason="stop"
                        )
                    ]
                )
                result = self.client.post(
                    "/api/translate", json={"text": "สวัสดี", "source": "th", "target": code}
                )
                self.assertEqual(result.status_code, 200)
                prompt = client.return_value.chat.completions.create.call_args.kwargs["messages"][
                    0
                ]["content"]
                self.assertIn(CATALOG[code]["name"], prompt)
        self.assertNotEqual(CATALOG["zh"]["name"], CATALOG["zh-TW"]["name"])

    def test_detection_is_not_limited_to_languages_with_speech_voices(self):
        for text, expected in [("ສະບາຍດີ", "lo"), ("မင်္ဂလာပါ", "my"), ("សួស្តី", "km")]:
            self.assertEqual(detect_language(text), expected)
        with patch("services.detect", return_value="la"):
            self.assertEqual(detect_language("Salve amice"), "la")
        with patch("services.detect", return_value="zh-tw"):
            self.assertEqual(detect_language("您好"), "zh-TW")

    def test_unsupported_auto_photo_language_does_not_use_the_wrong_ocr(self):
        from test_photo_translation import image_file

        with (
            patch("photo_translation.photo_language", return_value="haw"),
            patch("photo_translation.positioned_text") as ocr,
            patch.object(server, "get_client"),
        ):
            result = self.client.post(
                "/api/photo-translate",
                data={
                    "source": "auto",
                    "target": "th",
                    "file": (io.BytesIO(image_file()), "photo.png"),
                },
            )
            self.assertEqual(result.status_code, 400)
            self.assertIn("รูป", result.get_json()["error"])
            ocr.assert_not_called()

    def test_transcription_maps_language_variants(self):
        for code, whisper in [("zh-TW", "zh"), ("jv", "jw"), ("ar", "ar")]:
            with self.subTest(language=code), patch.object(server, "get_client") as client:
                client.return_value.audio.transcriptions.create.return_value = SimpleNamespace(
                    text="spoken words"
                )
                result = self.client.post(
                    "/api/transcribe",
                    data={"language": code, "file": (io.BytesIO(b"audio"), "voice.webm")},
                )
                self.assertEqual(result.status_code, 200)
                self.assertEqual(
                    client.return_value.audio.transcriptions.create.call_args.kwargs["language"],
                    whisper,
                )

    def test_unavailable_features_return_actionable_errors_before_provider_calls(self):
        with patch.object(server, "get_client") as client:
            result = self.client.post(
                "/api/transcribe",
                data={"language": "zu", "file": (io.BytesIO(b"audio"), "voice.webm")},
            )
            self.assertEqual(result.status_code, 400)
            self.assertIn("พิมพ์", result.get_json()["error"])
            result = self.client.post(
                "/api/photo-translate",
                data={"source": "haw", "target": "th", "file": (io.BytesIO(b"photo"), "photo.png")},
            )
            self.assertEqual(result.status_code, 400)
            self.assertIn("รูป", result.get_json()["error"])
            client.assert_not_called()
        with patch.object(server, "create_speech") as speech:
            result = self.client.post("/api/speech", json={"text": "Salve", "language": "la"})
            self.assertEqual(result.status_code, 400)
            self.assertIn("เสียงอ่าน", result.get_json()["error"])
            speech.assert_not_called()
