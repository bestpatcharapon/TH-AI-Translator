"""Check file ownership, wire integrity, validators, and unbuffered streams."""

import gzip
import io
import os
import unittest

from flask import Flask, Response, request, send_file

from response_compression import compress_response


class ResponseCompressionTests(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.body = b"reliable response\n" * 1000

    def transform(self, response, method="GET", headers=None):
        with self.app.test_request_context(
            "/static/test.js", method=method, headers=headers or {"Accept-Encoding": "gzip"}
        ):
            return compress_response(response, request)

    def test_file_is_closed_only_when_response_closes(self):
        handle = io.BytesIO(self.body)
        with self.app.test_request_context("/static/test.js", headers={"Accept-Encoding": "gzip"}):
            response = send_file(handle, mimetype="text/javascript", etag="original")
            compress_response(response, request)
        self.assertFalse(handle.closed)
        self.assertEqual(gzip.decompress(response.get_data()), self.body)
        self.assertEqual(response.headers["Content-Encoding"], "gzip")
        self.assertEqual(response.get_etag(), ("original", True))
        response.close()
        self.assertTrue(handle.closed)

    def test_incompressible_file_remains_intact_and_closes(self):
        body = os.urandom(4096)
        handle = io.BytesIO(body)
        with self.app.test_request_context("/static/test.txt", headers={"Accept-Encoding": "gzip"}):
            response = send_file(handle, mimetype="text/plain")
            compress_response(response, request)
        self.assertEqual(response.get_data(), body)
        self.assertNotIn("Content-Encoding", response.headers)
        response.close()
        self.assertTrue(handle.closed)

    def test_small_file_is_not_consumed(self):
        handle = io.BytesIO(b"tiny")
        with self.app.test_request_context("/static/test.js", headers={"Accept-Encoding": "gzip"}):
            response = send_file(handle, mimetype="text/javascript")
            compress_response(response, request)
        self.assertEqual(handle.tell(), 0)
        self.assertEqual(b"".join(response.iter_encoded()), b"tiny")
        response.close()
        self.assertTrue(handle.closed)

    def test_range_head_and_no_transform_are_untouched(self):
        for method, headers in [
            ("HEAD", {"Accept-Encoding": "gzip"}),
            ("GET", {"Accept-Encoding": "gzip", "Range": "bytes=0-50"}),
            ("GET", {"Accept-Encoding": "gzip;q=0"}),
        ]:
            with self.subTest(method=method, headers=headers):
                response = Response(self.body, mimetype="text/css")
                self.transform(response, method, headers)
                self.assertNotIn("Content-Encoding", response.headers)
                self.assertEqual(response.get_data(), self.body)
        response = Response(self.body, mimetype="text/css")
        response.cache_control.no_transform = True
        self.transform(response)
        self.assertNotIn("Content-Encoding", response.headers)

    def test_streamed_api_is_never_buffered(self):
        reads = []

        def stream():
            reads.append(True)
            yield self.body

        response = Response(stream(), mimetype="application/json")
        response.content_length = len(self.body)
        self.transform(response)
        self.assertEqual(reads, [])
        self.assertNotIn("Content-Encoding", response.headers)
        response.close()

    def test_static_conditional_and_range_responses_remain_valid(self):
        import app as server

        client = server.app.test_client()
        with client.get("/static/app.js", headers={"Accept-Encoding": "gzip"}) as response:
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers["Content-Encoding"], "gzip")
            etag = response.headers["ETag"]
            expected = gzip.decompress(response.data)
        with client.get(
            "/static/app.js", headers={"Accept-Encoding": "gzip", "If-None-Match": etag}
        ) as response:
            self.assertEqual(response.status_code, 304)
            self.assertEqual(response.data, b"")
            self.assertIn("Accept-Encoding", response.headers["Vary"])
        with client.get(
            "/static/app.js", headers={"Accept-Encoding": "gzip", "Range": "bytes=0-49"}
        ) as response:
            self.assertEqual(response.status_code, 206)
            self.assertEqual(response.data, expected[:50])
            self.assertNotIn("Content-Encoding", response.headers)
        with client.get("/", headers={"Accept-Encoding": "gzip"}) as response:
            self.assertEqual(response.headers["Content-Encoding"], "gzip")
            self.assertIn(b"<!doctype html>", gzip.decompress(response.data))
