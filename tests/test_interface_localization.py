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

    def test_bundled_interface_can_be_served_without_provider(self):
        with patch.object(server, "get_client") as provider:
            response = server.app.test_client().get("/static/interface-locales/zh-TW.json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["menu"], "選單")
        provider.assert_not_called()
        response.close()


if __name__ == "__main__":
    unittest.main()
