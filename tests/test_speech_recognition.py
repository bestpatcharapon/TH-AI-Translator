import io
import unittest
import wave
from types import SimpleNamespace
from unittest.mock import patch

from openai.types.audio.transcription_segment import TranscriptionSegment
from test_app import completion

import app as server
from speech_recognition import transcript_result


def result(text="สวัสดีครับ", **values):
    return SimpleNamespace(
        text=text,
        segments=[dict(no_speech_prob=0.01, avg_logprob=-0.2, compression_ratio=1.2, **values)],
    )


class SpeechQualityTests(unittest.TestCase):
    def test_observed_slang_confusions_require_review_even_with_clear_segment_scores(self):
        text = "ฉันอยู่ 2 ดอมเมนของฉันคือมือกล่อง"
        reading = transcript_result(result(text=text), "model")
        self.assertEqual(reading["text"], text)
        self.assertTrue(reading["review_required"])
        self.assertIn("possible_word_confusion", reading["review_reasons"])
        for ordinary in (
            "ฉันจดโดเมนใหม่",
            "กล่องใบนี้หนัก",
            "เมนของฉันคือมือกลอง",
            "จดดอมเมนเนมสำหรับเซิร์ฟเวอร์",
            "แกะมือกล่องกระดาษ",
        ):
            self.assertFalse(transcript_result(result(text=ordinary), "model")["review_required"])

    def test_pcm_silence_is_rejected_without_requesting_the_provider(self):
        audio = io.BytesIO()
        with wave.open(audio, "wb") as output:
            output.setnchannels(1)
            output.setsampwidth(2)
            output.setframerate(16000)
            output.writeframes(b"\0\0" * 16000)
        with patch.object(server, "get_client") as provider:
            response = server.app.test_client().post(
                "/api/transcribe",
                data={"language": "th", "file": (io.BytesIO(audio.getvalue()), "silence.wav")},
            )
            self.assertEqual(response.status_code, 400)
            provider.assert_not_called()

    def test_sdk_segment_objects_are_read_as_evidence(self):
        sample = result()
        sample.segments = [
            TranscriptionSegment(
                id=0,
                seek=0,
                start=0,
                end=1,
                text=sample.text,
                tokens=[],
                temperature=0,
                avg_logprob=-0.2,
                compression_ratio=1.2,
                no_speech_prob=0.01,
            )
        ]
        self.assertFalse(transcript_result(sample, "model")["review_required"])

    def test_clear_audio_has_no_review_flag_but_no_accuracy_claim(self):
        reading = transcript_result(result(), "model")
        self.assertFalse(reading["review_required"])
        self.assertEqual(reading["text"], "สวัสดีครับ")
        self.assertNotIn("accuracy", reading)

    def test_missing_unreliable_or_repetitive_evidence_requires_review(self):
        for field, value, reason in (
            ("avg_logprob", -1.1, "unclear_audio"),
            ("no_speech_prob", 0.7, "possible_silence"),
            ("compression_ratio", 3.2, "repetition"),
            ("avg_logprob", float("nan"), "no_metadata"),
        ):
            sample = result()
            sample.segments[0][field] = value
            reading = transcript_result(sample, "model")
            self.assertTrue(reading["review_required"])
            self.assertIn(reason, reading["review_reasons"])

    def test_silence_hallucination_and_empty_text_are_not_sent_as_transcripts(self):
        silent = result()
        silent.segments[0].update(no_speech_prob=0.98, avg_logprob=-1.6)
        for sample in (silent, result(text="")):
            with self.assertRaises(ValueError):
                transcript_result(sample, "model")

    def test_mixed_clear_and_unclear_speech_is_kept_for_review(self):
        sample = result()
        sample.segments.append(dict(no_speech_prob=0.95, avg_logprob=-1.4, compression_ratio=1))
        reading = transcript_result(sample, "model")
        self.assertEqual(reading["text"], sample.text)
        self.assertTrue(reading["review_required"])

    def test_api_requests_segment_evidence_in_source_language(self):
        with patch.object(server, "get_client") as client:
            client.return_value.audio.transcriptions.create.return_value = result()
            response = server.app.test_client().post(
                "/api/transcribe",
                data={"language": "th", "file": (io.BytesIO(b"quality-audio"), "voice.webm")},
            )
            self.assertEqual(response.status_code, 200)
            self.assertFalse(response.get_json()["review_required"])
            options = client.return_value.audio.transcriptions.create.call_args.kwargs
            self.assertEqual(options["language"], "th")
            self.assertEqual(options["temperature"], 0)
            self.assertEqual(options["response_format"], "verbose_json")

    def test_live_translation_has_its_own_speech_policy_without_changing_text_mode(self):
        client = server.app.test_client()
        for scope, expected in (("live", True), ("text", False)):
            with patch.object(server, "get_client") as provider:
                provider.return_value.chat.completions.create.return_value = completion(
                    "I like people who…"
                )
                response = client.post(
                    "/api/translate",
                    json={
                        "text": "ผมชอบคนที่…",
                        "source": "th",
                        "target": "en",
                        "cache_scope": scope,
                    },
                )
                self.assertEqual(response.status_code, 200)
                options = provider.return_value.chat.completions.create.call_args_list[0].kwargs
                self.assertEqual(
                    "Keep unfinished phrases unfinished" in options["messages"][0]["content"],
                    expected,
                )
                if expected:
                    self.assertEqual(options["reasoning_effort"], server.CHAT_REASONING_EFFORT)
