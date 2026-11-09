"""Menu localization must never invoke translation providers."""

import unittest
from unittest.mock import patch

import app as server


class InterfaceLocalizationTests(unittest.TestCase):
    def test_removed_ai_endpoint_cannot_consume_provider_quota(self):
        with patch.object(server, "get_client") as provider:
            response = server.app.test_client().post(
                "/api/interface-language",
                json={"interface_language": "zh-TW", "strings": {"menu": "Menu"}},
            )
        self.assertEqual(response.status_code, 404)
        provider.assert_not_called()

    def test_bundled_fonts_can_be_served_without_provider(self):
        for filename in (
            "IBMPlexSansThai-Regular.woff2",
            "IBMPlexSansThai-Medium.woff2",
            "IBMPlexSansThai-SemiBold.woff2",
            "IBMPlexSansThai-Bold.woff2",
            "Manrope-Variable.woff2",
            "SpaceGrotesk-Variable.woff2",
        ):
            with self.subTest(font=filename), patch.object(server, "get_client") as provider:
                response = server.app.test_client().get(f"/static/fonts/{filename}")
                try:
                    self.assertEqual(response.status_code, 200)
                    self.assertTrue(response.data)
                    self.assertNotIn("Location", response.headers)
                    provider.assert_not_called()
                finally:
                    response.close()

    def test_bundled_interface_can_be_served_without_provider(self):
        with patch.object(server, "get_client") as provider:
            response = server.app.test_client().get("/static/interface-locales/zh-TW.json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["menu"], "選單")
        provider.assert_not_called()
        response.close()


if __name__ == "__main__":
    unittest.main()
