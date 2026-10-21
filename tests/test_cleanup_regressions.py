"""Regression checks for issues found during the project cleanup."""

import io
import unittest
from unittest.mock import patch

from test_app import docx_bytes, pdf_bytes

import app as server


class CleanupRegressionTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()

    def test_local_documents_do_not_require_an_ai_client(self):
        documents = [
            ("note.txt", b"Hello"),
            ("note.md", b"# Hello"),
            ("note.csv", b"name,price\nitem,50"),
            ("note.docx", docx_bytes()),
            ("note.pdf", pdf_bytes()),
        ]
        with patch.object(
            server, "get_client", side_effect=RuntimeError("API unavailable")
        ) as provider:
            for name, data in documents:
                with self.subTest(name=name):
                    response = self.client.post(
                        "/api/extract", data={"file": (io.BytesIO(data), name)}
                    )
                    self.assertEqual(response.status_code, 200)
                    self.assertTrue(response.json["text"])
            provider.assert_not_called()

    def test_scanned_documents_resolve_the_client_only_when_ocr_is_needed(self):
        client = object()
        with (
            patch.object(server, "get_client", return_value=client) as provider,
            patch("services.read_image", return_value="Scanned text") as ocr,
        ):
            response = self.client.post(
                "/api/extract", data={"file": (io.BytesIO(pdf_bytes(scanned=True)), "scan.pdf")}
            )
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json["text"], "Scanned text")
            provider.assert_called_once_with()
            self.assertIs(ocr.call_args.args[1], client)

    def test_unsupported_documents_are_rejected_without_requesting_a_client(self):
        with patch.object(server, "get_client") as provider:
            response = self.client.post(
                "/api/extract", data={"file": (io.BytesIO(b"data"), "test.exe")}
            )
            self.assertEqual(response.status_code, 400)
            provider.assert_not_called()


if __name__ == "__main__":
    unittest.main()
