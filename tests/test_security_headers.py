"""Security headers protect every response without breaking data:/blob: media."""

import unittest

import app as server


class SecurityHeaderTests(unittest.TestCase):
    def test_page_and_api_carry_strict_headers(self):
        client = server.app.test_client()
        for path in ("/", "/api/languages", "/sw.js"):
            with self.subTest(path=path):
                response = client.get(path)
                try:
                    self.assertEqual(response.status_code, 200)
                    policy = response.headers["Content-Security-Policy"]
                    self.assertIn("default-src 'self'", policy)
                    self.assertIn("img-src 'self' data: blob:", policy)
                    self.assertIn("media-src 'self' blob:", policy)
                    self.assertIn("frame-ancestors 'none'", policy)
                    self.assertNotIn("'unsafe-eval'", policy)
                    self.assertNotIn("'unsafe-inline'", policy)
                    self.assertEqual(response.headers["X-Content-Type-Options"], "nosniff")
                    self.assertEqual(response.headers["Referrer-Policy"], "no-referrer")
                    self.assertEqual(response.headers["X-Frame-Options"], "DENY")
                    self.assertIn("microphone=(self)", response.headers["Permissions-Policy"])
                finally:
                    response.close()

    def test_headers_do_not_replace_explicit_route_headers(self):
        response = server.app.test_client().get("/sw.js")
        try:
            self.assertEqual(response.headers["Cache-Control"], "no-cache")
            self.assertIn("frame-ancestors 'none'", response.headers["Content-Security-Policy"])
        finally:
            response.close()


if __name__ == "__main__":
    unittest.main()
