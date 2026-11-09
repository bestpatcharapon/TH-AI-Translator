/* App-shell cache only. Translation/API traffic is never stored here, so private text,
   photos and audio stay out of the cache and offline use cannot return stale translations. */
const SHELL_CACHE_PREFIX = "th-translator-shell-";
const SHELL_CACHE = `${SHELL_CACHE_PREFIX}v2`;
const SHELL = [
  "/",
  "/api/language-catalog.js",
  "/static/style.css?v=perf-v20",
  "/static/workspaces.js",
  "/static/app.js",
  "/static/enhancements.js",
  "/static/photo.js",
  "/static/live.js",
  "/static/languages.js",
  "/static/voice.js",
  "/static/menu.js",
  "/static/studio.js",
  "/static/thai.js",
  "/static/interface-locales.js",
  "/static/interface.js",
  "/static/notices.js",
  "/static/document.js",
  "/static/multilingual.js",
  "/static/offline.js",
  "/static/brand/logo-96.png",
  "/static/brand/logo-192.png",
  "/static/fonts/IBMPlexSansThai-Regular.woff2",
  "/static/fonts/IBMPlexSansThai-Medium.woff2",
  "/static/fonts/IBMPlexSansThai-SemiBold.woff2",
  "/static/fonts/IBMPlexSansThai-Bold.woff2",
  "/static/fonts/SpaceGrotesk-Variable.woff2",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(SHELL_CACHE_PREFIX) && key !== SHELL_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function cacheable(request, url) {
  if (request.method !== "GET" || url.origin !== self.location.origin) return false;
  if (url.pathname === "/api/language-catalog.js") return true;
  return url.pathname === "/" || url.pathname.startsWith("/static/");
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (!cacheable(event.request, url)) return;
  // Network first keeps deployments fresh; the cache only answers when offline.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() =>
        caches
          .match(event.request, { ignoreSearch: url.pathname.startsWith("/static/fonts/") })
          .then((hit) => hit || (event.request.mode === "navigate" ? caches.match("/") : hit))
          .then((hit) => hit || Response.error())
      )
  );
});
