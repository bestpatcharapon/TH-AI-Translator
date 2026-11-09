import threading
import unittest
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

from flask import Flask, request

from request_limits import (
    EXPENSIVE_POST_PATHS,
    Rejection,
    RequestLimits,
    install_request_limits,
)


def accepted(guard: RequestLimits, client: str) -> Callable[[], None]:
    release = guard.acquire(client)
    assert callable(release), f"Expected admission, got {release}"
    return release


def make_app(**config):
    app = Flask(__name__)
    app.config.update(TESTING=True, REQUEST_MAX_CONCURRENT=1, REQUESTS_PER_MINUTE=0)
    app.config.update(config)
    guard = install_request_limits(app)

    def respond():
        return {"ok": True}

    for index, path in enumerate(EXPENSIVE_POST_PATHS):
        app.add_url_rule(path, f"expensive_{index}", respond, methods=["POST", "GET"])
    app.add_url_rule("/api/audit", "audit", respond, methods=["POST"])
    return app, guard


class RequestLimitsTests(unittest.TestCase):
    def test_defaults_and_environment_config(self):
        with patch.dict("os.environ", {}, clear=True):
            app = Flask(__name__)
            guard = install_request_limits(app)
            self.assertEqual(guard.max_concurrent, 8)
            self.assertEqual(guard.requests_per_minute, 0)
            for _ in range(100):
                accepted(guard, "shared-user")()
            self.assertEqual(guard._clients, {})
        with patch.dict("os.environ", REQUEST_MAX_CONCURRENT="2", REQUESTS_PER_MINUTE="3"):
            guard = install_request_limits(Flask(__name__))
            self.assertEqual((guard.max_concurrent, guard.requests_per_minute), (2, 3))
            _, overridden = make_app(REQUEST_MAX_CONCURRENT=0, REQUESTS_PER_MINUTE=0)
            self.assertEqual((overridden.max_concurrent, overridden.requests_per_minute), (0, 0))

    def test_settings_are_bounded_nonnegative_integers(self):
        for name, maximum in (("REQUEST_MAX_CONCURRENT", 1024), ("REQUESTS_PER_MINUTE", 10000)):
            for value in (-1, "-1", "", "1.5", 1.0, True, None, "abc", "+1", "１", maximum + 1):
                with self.subTest(name=name, value=value):
                    app = Flask(__name__)
                    app.config[name] = value
                    with self.assertRaisesRegex(ValueError, name):
                        install_request_limits(app)
            for value in (0, "0", str(maximum)):
                app = Flask(__name__)
                app.config[name] = value
                install_request_limits(app)

    def test_disabled_concurrency_and_idempotent_release(self):
        guard = RequestLimits(0)
        releases = [accepted(guard, "client") for _ in range(20)]
        for release in releases:
            release()
            release()
        self.assertEqual(guard._in_flight, 0)
        guard = RequestLimits(1)
        release = accepted(guard, "client")
        self.assertEqual(guard.acquire("other"), Rejection("server_busy", 6))
        release()
        release()
        self.assertEqual(guard._in_flight, 0)
        accepted(guard, "other")()

    def test_concurrent_admission_and_release_are_atomic(self):
        for concurrency, rate, expected in ((3, 0, 3), (0, 4, 4), (3, 4, 3)):
            with self.subTest(concurrency=concurrency, rate=rate):
                guard = RequestLimits(concurrency, rate)
                start = threading.Barrier(17)

                def acquire():
                    start.wait(timeout=5)
                    return guard.acquire("same-client")

                with ThreadPoolExecutor(max_workers=16) as pool:
                    futures = [pool.submit(acquire) for _ in range(16)]
                    start.wait(timeout=5)
                    results = [future.result(timeout=5) for future in futures]
                    accepted = [result for result in results if callable(result)]
                    self.assertEqual(len(accepted), expected)
                    # Exercise concurrent duplicate callback invocations, too.
                    list(pool.map(lambda release: release(), accepted * 4))
                self.assertEqual(guard._in_flight, 0)
                if rate:
                    self.assertEqual(len(guard._clients["same-client"]), expected)

    def test_sliding_window_and_rejected_requests_do_not_extend_it(self):
        guard = RequestLimits(1, 2)
        with patch("request_limits.time.monotonic", return_value=0) as clock:
            release = accepted(guard, "client")
            clock.return_value = 10
            self.assertEqual(guard.acquire("client"), Rejection("server_busy", 6))
            self.assertNotIn("other", guard._clients)
            self.assertEqual(guard.acquire("other"), Rejection("server_busy", 6))
            release()
            accepted(guard, "client")()
            clock.return_value = 59.1
            self.assertEqual(guard.acquire("client"), Rejection("rate_limit_exceeded", 1))
            clock.return_value = 60
            accepted(guard, "client")()
            self.assertEqual(list(guard._clients["client"]), [10, 60])
            self.assertEqual(guard.acquire("client"), Rejection("rate_limit_exceeded", 10))
            clock.return_value = 70
            accepted(guard, "client")()
            self.assertEqual(list(guard._clients["client"]), [60, 70])

    def test_client_table_ttl_cleanup_rejects_instead_of_evicting(self):
        guard = RequestLimits(0, 1, max_clients=2)
        with patch("request_limits.time.monotonic", return_value=0) as clock:
            accepted(guard, "first")()
            clock.return_value = 10
            accepted(guard, "second")()
            clock.return_value = 20
            self.assertEqual(guard.acquire("third"), Rejection("rate_limit_exceeded", 40))
            self.assertEqual(set(guard._clients), {"first", "second"})
            self.assertEqual(guard.acquire("first"), Rejection("rate_limit_exceeded", 40))
            clock.return_value = 60
            accepted(guard, "third")()
            self.assertEqual(set(guard._clients), {"second", "third"})
            clock.return_value = 120
            accepted(guard, "fourth")()
            self.assertEqual(set(guard._clients), {"fourth"})

    def test_cleanup_order_tracks_latest_acceptance_not_initial_insertion(self):
        guard = RequestLimits(0, 2, max_clients=2)
        with patch("request_limits.time.monotonic", return_value=0) as clock:
            accepted(guard, "first")()
            clock.return_value = 5
            accepted(guard, "second")()
            clock.return_value = 10
            accepted(guard, "first")()
            clock.return_value = 65
            accepted(guard, "third")()
            self.assertEqual(set(guard._clients), {"first", "third"})
            self.assertLessEqual(len(guard._clients), 2)

    def test_only_actual_expensive_post_paths_are_guarded(self):
        import app as server

        actual_posts = set()
        for rule in server.app.url_map.iter_rules():
            methods = rule.methods
            assert methods is not None
            if "POST" in methods:
                actual_posts.add(rule.rule)
        self.assertTrue(EXPENSIVE_POST_PATHS <= actual_posts)
        self.assertNotIn("/api/review-input", actual_posts)
        self.assertIn("request_limits", server.app.extensions)
        app, guard = make_app()
        release = accepted(guard, "occupied")
        try:
            client = app.test_client()
            for path in EXPENSIVE_POST_PATHS:
                response = client.post(path)
                self.assertEqual(response.status_code, 429, path)
                payload = response.get_json()
                assert isinstance(payload, dict)
                self.assertEqual(payload["code"], "server_busy")
                self.assertEqual(payload["retry_after"], 6)
                self.assertIn("error", payload)
                self.assertEqual(response.headers["Retry-After"], "6")
                self.assertEqual(client.get(path).status_code, 200)
                self.assertNotEqual(client.options(path).status_code, 429)
            for path in ("/api/audit", "/api/glossary/validate", "/api/photo-preview", "/missing"):
                self.assertNotEqual(client.post(path).status_code, 429)
        finally:
            release()

    def test_remote_addr_only_and_rate_shared_across_paths(self):
        app, guard = make_app(REQUESTS_PER_MINUTE=1)
        client = app.test_client()
        with patch("request_limits.time.monotonic", return_value=0) as clock:
            response = client.post("/api/translate", headers={"X-Forwarded-For": "1.2.3.4"})
            self.assertEqual(response.status_code, 200)
            clock.return_value = 2.2
            response = client.post("/api/speech", headers={"X-Forwarded-For": "9.8.7.6"})
            self.assertEqual(response.status_code, 429)
            payload = response.get_json()
            assert isinstance(payload, dict)
            self.assertEqual(payload["code"], "rate_limit_exceeded")
            self.assertEqual(payload["retry_after"], 58)
            self.assertEqual(response.headers["Retry-After"], "58")
            response = client.post("/api/speech", environ_overrides={"REMOTE_ADDR": "10.0.0.2"})
            self.assertEqual(response.status_code, 200)
        self.assertEqual(set(guard._clients), {"127.0.0.1", "10.0.0.2"})
        self.assertEqual(guard._in_flight, 0)

    def test_teardown_releases_on_errors_and_later_before_request_short_circuit(self):
        for behavior in ("handled", "unhandled", "short-circuit"):
            with self.subTest(behavior=behavior):
                app, guard = make_app()

                @app.before_request
                def fail():
                    if not request.headers.get("X-Fail"):
                        return None
                    if behavior == "short-circuit":
                        return {"stopped": True}, 403
                    raise ValueError("intentional failure")

                if behavior == "handled":
                    app.register_error_handler(
                        ValueError, lambda error: ({"error": str(error)}, 400)
                    )
                client = app.test_client()
                if behavior == "unhandled":
                    with self.assertRaisesRegex(ValueError, "intentional failure"):
                        client.post("/api/translate", headers={"X-Fail": "yes"})
                else:
                    response = client.post("/api/translate", headers={"X-Fail": "yes"})
                    self.assertIn(response.status_code, (400, 403))
                self.assertEqual(guard._in_flight, 0)
                self.assertEqual(client.post("/api/translate").status_code, 200)
                self.assertEqual(guard._in_flight, 0)

    def test_view_failures_release_slots_but_still_count_as_admitted(self):
        for handled in (False, True):
            with self.subTest(handled=handled):
                app, guard = make_app(REQUESTS_PER_MINUTE=1)

                def fail():
                    raise ValueError("view failure")

                endpoint = next(
                    rule.endpoint
                    for rule in app.url_map.iter_rules()
                    if rule.rule == "/api/translate"
                )
                app.view_functions[endpoint] = fail
                if handled:
                    app.register_error_handler(
                        ValueError, lambda error: ({"error": str(error)}, 400)
                    )
                client = app.test_client()
                if handled:
                    self.assertEqual(client.post("/api/translate").status_code, 400)
                else:
                    with self.assertRaisesRegex(ValueError, "view failure"):
                        client.post("/api/translate")
                self.assertEqual(guard._in_flight, 0)
                response = client.post("/api/speech")
                self.assertEqual(response.status_code, 429)
                payload = response.get_json()
                assert isinstance(payload, dict)
                self.assertEqual(payload["code"], "rate_limit_exceeded")

    def test_overlapping_flask_requests_share_global_capacity_across_clients_and_routes(self):
        app, guard = make_app(REQUESTS_PER_MINUTE=1)
        started = threading.Event()
        finish = threading.Event()

        def wait():
            started.set()
            if not finish.wait(5):
                raise AssertionError("Request was not released")
            return {"ok": True}

        endpoint = next(
            rule.endpoint for rule in app.url_map.iter_rules() if rule.rule == "/api/translate"
        )
        app.view_functions[endpoint] = wait
        with ThreadPoolExecutor(max_workers=1) as pool:
            active = pool.submit(app.test_client().post, "/api/translate")
            try:
                self.assertTrue(started.wait(5))
                response = app.test_client().post(
                    "/api/speech", environ_overrides={"REMOTE_ADDR": "10.0.0.2"}
                )
                self.assertEqual(response.status_code, 429)
                payload = response.get_json()
                assert isinstance(payload, dict)
                self.assertEqual(payload["code"], "server_busy")
                self.assertNotIn("10.0.0.2", guard._clients)
            finally:
                finish.set()
            self.assertEqual(active.result(timeout=5).status_code, 200)
        self.assertEqual(guard._in_flight, 0)
        response = app.test_client().post(
            "/api/speech", environ_overrides={"REMOTE_ADDR": "10.0.0.2"}
        )
        self.assertEqual(response.status_code, 200)

    def test_early_short_circuit_does_not_acquire_and_teardown_is_idempotent(self):
        app = Flask(__name__)

        @app.before_request
        def stop():
            return "early", 403

        guard = install_request_limits(app)
        self.assertEqual(app.test_client().post("/api/translate").status_code, 403)
        self.assertEqual(guard._in_flight, 0)
        app, guard = make_app()
        with app.test_request_context("/api/translate", method="POST"):
            self.assertIsNone(app.preprocess_request())
            self.assertEqual(guard._in_flight, 1)
            app.do_teardown_request()
            app.do_teardown_request()
            self.assertEqual(guard._in_flight, 0)

    def test_app_state_isolation_and_install_once(self):
        first, guard = make_app(REQUESTS_PER_MINUTE=1)
        second, other = make_app(REQUESTS_PER_MINUTE=0)
        self.assertIs(install_request_limits(first), guard)
        self.assertIsNot(guard, other)
        self.assertEqual(first.test_client().post("/api/translate").status_code, 200)
        self.assertEqual(first.test_client().post("/api/translate").status_code, 429)
        for _ in range(3):
            self.assertEqual(second.test_client().post("/api/translate").status_code, 200)
        self.assertEqual(other._clients, {})
        self.assertEqual(len(first.before_request_funcs[None]), 1)


if __name__ == "__main__":
    unittest.main()
