"""Typhoon is opt-in, credential-isolated, and never used for text-bearing files."""

import base64
import io
import os
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from typing import cast
from unittest.mock import MagicMock, patch

import httpx2
import pymupdf
from openai import APIStatusError, OpenAIError
from test_app import completion, docx_bytes, pdf_bytes
from test_photo_translation import image_file

import app as server
import document_ocr
from services import extract_file


class DocumentOCRTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(
            os.environ,
            {
                "DOCUMENT_OCR_PROVIDER": "typhoon",
                "TYPHOON_OCR_API_KEY": "test-only",
                "TYPHOON_API_KEY": "",
                "TYPHOON_OCR_MODEL": "typhoon-ocr",
                "TYPHOON_BASE_URL": "https://api.opentyphoon.ai/v1",
                "TYPHOON_OCR_TIMEOUT_SECONDS": "45",
                "TYPHOON_OCR_MAX_TOKENS": "8192",
            },
        )
        self.env.start()
        self.addCleanup(self.env.stop)
        server._extraction_cache.clear()
        self.addCleanup(server._extraction_cache.clear)
        document_ocr._page_cache.clear()
        self.addCleanup(document_ocr._page_cache.clear)

    def test_typhoon_request_and_markdown_are_preserved(self):
        with patch.object(document_ocr, "_typhoon_client") as provider:
            provider.return_value.chat.completions.create.return_value = completion(
                "```markdown\n# รายการ\n|สินค้า|ราคา|\n|---|---|\n|ข้าว|50|\n```"
            )
            text = extract_file(
                image_file(),
                "scan.png",
                "image",
                client_factory=lambda: self.fail("Groq client must stay lazy"),
            )
        self.assertTrue(text.startswith("# รายการ"))
        self.assertIn("|ข้าว|50|", text)
        options = provider.return_value.chat.completions.create.call_args.kwargs
        self.assertEqual(options["model"], "typhoon-ocr")
        self.assertEqual(options["max_tokens"], 8192)
        self.assertNotIn("reasoning_effort", options)
        url = options["messages"][0]["content"][1]["image_url"]["url"]
        self.assertTrue(url.startswith("data:image/png;base64,"))
        self.assertTrue(base64.b64decode(url.split(",", 1)[1]).startswith(b"\x89PNG\r\n\x1a\n"))
        provider.assert_called_once_with("test-only", "https://api.opentyphoon.ai/v1", 45.0)

    def test_text_formats_need_neither_provider_nor_valid_ocr_configuration(self):
        with (
            patch.dict(os.environ, {"DOCUMENT_OCR_PROVIDER": "invalid"}),
            patch.object(document_ocr, "_typhoon_client") as provider,
        ):
            for data, name in [
                (b"Hello", "note.txt"),
                (docx_bytes(), "note.docx"),
                (pdf_bytes(), "note.pdf"),
            ]:
                with self.subTest(name=name):
                    self.assertTrue(
                        extract_file(
                            data, name, "document", client_factory=lambda: self.fail("No AI needed")
                        )
                    )
            provider.assert_not_called()

    def test_scanned_pdf_uses_typhoon_without_groq(self):
        with patch.object(document_ocr, "_typhoon_client") as provider:
            provider.return_value.chat.completions.create.return_value = completion("ข้อความสแกน")
            text = extract_file(
                pdf_bytes(pages=2, scanned=True),
                "scan.pdf",
                "document",
                client_factory=lambda: self.fail("No Groq credentials needed"),
            )
        self.assertEqual(text, "ข้อความสแกน\n\nข้อความสแกน")
        self.assertEqual(provider.return_value.chat.completions.create.call_count, 1)

    def test_missing_keys_do_not_use_groq_or_openai_keys(self):
        with (
            patch.dict(
                os.environ,
                {"TYPHOON_OCR_API_KEY": "", "TYPHOON_API_KEY": "", "OPENAI_API_KEY": "unrelated"},
            ),
            patch.object(document_ocr, "_typhoon_client") as provider,
        ):
            with self.assertRaisesRegex(RuntimeError, "TYPHOON_OCR_API_KEY"):
                extract_file(image_file(), "scan.png", "image")
            provider.assert_not_called()

    def test_malformed_image_fails_before_resolving_credentials(self):
        with patch.object(document_ocr, "_typhoon_client") as provider:
            with self.assertRaises(ValueError):
                extract_file(b"not-an-image", "scan.png", "image")
            provider.assert_not_called()

    def test_invalid_configuration_and_urls_are_rejected_without_secrets(self):
        for key, value in [
            ("DOCUMENT_OCR_PROVIDER", "other"),
            ("TYPHOON_OCR_TIMEOUT_SECONDS", "nan"),
            ("TYPHOON_OCR_TIMEOUT_SECONDS", "0"),
            ("TYPHOON_OCR_TIMEOUT_SECONDS", "121"),
            ("TYPHOON_OCR_MAX_TOKENS", "0"),
            ("TYPHOON_OCR_MAX_TOKENS", "16385"),
            ("TYPHOON_OCR_MODEL", ""),
            ("TYPHOON_OCR_MODEL", "typhoon-ocr-preview"),
            ("TYPHOON_BASE_URL", "https://user:private-secret@example.com/v1"),
            ("TYPHOON_BASE_URL", "https://example.com/v1?token=private-secret"),
            ("TYPHOON_BASE_URL", "file:///tmp/private-secret"),
        ]:
            with self.subTest(key=key, value=value), patch.dict(os.environ, {key: value}):
                with self.assertRaises(RuntimeError) as raised:
                    document_ocr.document_ocr_identity()
                self.assertNotIn("private-secret", str(raised.exception))

    def test_rejected_responses_do_not_return_partial_success(self):
        for text, reason in [
            ("partial", "length"),
            ("", "stop"),
            ("x" * 30001, "stop"),
            ("refused", "content_filter"),
            (None, "stop"),
            ("```markdown\n   \n```", "stop"),
        ]:
            with (
                self.subTest(
                    reason=reason, text_length=len(text) if isinstance(text, str) else None
                ),
                patch.object(document_ocr, "_typhoon_client") as provider,
            ):
                provider.return_value.chat.completions.create.return_value = completion(
                    text, reason
                )
                create = provider.return_value.chat.completions.create
                for _ in range(2):
                    with self.assertRaises((ValueError, RuntimeError)):
                        document_ocr.read_typhoon_image(b"prepared-jpeg")
                self.assertEqual(create.call_count, 2)

    def test_http_cache_does_not_bypass_account_changes_or_missing_credentials(self):
        client = server.app.test_client()
        payload = image_file()
        with patch.object(document_ocr, "_typhoon_client") as provider:
            create = provider.return_value.chat.completions.create
            create.side_effect = [completion("Account A"), completion("Account B")]

            def extract():
                return client.post(
                    "/api/extract",
                    data={"kind": "image", "file": (io.BytesIO(payload), "account.png")},
                )

            self.assertEqual(extract().get_json()["text"], "Account A")
            with patch.dict(os.environ, {"TYPHOON_OCR_API_KEY": "account-b"}):
                document_ocr._page_cache.clear()
                self.assertEqual(extract().get_json()["text"], "Account B")
            with patch.dict(os.environ, {"TYPHOON_OCR_API_KEY": "", "TYPHOON_API_KEY": ""}):
                self.assertEqual(extract().status_code, 503)
            self.assertEqual(create.call_count, 2)

    def test_page_cache_reuses_validated_markdown_until_ttl_expires(self):
        cache = document_ocr._page_cache
        self.assertEqual(
            (cache.max_entries, cache.max_bytes, cache.ttl), (24, 4 * 1024 * 1024, 300)
        )
        with (
            patch.object(document_ocr, "_typhoon_client") as provider,
            patch("performance.time.monotonic", return_value=100) as clock,
        ):
            create = provider.return_value.chat.completions.create
            create.side_effect = [completion("```md\n# ผ่าน\n```"), completion("ใหม่")]
            self.assertEqual(document_ocr.read_typhoon_image(b"page"), "# ผ่าน")
            clock.return_value = 399
            self.assertEqual(document_ocr.read_typhoon_image(b"page"), "# ผ่าน")
            self.assertEqual(create.call_count, 1)
            clock.return_value = 400
            self.assertEqual(document_ocr.read_typhoon_image(b"page"), "ใหม่")
            self.assertEqual(create.call_count, 2)
            self.assertEqual(provider.call_count, 3)

    def test_page_cache_entry_and_byte_bounds(self):
        cache = document_ocr._page_cache
        with patch.object(document_ocr, "_typhoon_client") as provider:
            create = provider.return_value.chat.completions.create
            create.return_value = completion("cached")
            for page in range(25):
                document_ocr.read_typhoon_image(str(page).encode())
            self.assertEqual(len(cache._entries), 24)
            document_ocr.read_typhoon_image(b"24")
            self.assertEqual(create.call_count, 25)
            document_ocr.read_typhoon_image(b"0")
            self.assertEqual(create.call_count, 26)

            cache.clear()
            create.reset_mock()
            # Exercise the byte limit independently of the usual text-size limit.
            with patch.object(document_ocr, "MAX_TEXT", 1_100_000):
                create.return_value = completion("ก" * 350_000)
                for page in range(5):
                    document_ocr.read_typhoon_image(str(page).encode())
                self.assertLess(cache._bytes, cache.max_bytes)
                self.assertEqual(len(cache._entries), 3)
                document_ocr.read_typhoon_image(b"4")
                self.assertEqual(create.call_count, 5)
                document_ocr.read_typhoon_image(b"0")
                self.assertEqual(create.call_count, 6)
                cache.clear()
                create.return_value = completion("large" * 220_000)
                # An otherwise valid result larger than max_bytes is never retained.
                with patch.object(cache, "max_bytes", 100):
                    for _ in range(2):
                        document_ocr.read_typhoon_image(b"oversized")
                self.assertFalse(cache._entries)
                self.assertEqual(create.call_count, 8)

    def test_page_cache_isolates_image_and_all_nonsecret_settings(self):
        with patch.object(document_ocr, "_typhoon_client") as provider:
            create = provider.return_value.chat.completions.create
            create.return_value = completion("baseline")
            self.assertEqual(document_ocr.read_typhoon_image(b"page"), "baseline")
            for setting, value in [
                ("TYPHOON_OCR_MODEL", "other-model"),
                ("TYPHOON_BASE_URL", "https://other.example/v1"),
                ("TYPHOON_OCR_TIMEOUT_SECONDS", "20"),
                ("TYPHOON_OCR_MAX_TOKENS", "1024"),
            ]:
                with self.subTest(setting=setting), patch.dict(os.environ, {setting: value}):
                    create.return_value = completion(setting)
                    self.assertEqual(document_ocr.read_typhoon_image(b"page"), setting)
            create.return_value = completion("different image")
            self.assertEqual(document_ocr.read_typhoon_image(b"different"), "different image")
            self.assertEqual(document_ocr.read_typhoon_image(b"page"), "baseline")
            self.assertEqual(create.call_count, 6)
            for key in document_ocr._page_cache._entries:
                digest, client = cast(tuple[bytes, object], key)
                self.assertIsInstance(digest, bytes)
                self.assertEqual(len(digest), 32)
                self.assertIs(client, provider.return_value)
                self.assertNotIn(b"test-only", digest)

    def test_page_cache_isolates_accounts_and_replacement_mock_clients(self):
        first, second = MagicMock(), MagicMock()
        first.chat.completions.create.return_value = completion("first account")
        second.chat.completions.create.return_value = completion("second account")
        with patch.object(document_ocr, "_typhoon_client") as provider:
            provider.side_effect = lambda key, url, timeout: first if key == "test-only" else second
            self.assertEqual(document_ocr.read_typhoon_image(b"page"), "first account")
            with patch.dict(os.environ, {"TYPHOON_OCR_API_KEY": "other-account"}):
                self.assertEqual(document_ocr.read_typhoon_image(b"page"), "second account")
            self.assertEqual(document_ocr.read_typhoon_image(b"page"), "first account")
            first.chat.completions.create.assert_called_once()
            second.chat.completions.create.assert_called_once()
        with patch.object(document_ocr, "_typhoon_client") as replacement:
            replacement.return_value.chat.completions.create.return_value = completion("new mock")
            self.assertEqual(document_ocr.read_typhoon_image(b"page"), "new mock")
            replacement.return_value.chat.completions.create.assert_called_once()

    def test_page_cache_deduplicates_concurrent_requests(self):
        entered, release = threading.Event(), threading.Event()
        ready = threading.Barrier(5)
        cache_run = document_ocr._page_cache.run

        def run(*args, **kwargs):
            ready.wait(timeout=5)
            return cache_run(*args, **kwargs)

        def produce(**kwargs):
            entered.set()
            if not release.wait(timeout=5):
                raise AssertionError("OCR producer was not released")
            return completion("shared page")

        with (
            patch.object(document_ocr, "_typhoon_client") as provider,
            patch.object(document_ocr._page_cache, "run", side_effect=run),
            ThreadPoolExecutor(max_workers=5) as pool,
        ):
            create = provider.return_value.chat.completions.create
            create.side_effect = produce
            pending = [pool.submit(document_ocr.read_typhoon_image, b"same page") for _ in range(5)]
            try:
                self.assertTrue(entered.wait(timeout=5))
                self.assertEqual(len(document_ocr._page_cache._inflight), 1)
                self.assertFalse(document_ocr._page_cache._entries)
            finally:
                release.set()
            self.assertEqual([future.result(timeout=5) for future in pending], ["shared page"] * 5)
            create.assert_called_once()

    def test_png_mime_is_sent_and_isolated_from_default_jpeg(self):
        data = image_file()
        with patch.object(document_ocr, "_typhoon_client") as provider:
            create = provider.return_value.chat.completions.create
            create.side_effect = [completion("PNG"), completion("JPEG")]
            self.assertEqual(document_ocr.read_typhoon_image(data, mime_type="image/png"), "PNG")
            url = create.call_args.kwargs["messages"][0]["content"][1]["image_url"]["url"]
            self.assertTrue(url.startswith("data:image/png;base64,"))
            self.assertEqual(base64.b64decode(url.split(",", 1)[1]), data)
            # Image decoding/normalization belongs to the caller, not this adapter.
            self.assertEqual(document_ocr.read_typhoon_image(data), "JPEG")
            self.assertEqual(document_ocr.read_typhoon_image(data, mime_type="image/png"), "PNG")
            self.assertEqual(create.call_count, 2)

    def test_empty_input_and_unsupported_mime_fail_before_client_creation(self):
        with patch.object(document_ocr, "_typhoon_client") as provider:
            for data in (b"", None, "not bytes"):
                with self.subTest(data=data), self.assertRaises(ValueError):
                    document_ocr.read_typhoon_image(cast(bytes, data))
            for mime in ("image/webp", "image/jpg", "text/plain", "", None):
                with self.subTest(mime=mime), self.assertRaises(ValueError):
                    document_ocr.read_typhoon_image(b"page", mime_type=cast(str, mime))
            provider.assert_not_called()

    def test_malformed_responses_and_sdk_failures_are_not_cached(self):
        for response in (None, SimpleNamespace(choices=[]), SimpleNamespace(choices=[None])):
            with (
                self.subTest(response=response),
                patch.object(document_ocr, "_typhoon_client") as provider,
            ):
                create = provider.return_value.chat.completions.create
                create.side_effect = [response, completion("retry success")]
                with self.assertRaises(RuntimeError) as raised:
                    document_ocr.read_typhoon_image(b"page")
                self.assertIn("กรุณา", str(raised.exception))
                self.assertEqual(document_ocr.read_typhoon_image(b"page"), "retry success")
                self.assertEqual(create.call_count, 2)
        for status in (None, 401, 429, 500):
            with (
                self.subTest(status=status),
                patch.object(document_ocr, "_typhoon_client") as provider,
            ):
                message = "private-secret https://private.example provider raw text"
                error = (
                    OpenAIError(message)
                    if status is None
                    else APIStatusError(
                        message,
                        response=httpx2.Response(
                            status, request=httpx2.Request("POST", "https://private.example")
                        ),
                        body=None,
                    )
                )
                create = provider.return_value.chat.completions.create
                create.side_effect = [error, completion("retry success")]
                with self.assertRaises(OpenAIError) as raised:
                    document_ocr.read_typhoon_image(b"page")
                message = str(raised.exception)
                self.assertIn("กรุณา", message)
                for secret in ("private-secret", "https://", "provider raw text", "test-only"):
                    self.assertNotIn(secret, message)
                self.assertEqual(getattr(raised.exception, "status_code", None), status)
                self.assertTrue(raised.exception.__suppress_context__)
                self.assertEqual(document_ocr.read_typhoon_image(b"page"), "retry success")
                self.assertEqual(create.call_count, 2)

    def test_pdf_retry_reuses_successful_pages_but_retries_failed_pages(self):
        with pymupdf.open(stream=pdf_bytes(pages=2, scanned=True), filetype="pdf") as pdf:
            pdf[1].draw_rect(pymupdf.Rect(20, 20, 100, 100), color=(0, 0, 0), fill=(0, 0, 0))
            data = pdf.tobytes()
        succeeded = threading.Event()
        pages = {}
        lock = threading.Lock()

        def produce(**kwargs):
            image = kwargs["messages"][0]["content"][1]["image_url"]["url"]
            with lock:
                first = not pages or image == next(iter(pages))
                pages[image] = pages.get(image, 0) + 1
                attempt = pages[image]
            if first:
                succeeded.set()
                return completion("successful page")
            if attempt == 1:
                if not succeeded.wait(timeout=5):
                    raise AssertionError("First page did not complete")
                raise OpenAIError("temporary provider failure")
            return completion("retried page")

        with patch.object(document_ocr, "_typhoon_client") as provider:
            create = provider.return_value.chat.completions.create
            create.side_effect = produce
            with self.assertRaises(OpenAIError):
                extract_file(data, "scan.pdf", "document")
            text = extract_file(data, "scan.pdf", "document")
            self.assertIn("successful page", text)
            self.assertIn("retried page", text)
            self.assertEqual(sorted(pages.values()), [1, 2])
            self.assertEqual(create.call_count, 3)

    def test_sdk_client_disables_retries_and_is_reused(self):
        document_ocr._typhoon_client.cache_clear()
        self.addCleanup(document_ocr._typhoon_client.cache_clear)
        with patch.object(document_ocr, "OpenAI") as sdk:
            document_ocr._typhoon_client("key", "http://127.0.0.1:8101/v1", 12)
            document_ocr._typhoon_client("key", "http://127.0.0.1:8101/v1", 12)
            sdk.assert_called_once_with(
                api_key="key", base_url="http://127.0.0.1:8101/v1", timeout=12, max_retries=0
            )

    def test_extraction_cache_isolates_provider_and_model_and_retries_failures(self):
        client = server.app.test_client()
        data = image_file()
        with (
            patch.object(document_ocr, "_typhoon_client") as typhoon,
            patch.object(server, "get_client") as groq,
        ):
            typhoon.return_value.chat.completions.create.side_effect = [
                OpenAIError("simulated"),
                completion("Typhoon result"),
                completion("Other model"),
            ]
            groq.return_value.chat.completions.create.return_value = completion("Groq result")

            def extract():
                return client.post(
                    "/api/extract", data={"kind": "image", "file": (io.BytesIO(data), "scan.png")}
                )

            self.assertEqual(extract().status_code, 502)
            first, cached = extract(), extract()
            self.assertEqual(first.get_json()["text"], "Typhoon result")
            self.assertEqual(cached.headers["X-Result-Cache"], "hit")
            groq.assert_not_called()
            with patch.dict(os.environ, {"TYPHOON_OCR_MODEL": "custom-model"}):
                self.assertEqual(extract().get_json()["text"], "Other model")
            with patch.dict(os.environ, {"DOCUMENT_OCR_PROVIDER": "groq"}):
                self.assertEqual(extract().get_json()["text"], "Groq result")
            self.assertEqual(typhoon.return_value.chat.completions.create.call_count, 3)
