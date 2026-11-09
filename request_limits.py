"""Lightweight process-local overload protection, not security or authentication.

Each Flask app owns one thread-safe guard shared by all its requests. State is not
shared across worker processes, hosts, or serverless instances: this is not a
distributed quota. Only request.remote_addr identifies clients; forwarded headers
are deliberately ignored. Shared proxies/NAT therefore share a quota (opt-in).

At installation, Flask config overrides environment variables:
* REQUEST_MAX_CONCURRENT: 0..1024, default 8; 0 disables concurrency limiting.
* REQUESTS_PER_MINUTE: 0..10000, default 0 (disabled for shared users/tests).
Invalid settings raise ValueError at startup. Reinstall/restart to change limits.

The sliding window counts admissions, including requests that later fail validation
or processing, but never counts concurrency/rate rejections. At most 1024 clients
are tracked, with at most REQUESTS_PER_MINUTE timestamps each. Inactive clients
expire after 60 seconds, cleaned on the next rate-limited admission attempt. A
full table rejects new clients rather than evicting live quotas and allowing bypass.
No background threads, dependencies beyond Flask, or automatic retries are added.
"""

import math
import os
import threading
import time
from collections import OrderedDict, deque
from collections.abc import Callable
from dataclasses import dataclass

from flask import Flask, jsonify, request

EXPENSIVE_POST_PATHS = frozenset(
    f"/api/{name}"
    for name in (
        "translate",
        "assist",
        "analyze",
        "compare",
        "photo-translate",
        "extract",
        "transcribe",
        "speech",
    )
)
# review_input() is a helper used by analyze/compare, not a separate HTTP route.
WINDOW_SECONDS = 60
MAX_TRACKED_CLIENTS = 1024
_RELEASE_TOKEN = "translator.request_limits.release"


def _bounded_int(name: str, value: object, maximum: int) -> int:
    if isinstance(value, str):
        value = value.strip()
        if value and len(value) <= 5 and value.isascii() and value.isdecimal():
            value = int(value)
    if type(value) is not int or not 0 <= value <= maximum:
        raise ValueError(f"{name} must be an integer between 0 and {maximum}")
    return value


@dataclass(frozen=True)
class Rejection:
    code: str
    retry_after: int


class RequestLimits:
    def __init__(
        self,
        max_concurrent: int = 8,
        requests_per_minute: int = 0,
        *,
        max_clients: int = MAX_TRACKED_CLIENTS,
    ):
        self.max_concurrent = _bounded_int("REQUEST_MAX_CONCURRENT", max_concurrent, 1024)
        self.requests_per_minute = _bounded_int("REQUESTS_PER_MINUTE", requests_per_minute, 10000)
        self.max_clients = _bounded_int("max_clients", max_clients, MAX_TRACKED_CLIENTS)
        if not self.max_clients:
            raise ValueError("max_clients must be positive")
        self._lock = threading.Lock()
        self._in_flight = 0
        self._clients: OrderedDict[str, deque[float]] = OrderedDict()

    def acquire(self, client: str) -> Callable[[], None] | Rejection:
        with self._lock:
            if self.max_concurrent and self._in_flight >= self.max_concurrent:
                return Rejection("server_busy", 6)
            if self.requests_per_minute:
                now = time.monotonic()
                cutoff = now - WINDOW_SECONDS
                # Ordered by last accepted timestamp; never evict a live quota.
                while self._clients:
                    oldest = next(iter(self._clients))
                    if self._clients[oldest][-1] > cutoff:
                        break
                    del self._clients[oldest]
                timestamps = self._clients.get(client)
                if timestamps is None:
                    if len(self._clients) >= self.max_clients:
                        expiry = next(iter(self._clients.values()))[-1] + WINDOW_SECONDS
                        return Rejection("rate_limit_exceeded", max(1, math.ceil(expiry - now)))
                    timestamps = deque()
                    self._clients[client] = timestamps
                while timestamps and timestamps[0] <= cutoff:
                    timestamps.popleft()
                if len(timestamps) >= self.requests_per_minute:
                    remaining = timestamps[0] + WINDOW_SECONDS - now
                    return Rejection("rate_limit_exceeded", max(1, math.ceil(remaining)))
                timestamps.append(now)
                self._clients.move_to_end(client)
            if self.max_concurrent:
                self._in_flight += 1

        released = False

        def release():
            nonlocal released
            with self._lock:
                if not released:
                    released = True
                    if self.max_concurrent:
                        self._in_flight -= 1

        return release


def install_request_limits(app: Flask) -> RequestLimits:
    """Install once per app; capture startup config without sharing mutable state."""
    if "request_limits" in app.extensions:
        return app.extensions["request_limits"]
    for name, default in (("REQUEST_MAX_CONCURRENT", "8"), ("REQUESTS_PER_MINUTE", "0")):
        app.config.setdefault(name, os.environ.get(name, default))
    guard = RequestLimits(
        max_concurrent=app.config["REQUEST_MAX_CONCURRENT"],
        requests_per_minute=app.config["REQUESTS_PER_MINUTE"],
    )
    app.extensions["request_limits"] = guard

    @app.before_request
    def limit_expensive_request():
        if request.method != "POST" or request.path not in EXPENSIVE_POST_PATHS:
            return None
        result = guard.acquire(request.remote_addr or "")
        if isinstance(result, Rejection):
            message = (
                "Server is busy. Please try again later."
                if result.code == "server_busy"
                else "Request rate limit exceeded. Please try again later."
            )
            response = jsonify(error=message, code=result.code, retry_after=result.retry_after)
            response.status_code = 429
            response.headers["Retry-After"] = str(result.retry_after)
            return response
        request.environ[_RELEASE_TOKEN] = result
        return None

    @app.teardown_request
    def release_request_slot(_error):
        release = request.environ.pop(_RELEASE_TOKEN, None)
        if release is not None:
            release()

    return guard
