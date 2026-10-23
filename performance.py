"""Bounded process-local result reuse and ordered, limited parallel work."""

import copy
import hashlib
import json
import threading
import time
from collections import OrderedDict
from collections.abc import Callable, Hashable, Iterable
from concurrent.futures import Future, ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeoutError
from typing import Any, TypeVar

T = TypeVar("T")
U = TypeVar("U")


def digest_key(value: Any) -> bytes:
    if isinstance(value, bytes):
        return hashlib.sha256(value).digest()
    return hashlib.sha256(
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    ).digest()


def ordered_map(
    pool: ThreadPoolExecutor, function: Callable[[T], U], items: Iterable[T]
) -> list[U]:
    """Run bounded parallel work in input order; cancel work not yet started on error."""
    futures = [pool.submit(function, item) for item in items]
    try:
        return [future.result() for future in futures]
    except BaseException:
        for future in futures:
            future.cancel()
        raise


class ResultCache:
    """Cache successes only; concurrent identical requests share one producer.

    Values never touch disk. Limits apply to both entry count and serialized result
    bytes. Consumers receive separate copies, preventing mutation of cached state.
    """

    def __init__(self, max_entries=128, max_bytes=8 * 1024 * 1024, ttl=300, wait_timeout=180):
        self.max_entries, self.max_bytes, self.ttl = max_entries, max_bytes, ttl
        self.wait_timeout = wait_timeout
        self._entries: OrderedDict[Hashable, tuple[float, Any, int]] = OrderedDict()
        self._inflight: dict[Hashable, Future[Any]] = {}
        self._bytes = 0
        self._lock = threading.Lock()

    def clear(self):
        with self._lock:
            self._entries.clear()
            self._bytes = 0

    def run(
        self,
        key: Hashable,
        producer: Callable[[], T],
        *,
        cacheable: Callable[[T], bool] = lambda value: True,
        bypass: bool = False,
    ) -> tuple[T, str]:
        if bypass:
            return producer(), "bypass"
        now = time.monotonic()
        with self._lock:
            # Remove all expired values, including entries not requested again.
            for expired in [item for item, record in self._entries.items() if record[0] <= now]:
                self._bytes -= self._entries.pop(expired)[2]
            if key in self._entries:
                self._entries.move_to_end(key)
                return copy.deepcopy(self._entries[key][1]), "hit"
            future = self._inflight.get(key)
            owner = future is None
            if owner:
                future = Future()
                self._inflight[key] = future
        assert future is not None
        if not owner:
            try:
                return copy.deepcopy(future.result(timeout=self.wait_timeout)), "shared"
            except FutureTimeoutError as error:
                raise RuntimeError("คำขอนี้ใช้เวลานานเกินไป กรุณาลองใหม่") from error
        try:
            value = producer()
            if cacheable(value):
                size = (
                    len(value)
                    if isinstance(value, bytes)
                    else len(json.dumps(value, ensure_ascii=False).encode())
                )
                if size <= self.max_bytes and self.max_entries > 0:
                    snapshot = copy.deepcopy(value)
                    with self._lock:
                        while self._entries and (
                            len(self._entries) >= self.max_entries
                            or self._bytes + size > self.max_bytes
                        ):
                            _, record = self._entries.popitem(last=False)
                            self._bytes -= record[2]
                        self._entries[key] = (time.monotonic() + self.ttl, snapshot, size)
                        self._bytes += size
            future.set_result(copy.deepcopy(value))
            return value, "miss"
        except BaseException as error:
            future.set_exception(error)
            raise
        finally:
            with self._lock:
                self._inflight.pop(key, None)
