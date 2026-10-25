import asyncio
import io
import json
import unittest
from unittest.mock import patch

import edge_tts
from test_speech_recognition import result

import app as server
import services
from speech_recognition import transcription_prompt


class SpeechPlaybackTests(unittest.IsolatedAsyncioTestCase):
    async def test_primary_success_does_not_request_another_voice(self):
        class Stream:
            async def stream(self):
                yield {"type": "audio", "data": b"first"}
                yield {"type": "audio", "data": b"second"}

        with patch.object(services.edge_tts, "Communicate", return_value=Stream()) as provider:
            self.assertEqual(await services.create_speech("hello", "en"), b"firstsecond")
            self.assertEqual(provider.call_count, 1)

    async def test_partial_failed_audio_is_discarded_before_fallback(self):
        class Failed:
            async def stream(self):
                yield {"type": "audio", "data": b"discard-me"}
                raise edge_tts.exceptions.NoAudioReceived("temporary")

        class Success:
            async def stream(self):
                yield {"type": "audio", "data": b"complete-audio"}

        with patch.object(
            services.edge_tts, "Communicate", side_effect=[Failed(), Success()]
        ) as provider:
            self.assertEqual(await services.create_speech("สวัสดี", "th"), b"complete-audio")
            self.assertEqual(provider.call_count, 2)
            self.assertEqual(provider.call_args_list[1].args[1], "th-TH-NiwatNeural")

    async def test_empty_audio_has_a_bounded_retry_and_still_reports_failure(self):
        class Empty:
            async def stream(self):
                yield {"type": "metadata"}

        with patch.object(services.edge_tts, "Communicate", return_value=Empty()) as provider:
            with self.assertRaises(edge_tts.exceptions.NoAudioReceived):
                await services.create_speech("hello", "en")
            self.assertEqual(provider.call_count, 2)

    async def test_cancellation_does_not_start_fallback(self):
        class Canceled:
            async def stream(self):
                raise asyncio.CancelledError()
                yield

        with patch.object(services.edge_tts, "Communicate", return_value=Canceled()) as provider:
            with self.assertRaises(asyncio.CancelledError):
                await services.create_speech("hello", "en")
            self.assertEqual(provider.call_count, 1)


class VocabularyTests(unittest.TestCase):
    def test_small_vocabulary_is_normalized_and_deduplicated(self):
        self.assertEqual(transcription_prompt(None), "")
        self.assertEqual(
            transcription_prompt(json.dumps([" NECTEC ", "เชียงใหม่", "NECTEC"])), "NECTEC, เชียงใหม่"
        )

    def test_invalid_or_oversize_vocabulary_is_rejected(self):
        for words in ("invalid", {}, [1], [""], ["line\nbreak"], ["ก" * 80], ["a"] * 17):
            with self.assertRaises(ValueError):
                transcription_prompt(words if words == "invalid" else json.dumps(words))

    def test_vocabulary_reaches_whisper_and_separates_cached_results(self):
        client = server.app.test_client()
        with patch.object(server, "get_client") as provider:
            provider.return_value.audio.transcriptions.create.return_value = result()
            for terms in (["NECTEC"], ["Groq"]):
                response = client.post(
                    "/api/transcribe",
                    data={
                        "language": "th",
                        "vocabulary": json.dumps(terms),
                        "file": (io.BytesIO(b"vocabulary-audio"), "voice.webm"),
                    },
                )
                self.assertEqual(response.status_code, 200)
                options = provider.return_value.audio.transcriptions.create.call_args.kwargs
                self.assertEqual(options["prompt"], terms[0])
                self.assertEqual(options["language"], "th")
            self.assertEqual(provider.return_value.audio.transcriptions.create.call_count, 2)


class TranscriptVerificationTests(unittest.TestCase):
    def test_disagreement_preserves_primary_and_requires_review(self):
        from speech_recognition import compare_transcripts, transcript_result

        reading = compare_transcripts(
            transcript_result(result(text="ราคา 50 บาท"), "primary"),
            transcript_result(result(text="ราคา 5 บาท"), "secondary"),
        )
        self.assertEqual(reading["text"], "ราคา 50 บาท")
        self.assertEqual(reading["alternative_text"], "ราคา 5 บาท")
        self.assertTrue(reading["review_required"])
        self.assertIn("model_disagreement", reading["review_reasons"])

    def test_case_spacing_and_punctuation_are_not_word_disagreements(self):
        from speech_recognition import compare_transcripts, transcript_result

        reading = compare_transcripts(
            transcript_result(result(text="Hello, H. M.!"), "primary"),
            transcript_result(result(text="hello h.m."), "secondary"),
        )
        self.assertFalse(reading["review_required"])

    def test_live_verification_uses_another_model_and_gates_disagreement(self):
        with (
            patch.object(server, "get_client") as provider,
            patch.object(server, "SPEECH_VERIFY_MODEL", "whisper-large-v3-turbo"),
            patch.object(server, "SPEECH_MODEL", "whisper-large-v3"),
        ):
            provider.return_value.audio.transcriptions.create.return_value = result(
                text="table for two"
            )
            secondary = provider.return_value.with_options.return_value.audio.transcriptions.create
            secondary.return_value = result(text="table for four")
            response = server.app.test_client().post(
                "/api/transcribe",
                data={
                    "language": "en",
                    "verify": "1",
                    "file": (io.BytesIO(b"cross-check-audio"), "voice.webm"),
                },
            )
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json["text"], "table for two")
            self.assertTrue(response.json["review_required"])
            self.assertEqual(response.json["verification_model"], "whisper-large-v3-turbo")
            self.assertEqual(secondary.call_count, 1)

    def test_verification_failure_is_reviewable_and_is_not_cached(self):
        with (
            patch.object(server, "get_client") as provider,
            patch.object(server, "SPEECH_VERIFY_MODEL", "other-model"),
        ):
            provider.return_value.audio.transcriptions.create.return_value = result()
            provider.return_value.with_options.return_value.audio.transcriptions.create.side_effect = TimeoutError()
            for _ in range(2):
                response = server.app.test_client().post(
                    "/api/transcribe",
                    data={
                        "language": "th",
                        "verify": "1",
                        "file": (io.BytesIO(b"unavailable-verification-audio"), "voice.webm"),
                    },
                )
                self.assertEqual(response.status_code, 200)
                self.assertTrue(response.json["review_required"])
                self.assertIn("verification_unavailable", response.json["review_reasons"])
            self.assertEqual(provider.return_value.audio.transcriptions.create.call_count, 2)
