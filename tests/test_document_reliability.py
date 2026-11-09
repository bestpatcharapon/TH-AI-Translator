"""Offline regressions for blank pages and request-scoped PDF OCR cleanup."""

import base64
import io
import os
import threading
import unittest
from concurrent.futures import Future, ThreadPoolExecutor, wait
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pymupdf
from openai import OpenAIError
from PIL import Image

import document_ocr
import services
from document_ocr import NoReadableTextError


def completion(text, reason="stop"):
    return SimpleNamespace(
        choices=[SimpleNamespace(finish_reason=reason, message=SimpleNamespace(content=text))]
    )


def pdf_bytes(*texts):
    with pymupdf.open() as document:
        for index, text in enumerate(texts):
            page = document.new_page(width=100 + index * 10, height=100)
            if text:
                page.insert_text((10, 30), text)
        return document.tobytes()


def image_bytes():
    output = io.BytesIO()
    Image.new("RGB", (100, 100), "white").save(output, format="PNG")
    return output.getvalue()


class DocumentReliabilityTests(unittest.TestCase):
    def setUp(self):
        env = patch.dict(
            os.environ,
            {
                "DOCUMENT_OCR_PROVIDER": "typhoon",
                "TYPHOON_OCR_API_KEY": "offline-only",
                "TYPHOON_OCR_MODEL": "typhoon-ocr",
                "TYPHOON_BASE_URL": "https://api.opentyphoon.ai/v1",
                "TYPHOON_OCR_TIMEOUT_SECONDS": "45",
                "TYPHOON_OCR_MAX_TOKENS": "8192",
            },
        )
        env.start()
        self.addCleanup(env.stop)
        document_ocr._page_cache.clear()
        self.addCleanup(document_ocr._page_cache.clear)
        provider = patch.object(document_ocr, "_typhoon_client")
        self.create = provider.start().return_value.chat.completions.create
        self.addCleanup(provider.stop)

    def test_only_successfully_completed_blank_text_has_specific_error(self):
        self.assertTrue(issubclass(NoReadableTextError, ValueError))
        for text in ("", " \n\t", "```markdown\n \n```"):
            with self.subTest(text=text):
                self.create.return_value = completion(text)
                with self.assertRaises(NoReadableTextError):
                    document_ocr.read_typhoon_image(b"validated-image")

    def test_text_and_blank_scanned_pages_keep_document_order(self):
        self.create.return_value = completion(" \n")
        text = services.extract_file(
            pdf_bytes("", "First", "", "Last", ""), "mixed.pdf", "document"
        )
        self.assertEqual(text, "First\n\nLast")
        self.assertEqual(self.create.call_count, 3)

    def test_scanned_text_and_blank_page_keep_text(self):
        def transcribe(**kwargs):
            url = kwargs["messages"][0]["content"][1]["image_url"]["url"]
            with Image.open(io.BytesIO(base64.b64decode(url.split(",", 1)[1]))) as image:
                return completion("Scanned text" if image.width == 300 else "")

        self.create.side_effect = transcribe
        self.assertEqual(
            services.extract_file(pdf_bytes("", ""), "scans.pdf", "document"),
            "Scanned text",
        )
        self.assertEqual(self.create.call_count, 2)

    def test_entire_blank_pdf_is_rejected_by_final_text_validation(self):
        self.create.return_value = completion("")
        with self.assertRaisesRegex(ValueError, "ไม่พบข้อความในไฟล์") as raised:
            services.extract_file(pdf_bytes("", ""), "blank.pdf", "document")
        self.assertIs(type(raised.exception), ValueError)
        self.assertEqual(self.create.call_count, 2)

    def test_standalone_blank_image_still_errors(self):
        self.create.return_value = completion("")
        with self.assertRaises(NoReadableTextError):
            services.extract_file(image_bytes(), "blank.png", "image")

    def test_groq_blank_page_remains_empty_and_blank_image_still_errors(self):
        client = MagicMock()
        client.chat.completions.create.return_value = completion("")
        with patch.dict(os.environ, {"DOCUMENT_OCR_PROVIDER": "groq"}):
            self.assertEqual(
                services.extract_file(
                    pdf_bytes("First", "", "Last"), "mixed.pdf", "document", client
                ),
                "First\n\nLast",
            )
            with self.assertRaisesRegex(ValueError, "ไม่พบข้อความในไฟล์"):
                services.extract_file(pdf_bytes("", ""), "blank.pdf", "document", client)
            with self.assertRaises(ValueError):
                services.extract_file(image_bytes(), "blank.png", "image", client)
        self.create.assert_not_called()

    def test_pdf_does_not_treat_invalid_completions_as_blank(self):
        for response, error_type in (
            (completion("", "length"), ValueError),
            (completion("partial", "length"), ValueError),
            (completion(None), RuntimeError),
            (completion("refused", "content_filter"), RuntimeError),
            (SimpleNamespace(choices=[]), RuntimeError),
            (completion("x" * (document_ocr.MAX_TEXT + 1)), ValueError),
        ):
            with self.subTest(response=response):
                self.create.return_value = response
                with self.assertRaises(error_type) as raised:
                    services.extract_file(pdf_bytes("Text", ""), "invalid.pdf", "document")
                self.assertNotIsInstance(raised.exception, NoReadableTextError)

    def test_pdf_preserves_original_worker_errors(self):
        for failure in (
            ValueError("truncated"),
            RuntimeError("malformed"),
            OpenAIError("provider"),
        ):
            with (
                self.subTest(failure=failure),
                patch.object(services, "read_image", side_effect=failure),
            ):
                with self.assertRaises(type(failure)) as raised:
                    services.extract_file(pdf_bytes("Text", ""), "error.pdf", "document")
                self.assertIs(raised.exception, failure)

    def test_failure_waits_for_running_sibling_without_replacing_original_error(self):
        for sibling_fails in (False, True):
            with self.subTest(sibling_fails=sibling_fails):
                second_started = threading.Event()
                release = threading.Event()
                draining = threading.Event()
                sibling_finished = threading.Event()
                failure = ValueError("original failure")
                calls = []

                def read_image(data, client):
                    with Image.open(io.BytesIO(data)) as image:
                        width = image.width
                    calls.append(width)
                    if width == 300:
                        if not second_started.wait(5):
                            raise AssertionError("Second worker did not start")
                        raise failure
                    second_started.set()
                    if not release.wait(5):
                        raise AssertionError("Sibling was not released")
                    sibling_finished.set()
                    if sibling_fails:
                        raise RuntimeError("sibling failure must not replace original")
                    return "sibling text"

                def drain(futures):
                    draining.set()
                    return wait(futures)

                with (
                    ThreadPoolExecutor(max_workers=2) as workers,
                    ThreadPoolExecutor(max_workers=1) as requests,
                    patch.object(services, "_pdf_ocr_pool", workers),
                    patch.object(services, "read_image", side_effect=read_image),
                    patch.object(services, "wait", side_effect=drain),
                ):
                    request = requests.submit(
                        services.extract_file, pdf_bytes("", "", ""), "scan.pdf", "document"
                    )
                    try:
                        self.assertTrue(draining.wait(5), "Request did not enter cleanup")
                        self.assertFalse(
                            request.done(), "Request returned with provider work running"
                        )
                        self.assertFalse(sibling_finished.is_set())
                        self.assertEqual(sorted(calls), [300, 330])
                    finally:
                        release.set()
                    with self.assertRaises(ValueError) as raised:
                        request.result(timeout=5)
                    self.assertIs(raised.exception, failure)
                    self.assertTrue(sibling_finished.is_set())

    def test_failure_cancels_queued_sibling(self):
        failure = RuntimeError("original failure")
        failed = Future()
        failed.set_exception(failure)
        queued = Future()
        pool = MagicMock()
        pool.submit.side_effect = [failed, queued]

        def drain(futures):
            self.assertEqual(futures, [queued])
            self.assertTrue(queued.cancelled())
            # Executors notify waiters when they dequeue a cancelled future.
            self.assertFalse(queued.set_running_or_notify_cancel())
            return wait(futures)

        with (
            patch.object(services, "_pdf_ocr_pool", pool),
            patch.object(services, "wait", side_effect=drain),
        ):
            with self.assertRaises(RuntimeError) as raised:
                services.extract_file(pdf_bytes("", "", ""), "scan.pdf", "document")
        self.assertIs(raised.exception, failure)
        self.assertEqual(pool.submit.call_count, 2)

    def test_two_running_workers_preserve_page_order(self):
        second_finished = threading.Event()
        calls = []

        def read_image(data, client):
            with Image.open(io.BytesIO(data)) as image:
                width = image.width
            calls.append(width)
            if width == 300:
                if not second_finished.wait(5):
                    raise AssertionError("Second page did not run in parallel")
                return "First scan"
            second_finished.set()
            return "Second scan"

        with (
            ThreadPoolExecutor(max_workers=2) as workers,
            patch.object(services, "_pdf_ocr_pool", workers),
            patch.object(services, "read_image", side_effect=read_image),
        ):
            self.assertEqual(
                services.extract_file(pdf_bytes("", "", "Last"), "ordered.pdf", "document"),
                "First scan\n\nSecond scan\n\nLast",
            )
        self.assertEqual(sorted(calls), [300, 330])
