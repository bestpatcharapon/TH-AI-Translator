import json
import unittest

from flask import Flask, jsonify

from request_limits import Rejection, install_request_limits
from request_observability import install_request_observability


def make_app(enabled=True):
    app = Flask(__name__)
    app.config.update(REQUEST_LOG_ENABLED=enabled, REQUEST_MAX_CONCURRENT=1, REQUESTS_PER_MINUTE=0)
    install_request_observability(app)
    guard = install_request_limits(app)

    @app.post("/api/translate")
    def translate():
        response = jsonify(translation="private output")
        response.headers["X-Result-Cache"] = "hit"
        return response

    @app.post("/api/fail")
    def fail():
        return jsonify(error="private upstream detail"), 502

    return app, guard


class RequestObservabilityTests(unittest.TestCase):
    def test_content_free_log_and_server_generated_id(self):
        app, _ = make_app()
        with self.assertLogs("translator.requests", level="INFO") as logs:
            response = app.test_client().post(
                "/api/translate?secret=private-query",
                json={"text": "private source"},
                headers={"X-Request-ID": "private-caller-id", "Authorization": "secret-key"},
                environ_overrides={"REMOTE_ADDR": "192.0.2.123"},
            )
        record = json.loads(logs.records[0].getMessage())
        self.assertEqual(
            set(record),
            {"event", "request_id", "method", "route", "status", "duration_ms", "cache"},
        )
        self.assertEqual(record["route"], "/api/translate")
        self.assertEqual(record["cache"], "hit")
        self.assertEqual(record["request_id"], response.headers["X-Request-ID"])
        self.assertRegex(record["request_id"], r"^[a-f0-9]{32}$")
        self.assertGreaterEqual(record["duration_ms"], 0)
        for private in ("private", "secret-key", "192.0.2.123", "Authorization"):
            self.assertNotIn(private, logs.records[0].getMessage())
        self.assertEqual(response.headers["Cache-Control"], "no-store")
        self.assertIn("app;dur=", response.headers["Server-Timing"])

    def test_rejections_and_provider_failures_are_correlated(self):
        app, guard = make_app()
        release = guard.acquire("occupied")
        assert not isinstance(release, Rejection)
        try:
            with self.assertLogs("translator.requests", level="INFO") as logs:
                rejected = app.test_client().post("/api/translate")
                failed = app.test_client().post("/api/fail")
        finally:
            release()
        self.assertEqual([r.status_code for r in (rejected, failed)], [429, 502])
        self.assertNotEqual(rejected.headers["X-Request-ID"], failed.headers["X-Request-ID"])
        self.assertEqual([json.loads(r.getMessage())["status"] for r in logs.records], [429, 502])
        self.assertNotIn("private upstream detail", " ".join(logs.output))

    def test_unknown_paths_do_not_enter_logs(self):
        app, _ = make_app()
        with self.assertLogs("translator.requests", level="INFO") as logs:
            response = app.test_client().get("/api/private-user-name?token=private-token")
        record = json.loads(logs.records[0].getMessage())
        self.assertEqual(response.status_code, 404)
        self.assertEqual(record["route"], "<unmatched>")
        self.assertNotIn("private", logs.records[0].getMessage())

    def test_disabled_logs_keep_diagnostics_and_install_is_idempotent(self):
        app, _ = make_app(False)
        install_request_observability(app)
        with self.assertNoLogs("translator.requests", level="INFO"):
            response = app.test_client().post("/api/translate")
        self.assertEqual(response.status_code, 200)
        self.assertIn("X-Request-ID", response.headers)
        self.assertEqual(len(response.headers.getlist("X-Request-ID")), 1)
