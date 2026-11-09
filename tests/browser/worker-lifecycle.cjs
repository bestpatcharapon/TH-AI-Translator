/* Server-free service-worker lifecycle/offline regression harness. */
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const origin = "https://translator.test";
const source = readFileSync(path.resolve(__dirname, "../../static/sw.js"), "utf8");

function harness({ installFails = false } = {}) {
  const listeners = new Map();
  const stores = new Map();
  const deleted = [];
  const fetched = [];
  let offline = false;
  let skipped = 0;
  let claimed = 0;
  let installed = [];
  const key = (request) =>
    new URL(typeof request === "string" ? request : request.url, origin).href;
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name);
      return {
        async addAll(urls) {
          installed = [...urls];
          if (installFails) throw new Error("Shell download failed");
          for (const url of urls) entries.set(key(url), new Response(`shell:${url}`));
        },
        async put(request, response) {
          entries.set(key(request), response);
        },
      };
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(name) {
      deleted.push(name);
      return stores.delete(name);
    },
    async match(request, options = {}) {
      for (const entries of stores.values()) {
        for (const [url, response] of entries) {
          const matches = options.ignoreSearch
            ? url.split("?")[0] === key(request).split("?")[0]
            : url === key(request);
          if (matches) return response.clone();
        }
      }
    },
  };
  vm.runInNewContext(source, {
    URL,
    Response,
    caches,
    self: {
      location: { origin },
      addEventListener: (name, handler) => listeners.set(name, handler),
      skipWaiting: async () => {
        skipped += 1;
      },
      clients: {
        claim: async () => {
          assert(!stores.has("th-translator-shell-v1"), "Cleanup must finish before claim");
          claimed += 1;
        },
      },
    },
    fetch: async (request) => {
      fetched.push(request.url);
      if (offline) throw new TypeError("Offline");
      return new Response("network asset");
    },
  });
  return {
    stores,
    deleted,
    fetched,
    get installed() {
      return installed;
    },
    get skipped() {
      return skipped;
    },
    get claimed() {
      return claimed;
    },
    set offline(value) {
      offline = value;
    },
    async lifecycle(name) {
      let completion;
      listeners.get(name)({
        waitUntil(promise) {
          completion = promise;
        },
      });
      assert(completion, `${name} must keep the worker alive`);
      await completion;
    },
    async request(url, { method = "GET", mode = "cors" } = {}) {
      let response;
      listeners.get("fetch")({
        request: { url: key(url), method, mode },
        respondWith(promise) {
          response = promise;
        },
      });
      return response;
    },
  };
}

(async () => {
  const worker = harness();
  worker.stores.set("th-translator-shell-v1", new Map());
  worker.stores.set("th-translator-shell-v0", new Map());
  const unrelated = new Map([[`${origin}/other-app`, new Response("Other app data")]]);
  worker.stores.set("other-app-cache-v1", unrelated);
  worker.stores.set("th-translator-dictionary-v1", new Map());
  worker.stores.set("other-th-translator-shell-v1", new Map());
  await worker.lifecycle("install");
  assert.equal(worker.skipped, 1);
  const currentCache = [...worker.stores.keys()].find(
    (name) =>
      name.startsWith("th-translator-shell-") &&
      !["th-translator-shell-v0", "th-translator-shell-v1"].includes(name)
  );
  assert(currentCache, "Install must populate the current shell cache");
  assert(worker.installed.includes("/static/notices.js"));
  assert(worker.installed.includes("/api/language-catalog.js"));
  assert(
    worker.installed.every((url) => !url.startsWith("/api/") || url === "/api/language-catalog.js")
  );
  await worker.lifecycle("activate");
  assert.deepEqual(worker.deleted.sort(), ["th-translator-shell-v0", "th-translator-shell-v1"]);
  assert(worker.stores.has(currentCache), "Activation must retain the current shell");
  assert.equal(worker.stores.get("other-app-cache-v1"), unrelated);
  assert.equal(await unrelated.get(`${origin}/other-app`).text(), "Other app data");
  assert.equal(worker.claimed, 1);

  // Network-first refresh, followed by offline access to the updated shell asset.
  assert.equal(await (await worker.request("/static/notices.js")).text(), "network asset");
  worker.offline = true;
  assert.equal(await (await worker.request("/static/notices.js")).text(), "network asset");
  assert.equal(await (await worker.request("/", { mode: "navigate" })).text(), "shell:/");
  assert.equal(
    await (await worker.request("/static/fonts/IBMPlexSansThai-Regular.woff2?v=new")).text(),
    "shell:/static/fonts/IBMPlexSansThai-Regular.woff2"
  );
  assert.equal((await worker.request("/static/not-cached.js")).type, "error");

  // Private API traffic and foreign origins must bypass the worker entirely.
  const fetchCount = worker.fetched.length;
  for (const [url, options] of [
    ["/api/translate", { method: "POST" }],
    ["/api/assist", { method: "POST" }],
    ["/api/photo", { method: "POST" }],
    ["/api/transcribe", { method: "POST" }],
    ["/api/translate?text=private", {}],
    ["/static/private", { method: "POST" }],
    ["https://other.test/static/app.js", {}],
  ])
    assert.equal(await worker.request(url, options), undefined, `${url} must bypass caching`);
  assert.equal(worker.fetched.length, fetchCount);
  assert.equal(
    await (await worker.request("/api/language-catalog.js")).text(),
    "shell:/api/language-catalog.js"
  );

  const failed = harness({ installFails: true });
  await assert.rejects(failed.lifecycle("install"), /Shell download failed/);
  assert.equal(failed.skipped, 0, "An incomplete shell must not replace the installed worker");
  console.log(
    "PASS worker install/activate, owned-cache cleanup, offline shell and private API bypass."
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
