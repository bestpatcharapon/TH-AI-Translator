"""Content-free request diagnostics. No bodies, query strings, IPs or provider errors."""

import json
import logging
import os
import time
import uuid

from flask import Flask, request

_CACHE_STATES = frozenset({"hit", "miss", "shared", "bypass"})


def install_request_observability(app: Flask):
    """Install before admission control so rejected requests also get an ID/timing."""
    if app.extensions.get("request_observability"):
        return
    app.extensions["request_observability"] = True
    app.config.setdefault("REQUEST_LOG_ENABLED", os.getenv("REQUEST_LOG_ENABLED", "0") == "1")
    logger = logging.getLogger("translator.requests")
    if app.config["REQUEST_LOG_ENABLED"]:
        logger.setLevel(logging.INFO)

    @app.before_request
    def identify_request():
        # Do not reflect caller-provided IDs: arbitrary header text can leak into logs.
        request.environ["translator.request_id"] = uuid.uuid4().hex
        request.environ["translator.started"] = time.perf_counter()

    @app.after_request
    def summarize_request(response):
        if not request.path.startswith("/api/"):
            return response
        request_id = request.environ["translator.request_id"]
        elapsed = max(0, (time.perf_counter() - request.environ["translator.started"]) * 1000)
        response.headers["X-Request-ID"] = request_id
        response.headers["Server-Timing"] = f"app;dur={elapsed:.1f}"
        response.headers["Cache-Control"] = "no-store"
        if app.config["REQUEST_LOG_ENABLED"]:
            record = {
                "event": "api_request",
                "request_id": request_id,
                "method": request.method,
                "route": request.url_rule.rule if request.url_rule else "<unmatched>",
                "status": response.status_code,
                "duration_ms": round(elapsed, 1),
            }
            cache = response.headers.get("X-Result-Cache")
            if cache in _CACHE_STATES:
                record["cache"] = cache
            logger.info("%s", json.dumps(record, separators=(",", ":")))
        return response
