"""Gzip known-length text responses without losing file ownership or streaming APIs."""

import gzip

COMPRESSIBLE = {
    "text/html",
    "text/css",
    "text/plain",
    "application/json",
    "application/javascript",
    "text/javascript",
    "application/manifest+json",
    "image/svg+xml",
}


def compress_response(response, request):
    eligible_path = request.path == "/" or request.path.startswith(("/api/", "/static/"))
    if not eligible_path or response.mimetype not in COMPRESSIBLE:
        return response
    # Vary must also be present on conditional responses for cached variants.
    response.vary.add("Accept-Encoding")
    if (
        response.status_code != 200
        or request.method == "HEAD"
        or "Range" in request.headers
        or "Content-Range" in response.headers
        or "Content-Encoding" in response.headers
        or response.cache_control.no_transform
        or request.accept_encodings["gzip"] <= 0
        or not 1024 <= (response.content_length or 0) <= 2 * 1024 * 1024
        or (response.is_streamed and not response.direct_passthrough)
    ):
        return response
    if response.direct_passthrough:
        # Werkzeug retains the original iterable.close as an on-close callback.
        # Never consume a file iterator and replace it without preserving ownership.
        response.direct_passthrough = False
        response.make_sequence()
    body = response.get_data()
    compressed = gzip.compress(body, compresslevel=4, mtime=0)
    if len(compressed) < len(body):
        response.set_data(compressed)
        response.headers["Content-Encoding"] = "gzip"
        response.headers.pop("Accept-Ranges", None)
        etag, _weak = response.get_etag()
        if etag is not None:
            response.set_etag(etag, weak=True)
    return response
