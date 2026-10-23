const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } }),
      calls = [],
      assist = [],
      errors = [];
    let lateText,
      lateChat,
      latePhoto,
      jaCalls = 0;
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      const original = window.fetch;
      window.fetch = (url, options = {}) => original(url, { ...options, signal: undefined });
    });
    await page.route("**/api/translate", async (route) => {
      const body = route.request().postDataJSON();
      calls.push(body);
      if (body.target === "ja") {
        if (body.text === "PERF FINAL" && ++jaCalls === 1) {
          lateText = route;
          return;
        }
        if (body.text === "LIVE PERF") {
          lateChat = route;
          return;
        }
        if (body.text === "PHOTO PERF") {
          latePhoto = route;
          return;
        }
      }
      await route.fulfill({
        json: {
          translation: `${body.target}:${body.text}`,
          source_language: body.source,
          additional_translations: (body.additional_targets || []).map((target) => ({
            target,
            pending: true,
          })),
        },
      });
    });
    await page.route("**/api/assist", (route) => {
      const body = route.request().postDataJSON();
      assist.push(body);
      return route.fulfill({ json: { pronunciation: "reading", alternatives: ["one", "two"] } });
    });
    await page.goto(process.env.TRANSLATOR_TEST_URL || "http://127.0.0.1:5000");
    await page.evaluate(() => {
      activeFeature().preferences.multiple = true;
      activeFeature().preferences.targets = ["ja", "fr"];
    });
    await page.locator("#input").fill("PERF FIRST");
    await page.waitForFunction(() => document.querySelector("#output").value === "en:PERF FIRST");
    await page.locator("#input").fill("PERF INTERMEDIATE");
    await page.locator("#input").fill("PERF FINAL");
    await page.waitForFunction(() => document.querySelector("#output").value === "en:PERF FINAL");
    await page.waitForFunction(() => activeFeature().additionalRequests.has("ja"));
    assert(lateText);
    assert.match(await page.locator("#status").textContent(), /Translation complete/);
    assert.equal(calls.filter((call) => call.text === "PERF INTERMEDIATE").length, 0);
    assert(!assist.some((call) => call.text === "PERF FIRST"));
    assert(
      calls.find((call) => call.text === "PERF FINAL" && call.target === "en").defer_additional
    );
    const before = calls.length;
    await page.evaluate(() => switchFeature("document"));
    await page.evaluate(() => switchFeature("text"));
    await page.waitForTimeout(80);
    assert.equal(calls.length, before);
    assert.equal(
      await page.evaluate(
        () => activeFeature().additional.find((item) => item.target === "ja").pending
      ),
      false
    );
    await lateText.fulfill({ json: { translation: "STALE EXTRA", source_language: "th" } });
    await page.waitForTimeout(50);
    assert(
      !(await page
        .locator("#additional-results")
        .textContent()
        .then((text) => text.includes("STALE EXTRA")))
    );
    await page
      .locator(".additional-result")
      .filter({ has: page.locator(".error") })
      .getByRole("button", { name: "Retry", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        activeFeature().additional.find((item) => item.target === "ja").translation ===
        "ja:PERF FINAL"
    );
    await page.locator("#regenerate").click();
    await page.waitForFunction(() => !activeFeature().request);
    assert(
      calls.some(
        (call) => call.text === "PERF FINAL" && call.target === "en" && call.cache_bypass === true
      )
    );

    // Primary chat messages render immediately; clearing cancels deferred additions.
    await page.evaluate(() => switchFeature("live"));
    await page.locator("#live-audio").click();
    await page.evaluate(() => {
      activeFeature().preferences.multiple = true;
      activeFeature().preferences.targets = ["ja"];
    });
    await page.locator("#input").fill("LIVE PERF");
    await page.locator("#live-send").click();
    await page.locator(".chat-turn").waitFor();
    await page.waitForFunction(() => activeFeature().chatRequests.size > 0);
    assert(lateChat);
    assert.equal(
      await page.locator(".chat-turn .translated-message").textContent(),
      "en:LIVE PERF"
    );
    await page.locator("#clear-chat").click();
    await lateChat.fulfill({ json: { translation: "STALE CHAT", source_language: "th" } });
    await page.waitForTimeout(80);
    assert.equal(await page.locator(".chat-turn").count(), 0);

    // A pending extra language must not delay or replace the translated photo.
    await page.evaluate(() => switchFeature("image"));
    const image = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 200;
      canvas.height = 120;
      activeFeature().preferences.multiple = true;
      activeFeature().preferences.targets = ["ja"];
      return canvas.toDataURL();
    });
    await page.route("**/api/photo-translate", (route) => {
      assert.match(route.request().postData(), /name="defer_additional"[\s\S]*?true/);
      return route.fulfill({
        json: {
          image,
          width: 200,
          height: 120,
          source_language: "en",
          target_language: "en",
          regions: [
            {
              id: 0,
              x: 5,
              y: 5,
              width: 180,
              height: 40,
              text: "PHOTO PERF",
              translation: "VISIBLE PHOTO",
              background: "#fff",
              foreground: "#111",
            },
          ],
          additional_translations: [{ target: "ja", pending: true }],
        },
      });
    });
    await page.locator("#photo-file-input").setInputFiles({
      name: "perf.png",
      mimeType: "image/png",
      buffer: Buffer.from(image.split(",")[1], "base64"),
    });
    await page.locator(".photo-label").first().waitFor();
    await page.waitForFunction(() => activeFeature().additionalRequests.has("ja"));
    assert(latePhoto);
    assert.equal(await page.locator(".photo-label").first().textContent(), "VISIBLE PHOTO");
    await page.evaluate(() => switchFeature("document"));
    await latePhoto.fulfill({ json: { translation: "STALE PHOTO EXTRA", source_language: "en" } });
    await page.waitForTimeout(60);
    assert.equal(await page.locator("#additional-results").isVisible(), false);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: primary results before deferred languages, debounced typing, deferred assistant cancellation, pause/retry ownership, explicit refresh bypass and canceled chat additions."
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
