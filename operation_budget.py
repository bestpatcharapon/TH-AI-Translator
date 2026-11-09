"""Cooperative whole-photo budget, not a hard wall-clock cancellation mechanism.

Native image/OCR CPU work and ResultCache's existing single-flight waits cannot
be interrupted here. Checkpoints reject late results; subprocesses get bounded
waits and real SDK clients disable retries so timeouts are not multiplied. HTTP
transport timeouts are not a strict total-duration guarantee (e.g. slow streams).
No network call is abandoned in a background timeout thread.
"""

import math
import os
from contextvars import ContextVar, copy_context
from functools import wraps
from time import monotonic

from openai import OpenAI

_photo_deadline: ContextVar[float | None] = ContextVar("photo_deadline", default=None)


def check_photo_budget():
    deadline = _photo_deadline.get()
    if deadline is not None and monotonic() >= deadline:
        raise RuntimeError("Photo translation deadline exceeded; please retry")


def photo_timeout(limit):
    deadline = _photo_deadline.get()
    if deadline is None:
        return limit
    remaining = deadline - monotonic()
    if remaining <= 0:
        raise RuntimeError("Photo translation deadline exceeded; please retry")
    return min(limit, remaining)


def checked(function):
    """Check both sides of synchronous work, including cache producers."""

    @wraps(function)
    def wrapped(*args, **kwargs):
        check_photo_budget()
        try:
            result = function(*args, **kwargs)
        except Exception:
            check_photo_budget()
            raise
        check_photo_budget()
        return result

    return wrapped


def whole_photo_budget(function):
    """Nested entry points share a deadline; each retry gets a fresh budget."""

    @wraps(function)
    def wrapped(*args, **kwargs):
        if _photo_deadline.get() is not None:
            return checked(function)(*args, **kwargs)
        try:
            seconds = float(os.getenv("PHOTO_TRANSLATION_TIMEOUT_SECONDS", "120"))
            if not math.isfinite(seconds) or not 0 < seconds <= 300:
                raise ValueError
        except ValueError as error:
            raise RuntimeError(
                "PHOTO_TRANSLATION_TIMEOUT_SECONDS must be a positive finite number <= 300"
            ) from error
        token = _photo_deadline.set(monotonic() + seconds)
        try:
            return checked(function)(*args, **kwargs)
        finally:
            _photo_deadline.reset(token)

    return wrapped


def bind_photo_budget(function):
    """Executor workers do not automatically inherit ContextVars."""
    context = copy_context()

    @wraps(function)
    def wrapped(*args, **kwargs):
        return context.copy().run(checked(function), *args, **kwargs)

    return wrapped


def photo_completion(client, **options):
    """Keep mock/provider interfaces intact; disable real SDK automatic retries."""
    options["timeout"] = photo_timeout(options["timeout"])
    if _photo_deadline.get() is not None and isinstance(client, OpenAI):
        client = client.with_options(max_retries=0)
    return checked(client.chat.completions.create)(**options)


def photo_cache_run(cache, key, producer, *, cacheable=lambda value: True):
    """Do not publish expired work; retain earlier successful batch entries."""
    check_photo_budget()
    result = cache.run(key, checked(producer), cacheable=checked(cacheable))
    check_photo_budget()
    return result
