/* Static-only browser regression: no Flask, credentials or AI provider required.
 * Run: node tests/browser/request-scheduling.cjs
 */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const { readFileSync } = require("node:fs");

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const staticRoot = path.resolve(__dirname, "../../static");
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== "http://translator.test") return route.abort();
      if (url.pathname === "/api/language-catalog.js")
        return route.fulfill({
          contentType: "application/javascript",
          body: `const LANGUAGE_CATALOG = ${readFileSync(path.join(staticRoot, "language-catalog.json"), "utf8")};`,
        });
      const file = path.resolve(
        staticRoot,
        url.pathname === "/" ? "index.html" : `.${url.pathname.replace(/^\/static/, "")}`
      );
      if (!file.startsWith(`${staticRoot}${path.sep}`)) return route.abort();
      return route.fulfill({ path: file });
    });
    await page.addInitScript(() => {
      window.translationCalls = [];
      // Deliberately finish after abort to test ownership, not just transport cancellation.
      window.fetch = (url, options = {}) => {
        if (url !== "/api/translate")
          return Promise.resolve(new Response(JSON.stringify({ alternatives: [] })));
        return new Promise((resolve) => {
          window.translationCalls.push({
            body: JSON.parse(options.body),
            signal: options.signal,
            finish(data = {}) {
              resolve(
                new Response(JSON.stringify({ translation: "RESULT", ...data }), {
                  headers: { "Content-Type": "application/json" },
                })
              );
            },
          });
        });
      };
    });
    // Freeze wall-clock advancement before loading the app. Only runFor() should
    // move the debounce timer, regardless of how fast the CI runner executes commands.
    await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
    await page.clock.pauseAt(new Date("2026-01-01T00:01:00Z"));
    await page.goto("http://translator.test");
    const count = () => page.evaluate(() => window.translationCalls.length);
    const submit = () => page.locator("#input").press("Control+Enter");
    const finish = (index, translation) =>
      page.evaluate(
        ([index, translation]) => window.translationCalls[index].finish({ translation }),
        [index, translation]
      );
    const output = (value) =>
      page.waitForFunction((value) => document.querySelector("#output").value === value, value);

    // A manual submit consumes the typing timer; repeated submits keep its owner alive.
    await page.locator("#input").fill("FIRST");
    await submit();
    await submit();
    await page.clock.runFor(500);
    assert.equal(await count(), 1, "Identical pending submissions must not restart requests");
    assert.equal(await page.evaluate(() => window.translationCalls[0].signal.aborted), false);
    await finish(0, "FIRST RESULT");
    await output("FIRST RESULT");

    // A held shortcut must not resend even after the preceding request has completed.
    await page.locator("#input").dispatchEvent("keydown", {
      key: "Enter",
      ctrlKey: true,
      repeat: true,
    });
    assert.equal(await count(), 1);
    await page.locator("#input").dispatchEvent("keydown", {
      key: "Enter",
      ctrlKey: true,
      isComposing: true,
    });
    assert.equal(await count(), 1, "IME confirmation must not submit a translation");

    // Changed payloads replace the request, but an old finally must not clear the new owner.
    await page.locator("#input").fill("OLD");
    await submit();
    await page.locator("#input").fill("NEW");
    await submit();
    assert.equal(await count(), 3);
    assert.equal(await page.evaluate(() => window.translationCalls[1].signal.aborted), true);
    await finish(1, "STALE RESULT");
    await page.evaluate(() => new Promise((resolve) => queueMicrotask(resolve)));
    assert.equal(await page.locator("#output").inputValue(), "");
    assert.equal(await page.evaluate(() => !!activeFeature().request), true);
    assert.equal(await page.locator(".output-panel").getAttribute("aria-busy"), "true");
    await finish(2, "NEW RESULT");
    await output("NEW RESULT");

    // Full payload identity matters: a refresh supersedes a normal request, then deduplicates.
    await submit();
    await page.evaluate(() => {
      translate({ refresh: true });
      translate({ refresh: true });
    });
    assert.equal(await count(), 5);
    assert.equal(await page.evaluate(() => window.translationCalls[3].signal.aborted), true);
    assert.equal(await page.evaluate(() => window.translationCalls[4].body.cache_bypass), true);
    await finish(4, "REFRESHED");
    await output("REFRESHED");
    await finish(3, "STALE NORMAL");
    await page.evaluate(() => new Promise((resolve) => queueMicrotask(resolve)));
    assert.equal(await page.locator("#output").inputValue(), "REFRESHED");

    // Rapid typing is trailing-edge debounced, and leaving cancels rather than resumes it.
    await page.locator("#input").fill("INTERMEDIATE");
    await page.clock.runFor(300);
    await page.locator("#input").fill("FINAL");
    await page.clock.runFor(449);
    assert.equal(await count(), 5);
    await page.clock.runFor(1);
    assert.equal(await count(), 6);
    assert.equal(await page.evaluate(() => window.translationCalls[5].body.text), "FINAL");
    await page.evaluate(() => switchFeature("document"));
    await finish(5, "STALE FEATURE");
    await page.evaluate(() => switchFeature("text"));
    await page.locator("#input").fill("CANCELED TIMER");
    await page.evaluate(() => {
      switchFeature("document");
      switchFeature("text");
    });
    await page.clock.runFor(500);
    assert.equal(await count(), 6);
    assert.equal(await page.locator("#output").inputValue(), "");
    assert.deepEqual(errors, []);
    console.log(
      "PASS identical in-flight deduplication, shortcut repeat/IME guards, stale ownership, refresh bypass, typing debounce and feature cancellation."
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
