const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const { readFileSync } = require("node:fs");
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ serviceWorkers: "block" });
    // Serve checked-in assets through Playwright; no server or live APIs are needed.
    const staticRoot = path.resolve(__dirname, "../../static");
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== "http://translator.test") return route.abort();
      if (url.pathname === "/api/language-catalog.js")
        return route.fulfill({
          contentType: "application/javascript",
          body: `const LANGUAGE_CATALOG = ${readFileSync(path.join(staticRoot, "language-catalog.json"), "utf8")};`,
        });
      if (url.pathname.startsWith("/api/")) return route.fulfill({ json: {} });
      const file = path.resolve(
        staticRoot,
        url.pathname === "/" ? "index.html" : `.${url.pathname.replace(/^\/static/, "")}`
      );
      if (!file.startsWith(`${staticRoot}${path.sep}`)) return route.abort();
      return route.fulfill({ path: file });
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.stack));
    await page.clock.install({ time: new Date("2026-10-26T00:00:00Z") });
    await page.clock.pauseAt(new Date("2026-10-26T00:00:01Z"));
    await page.goto("http://translator.test");
    const ids = [
      "status",
      "live-status",
      "voice-status",
      "file-status",
      "source-info-status",
      "suggestion-status",
      "reply-edit-status",
      "menu-status",
      "glossary-status",
      "thai-lexicon-status",
      "photo-status",
      "photo-label-status",
      "photo-camera-status",
      "interface-language-status",
      "studio-status",
    ];
    await page.evaluate((ids) => {
      for (const id of ids) {
        document.getElementById(id).textContent = `Notice: ${id}`;
        document.getElementById(id).classList.add("error");
      }
    }, ids);
    await page.clock.fastForward(2999);
    assert(
      await page.evaluate((ids) => ids.every((id) => document.getElementById(id).textContent), ids)
    );
    await page.clock.fastForward(1);
    assert(
      await page.evaluate(
        (ids) =>
          ids.every((id) => {
            const node = document.getElementById(id);
            return !node.textContent && !node.classList.contains("error");
          }),
        ids
      )
    );

    // A fresh notice, including a repeated identical message, gets its own three seconds.
    await page.evaluate(() => setStatus(t("copied")));
    await page.clock.fastForward(2000);
    await page.evaluate(() => setStatus(t("copied")));
    await page.clock.fastForward(1000);
    assert(await page.locator("#status").textContent());
    await page.clock.fastForward(1999);
    assert(await page.locator("#status").textContent());
    await page.clock.fastForward(1);
    assert.equal(await page.locator("#status").textContent(), "");

    // Work-in-progress and actual AI output are content, not transient notices.
    await page.evaluate(() => {
      setStatus(t("loading"));
      voiceStatus(t("recording"));
      fileStatus(t("extracting"));
      document.getElementById("explanation-text").textContent = "A useful explanation.";
      document.getElementById("check-text").textContent = "A translation review.";
    });
    await page.clock.fastForward(5000);
    for (const id of ["status", "voice-status", "file-status", "explanation-text", "check-text"])
      assert(await page.locator(`#${id}`).textContent(), `${id} must remain`);
    await page.evaluate(() => featureStatus("explanation-text", "Review unavailable", true));
    await page.clock.fastForward(3000);
    assert.equal(await page.locator("#explanation-text").textContent(), "");

    // An action appended after a timer starts cancels that timer, but removing the
    // action makes the remaining message transient again.
    await page.evaluate(() => featureStatus("source-info-status", "Try again", true));
    await page.clock.fastForward(2000);
    await page.evaluate(() => {
      const retry = document.createElement("button");
      retry.textContent = "Retry";
      document.getElementById("source-info-status").append(" ", retry);
    });
    await page.clock.fastForward(5000);
    assert.equal(await page.locator("#source-info-status button").count(), 1);
    await page.evaluate(() => document.querySelector("#source-info-status button").remove());
    await page.clock.fastForward(2999);
    assert(await page.locator("#source-info-status").textContent());
    await page.clock.fastForward(1);
    assert.equal(await page.locator("#source-info-status").textContent(), "");

    // Exercise the real enhancements.js recovery control, not a lookalike button.
    let attempts = 0;
    await page.route("**/api/assist", (route) => {
      attempts += 1;
      return route.fulfill({
        status: attempts === 1 ? 503 : 200,
        json:
          attempts === 1
            ? { error: "Examples unavailable" }
            : { alternatives: ["Recovered example"], source_language: "th" },
      });
    });
    await page.evaluate(async () => {
      currentTranslation = {
        text: "สวัสดี",
        translation: "Hello",
        source: "th",
        target: "en",
      };
      await loadSourceInfo();
    });
    await page.clock.fastForward(10000);
    const retry = page.locator("#source-info-status button");
    assert(await retry.isVisible(), "Retry must survive the ordinary notice timeout");
    await retry.click();
    await page.locator("#source-alternatives button").waitFor();
    assert.equal(attempts, 2, "Retry must issue exactly one new request");
    assert.equal(await page.locator("#source-info-status").textContent(), "");
    assert.equal(await page.locator("#source-alternatives").textContent(), "Recovered example");

    // Departing dismisses the action before assistant state is saved as plain text.
    // Do this in one task to also cover undelivered MutationObserver records.
    await page.evaluate(() => {
      featureStatus("source-info-status", "Old recovery", true);
      const retry = document.createElement("button");
      retry.textContent = "Retry";
      document.getElementById("source-info-status").append(retry);
      switchFeature("document");
      featureStatus("source-info-status", "Document notice");
    });
    assert.equal(await page.locator("#source-info-status").textContent(), "Document notice");
    await page.clock.fastForward(2000);
    assert.equal(await page.locator("#source-info-status").textContent(), "Document notice");
    await page.evaluate(() => switchFeature("text"));
    assert.equal(await page.locator("#source-info-status").textContent(), "");
    await page.clock.fastForward(5000);
    assert.equal(await page.locator("#source-info-status").textContent(), "");

    // A departed feature cannot resurrect its notice or clear another feature's message.
    await page.evaluate(() => {
      setStatus(t("copied"));
      switchFeature("document");
      setStatus("New feature notice");
    });
    await page.clock.fastForward(2000);
    assert.equal(await page.locator("#status").textContent(), "New feature notice");
    await page.evaluate(() => switchFeature("text"));
    assert.equal(await page.locator("#status").textContent(), "");
    await page.clock.fastForward(5000);
    assert.deepEqual(errors, []);
    console.log(
      "PASS transient notices, actionable Retry retention/recovery/dismissal, progress, review content and feature isolation."
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
