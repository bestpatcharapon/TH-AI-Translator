import gzip
import io
import json
import threading
import time
import unittest
from concurrent.futures import Future, ThreadPoolExecutor
from types import SimpleNamespace
from unittest.mock import patch

from PIL import Image
from test_app import completion, pdf_bytes

import app as server
from performance import ResultCache
from photo_translation import detect_regions, translate_regions
from services import extract_file


class PerformanceTests(unittest.TestCase):
    def test_cache_ttl_eviction_copy_isolation_and_bypass(self):
        cache = ResultCache(max_entries=2, max_bytes=30, ttl=1)
        with patch("performance.time.monotonic", return_value=0) as clock:
            value, status = cache.run("a", lambda: {"x": [1]})
            self.assertEqual(status, "miss")
            value["x"].append(2)
            self.assertEqual(cache.run("a", lambda: None), ({"x": [1]}, "hit"))
            self.assertEqual(cache.run("a", lambda: "fresh", bypass=True), ("fresh", "bypass"))
            cache.run("b", lambda: "b")
            cache.run("c", lambda: "c")
            self.assertLessEqual(cache._bytes, 30)
            self.assertEqual(cache.run("a", lambda: "new")[1], "miss")
            clock.return_value = 2
            self.assertEqual(cache.run("a", lambda: "expired"), ("expired", "miss"))
        tiny = ResultCache(max_bytes=2)
        self.assertEqual(tiny.run("large", lambda: "too large")[1], "miss")
        self.assertEqual(tiny.run("large", lambda: "too large")[1], "miss")

    def test_concurrent_identical_requests_share_one_success(self):
        cache = ResultCache()
        started = threading.Event()
        release = threading.Event()
        joined = threading.Barrier(5)
        calls = []

        class WaitingFuture(Future):
            def exception(self, timeout=None):
                joined.wait(timeout=5)
                return super().exception(timeout)

        def produce():
            calls.append(1)
            started.set()
            if not release.wait(5):
                raise AssertionError("Producer was not released")
            return {"text": "same"}

        with patch("performance.Future", WaitingFuture), ThreadPoolExecutor(max_workers=5) as pool:
            owner = pool.submit(cache.run, "same", produce)
            try:
                self.assertTrue(started.wait(5))
                waiters = [pool.submit(cache.run, "same", produce) for _ in range(4)]
                joined.wait(timeout=5)
            finally:
                release.set()
            results = [owner.result(timeout=5)] + [item.result(timeout=5) for item in waiters]
        self.assertEqual(len(calls), 1)
        self.assertEqual([status for _, status in results], ["miss"] + ["shared"] * 4)
        results[0][0]["text"] = "changed"
        results[1][0]["text"] = "also changed"
        self.assertEqual(results[2][0]["text"], "same")
        self.assertEqual(cache.run("same", produce)[0]["text"], "same")

    def test_clear_detaches_old_work_without_removing_new_work(self):
        for old_fails in (False, True):
            with self.subTest(old_fails=old_fails):
                cache = ResultCache()
                started = [threading.Event(), threading.Event()]
                release = [threading.Event(), threading.Event()]
                joined = threading.Event()

                class WaitingFuture(Future):
                    def exception(self, timeout=None):
                        joined.set()
                        return super().exception(timeout)

                def produce(index):
                    started[index].set()
                    if not release[index].wait(5):
                        raise AssertionError("Producer was not released")
                    if index == 0 and old_fails:
                        raise ValueError("old failure")
                    return ["old" if index == 0 else "new"]

                with patch("performance.Future", WaitingFuture), ThreadPoolExecutor(
                    max_workers=4
                ) as pool:
                    old = pool.submit(cache.run, "key", lambda: produce(0))
                    try:
                        self.assertTrue(started[0].wait(5))
                        old_waiter = pool.submit(cache.run, "key", lambda: self.fail("duplicate"))
                        self.assertTrue(joined.wait(5))
                        cache.clear()
                        new = pool.submit(cache.run, "key", lambda: produce(1))
                        self.assertTrue(started[1].wait(5))
                        release[0].set()
                        if old_fails:
                            for item in (old, old_waiter):
                                with self.assertRaisesRegex(ValueError, "old failure"):
                                    item.result(timeout=5)
                        else:
                            self.assertEqual(old.result(timeout=5), (["old"], "miss"))
                            self.assertEqual(old_waiter.result(timeout=5), (["old"], "shared"))
                        self.assertNotIn("key", cache._entries)
                        joined.clear()
                        new_waiter = pool.submit(cache.run, "key", lambda: self.fail("duplicate"))
                        self.assertTrue(joined.wait(5))
                    finally:
                        for event in release:
                            event.set()
                    self.assertEqual(new.result(timeout=5), (["new"], "miss"))
                    self.assertEqual(new_waiter.result(timeout=5), (["new"], "shared"))
                self.assertEqual(cache.run("key", lambda: None), (["new"], "hit"))
                self.assertEqual(cache._bytes, len(json.dumps(["new"]).encode()))
                self.assertFalse(cache._inflight)
                cache.clear()
                self.assertEqual(cache._bytes, 0)
                self.assertFalse(cache._entries)

    def test_cleared_producer_cannot_overwrite_completed_replacement(self):
        cache = ResultCache()
        started = threading.Event()
        release = threading.Event()

        def produce():
            started.set()
            if not release.wait(5):
                raise AssertionError("Producer was not released")
            return "old"

        with ThreadPoolExecutor(max_workers=1) as pool:
            old = pool.submit(cache.run, "key", produce)
            try:
                self.assertTrue(started.wait(5))
                cache.clear()
                self.assertEqual(cache.run("key", lambda: "replacement"), ("replacement", "miss"))
            finally:
                release.set()
            self.assertEqual(old.result(timeout=5), ("old", "miss"))
        self.assertEqual(cache.run("key", lambda: None), ("replacement", "hit"))
        self.assertEqual(cache._bytes, len(json.dumps("replacement").encode()))
        self.assertFalse(cache._inflight)

    def test_shared_producer_timeout_is_not_a_wait_timeout(self):
        cache = ResultCache()
        started = threading.Event()
        release = threading.Event()
        joined = threading.Event()
        failure = TimeoutError("provider timed out")

        class WaitingFuture(Future):
            def exception(self, timeout=None):
                joined.set()
                return super().exception(timeout)

        def produce():
            started.set()
            if not release.wait(5):
                raise AssertionError("Producer was not released")
            raise failure

        with patch("performance.Future", WaitingFuture), ThreadPoolExecutor(max_workers=2) as pool:
            owner = pool.submit(cache.run, "key", produce)
            try:
                self.assertTrue(started.wait(5))
                waiter = pool.submit(cache.run, "key", lambda: self.fail("duplicate"))
                self.assertTrue(joined.wait(5))
            finally:
                release.set()
            for item in (owner, waiter):
                with self.assertRaises(TimeoutError) as raised:
                    item.result(timeout=5)
                self.assertIs(raised.exception, failure)
        self.assertFalse(cache._inflight)
        self.assertEqual(cache.run("key", lambda: "retry"), ("retry", "miss"))

    def test_wait_timeout_and_bypass_do_not_disturb_active_producer(self):
        cache = ResultCache(wait_timeout=0)
        started = threading.Event()
        release = threading.Event()

        def produce():
            started.set()
            if not release.wait(5):
                raise AssertionError("Producer was not released")
            return "original"

        with ThreadPoolExecutor(max_workers=1) as pool:
            owner = pool.submit(cache.run, "key", produce)
            try:
                self.assertTrue(started.wait(5))
                with self.assertRaises(RuntimeError):
                    cache.run("key", lambda: self.fail("duplicate"))
                self.assertEqual(
                    cache.run("key", lambda: "fresh", bypass=True), ("fresh", "bypass")
                )
                with self.assertRaisesRegex(ValueError, "bypass failure"):
                    cache.run(
                        "key",
                        lambda: (_ for _ in ()).throw(ValueError("bypass failure")),
                        bypass=True,
                    )
                self.assertEqual(len(cache._inflight), 1)
                self.assertFalse(cache._entries)
            finally:
                release.set()
            self.assertEqual(owner.result(timeout=5), ("original", "miss"))
        self.assertEqual(cache.run("key", lambda: None), ("original", "hit"))
        self.assertEqual(cache.run("key", lambda: "fresh", bypass=True), ("fresh", "bypass"))
        self.assertEqual(cache.run("key", lambda: None), ("original", "hit"))
        self.assertFalse(cache._inflight)

    def test_expiry_uses_time_after_acquiring_lock(self):
        cache = ResultCache(ttl=1)
        waiting = threading.Event()
        lock = cache._lock

        class ObservedLock:
            def __enter__(self):
                waiting.set()
                lock.acquire()

            def __exit__(self, *args):
                lock.release()

        with patch("performance.time.monotonic", return_value=0) as clock:
            cache.run("key", lambda: "old")
            cache._lock = ObservedLock()
            with ThreadPoolExecutor(max_workers=1) as pool:
                with lock:
                    pending = pool.submit(cache.run, "key", lambda: "fresh")
                    self.assertTrue(waiting.wait(5))
                    clock.return_value = 2
                self.assertEqual(pending.result(timeout=5), ("fresh", "miss"))

    def test_hit_copy_does_not_hold_cache_lock(self):
        cache = ResultCache()
        value = {"text": ["cached"]}
        cache.run("key", lambda: value)
        copying = threading.Event()
        release = threading.Event()
        from copy import deepcopy

        def slow_copy(item):
            copying.set()
            if not release.wait(5):
                raise AssertionError("Copy was not released")
            return deepcopy(item)

        with patch("performance.copy.deepcopy", side_effect=slow_copy), ThreadPoolExecutor(
            max_workers=1
        ) as pool:
            hit = pool.submit(cache.run, "key", lambda: self.fail("unexpected miss"))
            try:
                self.assertTrue(copying.wait(5))
                acquired = cache._lock.acquire(blocking=False)
                if acquired:
                    cache._lock.release()
                self.assertTrue(acquired, "A cache hit holds the global lock while copying")
                cache.clear()
            finally:
                release.set()
            self.assertEqual(hit.result(timeout=5), (value, "hit"))
        self.assertFalse(cache._entries)

    def test_errors_and_partial_failures_are_not_cached(self):
        cache = ResultCache()
        with self.assertRaises(RuntimeError):
            cache.run("a", lambda: (_ for _ in ()).throw(RuntimeError("failed")))
        self.assertEqual(cache.run("a", lambda: "recovered"), ("recovered", "miss"))
        for _ in range(2):
            self.assertEqual(
                cache.run(
                    "partial",
                    lambda: {"error": "retry"},
                    cacheable=lambda value: "error" not in value,
                )[1],
                "miss",
            )

    def test_translation_cache_scope_refresh_and_error_recovery(self):
        client = server.app.test_client()
        body = {"text": "hello", "source": "en", "target": "th"}
        with (
            patch.object(server, "translate_text", return_value="สวัสดี") as provider,
            patch.object(server, "get_client"),
        ):
            first = client.post("/api/translate", json=body)
            second = client.post("/api/translate", json=body)
            self.assertEqual(first.headers["X-Result-Cache"], "miss")
            self.assertEqual(second.headers["X-Result-Cache"], "hit")
            self.assertIn("app;dur=", second.headers["Server-Timing"])
            self.assertEqual(
                client.post("/api/translate", json={**body, "cache_scope": "live"}).headers[
                    "X-Result-Cache"
                ],
                "miss",
            )
            self.assertEqual(
                client.post("/api/translate", json={**body, "cache_bypass": True}).headers[
                    "X-Result-Cache"
                ],
                "bypass",
            )
            self.assertEqual(provider.call_count, 3)
        with patch.object(
            server, "translate_text", side_effect=[RuntimeError("temporary"), "สวัสดี"]
        ) as provider:
            self.assertEqual(client.post("/api/translate", json=body).status_code, 503)
            self.assertEqual(client.post("/api/translate", json=body).status_code, 200)
            self.assertEqual(
                client.post("/api/translate", json=body).headers["X-Result-Cache"], "hit"
            )
            self.assertEqual(provider.call_count, 2)

    def test_extract_transcribe_and_speech_reuse_successes(self):
        client = server.app.test_client()
        with patch.object(server, "extract_file", return_value="document") as extractor:
            for _ in range(2):
                self.assertEqual(
                    client.post(
                        "/api/extract", data={"file": (io.BytesIO(b"doc"), "doc.txt")}
                    ).status_code,
                    200,
                )
            self.assertEqual(extractor.call_count, 1)
        with patch.object(server, "get_client") as provider:
            provider.return_value.audio.transcriptions.create.return_value = SimpleNamespace(
                text="voice"
            )
            for _ in range(2):
                self.assertEqual(
                    client.post(
                        "/api/transcribe",
                        data={"file": (io.BytesIO(b"audio"), "voice.webm"), "language": "th"},
                    ).status_code,
                    200,
                )
            self.assertEqual(provider.return_value.audio.transcriptions.create.call_count, 1)
        with patch.object(server, "create_speech", return_value=b"ID3audio") as speech:
            responses = [
                client.post("/api/speech", json={"text": "hello", "language": "en"})
                for _ in range(2)
            ]
            self.assertEqual(responses[1].data, b"ID3audio")
            self.assertEqual(responses[1].headers["X-Result-Cache"], "hit")
            self.assertEqual(speech.call_count, 1)

    def test_source_examples_are_cached_but_explicit_reviews_remain_fresh(self):
        client = server.app.test_client()
        body = {"text": "Hello", "source": "en", "target": "th", "translation": "สวัสดี"}
        with (
            patch.object(server, "get_client"),
            patch.object(
                server, "assistant_result", return_value={"explanation": "ok"}
            ) as provider,
        ):
            for action in ["source_info", "source_info", "explain", "explain"]:
                self.assertEqual(
                    client.post("/api/assist", json={**body, "action": action}).status_code, 200
                )
            self.assertEqual(provider.call_count, 3)

    def test_primary_result_does_not_wait_for_deferred_languages(self):
        client = server.app.test_client()
        with (
            patch.object(server, "translate_text", return_value="สวัสดี") as primary,
            patch.object(server, "additional_translations") as extras,
        ):
            response = client.post(
                "/api/translate",
                json={
                    "text": "Hello",
                    "source": "en",
                    "target": "th",
                    "additional_targets": ["ja", "fr"],
                    "defer_additional": True,
                },
            )
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.get_json()["translation"], "สวัสดี")
            self.assertEqual(
                response.get_json()["additional_translations"],
                [{"target": "ja", "pending": True}, {"target": "fr", "pending": True}],
            )
            primary.assert_called_once()
            extras.assert_not_called()

    def test_large_json_is_compressed_only_when_client_accepts_gzip(self):
        client = server.app.test_client()
        compressed = client.get("/api/language-catalog.js", headers={"Accept-Encoding": "gzip"})
        plain = client.get("/api/language-catalog.js", headers={"Accept-Encoding": "gzip;q=0"})
        self.assertEqual(compressed.headers["Content-Encoding"], "gzip")
        self.assertNotIn("Content-Encoding", plain.headers)
        self.assertEqual(gzip.decompress(compressed.data), plain.data)
        self.assertLess(len(compressed.data), len(plain.data))
        self.assertIn("Accept-Encoding", compressed.headers["Vary"])

    def test_photo_returns_primary_without_waiting_for_extra_languages(self):
        client = server.app.test_client()
        photo = {
            "regions": [{"text": "Hello", "translation": "สวัสดี"}],
            "source_language": "en",
            "cache_status": "hit",
        }
        with (
            patch.object(server, "translate_photo", return_value=photo),
            patch.object(server, "get_client"),
            patch.object(server, "additional_translations") as extras,
        ):
            response = client.post(
                "/api/photo-translate",
                data={
                    "source": "en",
                    "target": "th",
                    "defer_additional": "true",
                    "additional_targets": '["ja"]',
                    "file": (io.BytesIO(b"photo"), "photo.png"),
                },
            )
            self.assertEqual(response.status_code, 200)
            self.assertEqual(
                response.get_json()["additional_translations"], [{"target": "ja", "pending": True}]
            )
            self.assertEqual(response.headers["X-Result-Cache"], "hit")
            extras.assert_not_called()

    def test_document_chunks_overlap_but_return_in_original_order(self):
        lock = threading.Lock()
        active = 0
        peak = 0

        def provider(**options):
            nonlocal active, peak
            with lock:
                active += 1
                peak = max(peak, active)
            barrier.wait(timeout=5)
            text = options["messages"][1]["content"]
            with lock:
                active -= 1
            return completion("translated:" + text.strip())

        text = "paragraph words\n" * 650
        barrier = threading.Barrier(min(3, len(list(server.chunks(text)))))
        with patch.object(server, "get_client") as client:
            client.return_value.chat.completions.create.side_effect = provider
            result = server.translate_text(text, "en", "th", "natural")
        self.assertEqual(
            result, "\n\n".join("translated:" + part.strip() for part in server.chunks(text))
        )
        self.assertGreater(peak, 1)
        self.assertLessEqual(peak, 3)

    def test_photo_batches_keep_ids_and_order_without_parallel_provider_bursts(self):
        lock = threading.Lock()
        active = 0
        peak = 0

        def provider(**options):
            nonlocal active, peak
            with lock:
                active += 1
                peak = max(peak, active)
            time.sleep(0.03)
            items = json.loads(options["messages"][1]["content"])
            with lock:
                active -= 1
            return completion(
                json.dumps(
                    {
                        "translations": [
                            {"id": item["id"], "text": "translated:" + item["text"]}
                            for item in reversed(items)
                        ]
                    }
                )
            )

        regions = [{"text": f"caption {i}"} for i in range(71)]
        with patch.object(server, "get_client") as client:
            client.return_value.chat.completions.create.side_effect = provider
            result = translate_regions(regions, "en", "th", "natural", client.return_value, "model")
        self.assertEqual(result, ["translated:" + item["text"] for item in regions])
        self.assertEqual(peak, 1)

    def test_all_three_ocr_variants_are_preserved(self):
        lock = threading.Lock()
        active = 0
        peak = 0
        calls = 0

        def read(*args, **kwargs):
            nonlocal active, peak, calls
            with lock:
                active += 1
                peak = max(peak, active)
                calls += 1
            time.sleep(0.02)
            with lock:
                active -= 1
            return "tsv"

        region = {
            "text": "Menu item",
            "x": 10,
            "y": 10,
            "width": 80,
            "height": 10,
            "confidence": 95,
        }
        with (
            patch("photo_translation.run_ocr", side_effect=read),
            patch("photo_translation.parse_tsv", side_effect=lambda *args: [region.copy()]),
        ):
            self.assertTrue(detect_regions(Image.new("RGB", (200, 100), "white"), "en"))
        self.assertEqual(calls, 3)
        self.assertEqual(peak, 2)

    def test_scanned_pdf_overlap_preserves_page_order_and_reuses_one_client(self):
        import pymupdf

        barrier = threading.Barrier(2)

        def read(data, client):
            with Image.open(io.BytesIO(data)) as image:
                pixel = image.convert("RGB").getpixel((0, 0))
                assert isinstance(pixel, tuple)
                label = "white" if pixel[0] > 128 else "black"
            barrier.wait(timeout=5)
            if label == "white":
                time.sleep(0.02)
            return label

        with pymupdf.open(stream=pdf_bytes(pages=2, scanned=True), filetype="pdf") as document:
            document[1].draw_rect(document[1].rect, color=None, fill=(0, 0, 0))
            data = document.tobytes()
        with (
            patch("services.read_image", side_effect=read),
            patch.object(server, "get_client", return_value=object()) as client,
        ):
            result = extract_file(data, "scan.pdf", "document", client_factory=client)
            self.assertEqual(result, "white\n\nblack")
            client.assert_called_once_with()


if __name__ == "__main__":
    unittest.main()
