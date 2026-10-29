const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(process.env.TRANSLATOR_TEST_URL || "http://127.0.0.1:5000");
    const image = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 300;
      canvas.height = 180;
      return canvas.toDataURL();
    });
    const requests = new Map();
    const firstResponse = (name) =>
      page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/photo-translate") &&
          response.status() === 429 &&
          response.request().postData().includes(`filename="${name}.png"`)
      );
    await page.route("**/api/photo-translate", async (route) => {
      const body = route.request().postData(),
        name = ["persistent", "automatic", "cancel", "long-wait"].find((value) =>
          body.includes(`filename="${value}.png"`)
        );
      assert(name, "Each photo request must retain its original file");
      const attempt = (requests.get(name) || 0) + 1;
      requests.set(name, attempt);
      if (
        (name === "persistent" && attempt <= 2) ||
        (name === "automatic" && attempt === 1) ||
        name === "cancel" ||
        name === "long-wait"
      ) {
        const seconds = name === "long-wait" ? 60 : 1;
        await route.fulfill({
          status: 429,
          headers: { "Retry-After": String(seconds) },
          json: { error: "Rate limited", code: "rate_limit_exceeded", retry_after: seconds },
        });
        return;
      }
      return route.fulfill({
        json: {
          image,
          width: 300,
          height: 180,
          source_language: "th",
          target_language: "en",
          translated_regions: 1,
          review_required: 0,
          regions: [
            {
              x: 10,
              y: 10,
              width: 100,
              height: 25,
              text: "สวัสดี",
              translation: "Hello",
              background: "#ffffff",
              foreground: "#111111",
            },
          ],
        },
      });
    });
    const upload = (name) =>
      page.locator("#photo-file-input").setInputFiles({
        name: `${name}.png`,
        mimeType: "image/png",
        buffer: Buffer.from(image.split(",")[1], "base64"),
      });
    await page.evaluate(() => switchFeature("image"));
    await upload("persistent");
    await page.locator("#photo-error").waitFor({ state: "visible" });
    assert.equal(requests.get("persistent"), 2, "Persistent 429 stops after one automatic retry");
    assert.equal(await page.locator("#photo-download").count(), 0);
    await page.locator("#photo-fullscreen").click();
    const status = page.locator("#photo-viewer-status");
    assert(await status.isVisible());
    assert.match(await status.textContent(), /Translation not completed.*Original photo/s);
    assert.match(await status.textContent(), /usage limit/);
    assert(await page.locator("#photo-viewer-original").isDisabled());
    assert.equal(await page.locator("#photo-viewer-stage .photo-label").count(), 0);
    await page.locator("#photo-viewer-close").click();
    await page.waitForFunction(() => !document.querySelector("#photo-retry").disabled);
    await page.locator("#photo-retry").click();
    await page.waitForFunction(() => photoData?.translated_regions === 1);
    await page.locator("#photo-fullscreen").click();
    assert(await status.isHidden());
    assert(await page.locator("#photo-viewer-original").isEnabled());
    assert.equal(await page.locator("#photo-viewer-stage .photo-label").count(), 1);
    assert.equal(requests.get("persistent"), 3);
    await page.locator("#photo-viewer-close").click();

    // A brief quota wait recovers without presenting an intermediate failed result.
    const automaticResponse = firstResponse("automatic");
    await upload("automatic");
    await automaticResponse;
    assert(await page.locator("#photo-loading").isVisible());
    assert(await page.locator("#photo-error").isHidden());
    assert.equal(await page.locator("#photo-main-stage .photo-label").count(), 0);
    await page.waitForFunction(() => photoData?.translated_regions === 1);
    assert.equal(requests.get("automatic"), 2);
    assert(await page.locator("#photo-error").isHidden());
    assert.equal(await page.locator("#photo-main-stage .photo-label").count(), 1);

    // Leaving Image during the cooldown must not restart work in another feature.
    const canceledResponse = firstResponse("cancel");
    await upload("cancel");
    await canceledResponse;
    await page.evaluate(() => switchFeature("text"));
    await page.waitForTimeout(1200);
    assert.equal(requests.get("cancel"), 1);
    assert.equal(await page.locator("#output").inputValue(), "");

    // Longer limits preserve the explicit countdown and never silently replay the upload.
    await page.evaluate(() => switchFeature("image"));
    await upload("long-wait");
    await page.locator("#photo-error").waitFor({ state: "visible" });
    assert.equal(requests.get("long-wait"), 1);
    assert(await page.locator("#photo-retry").isDisabled());
    assert.match(await page.locator("#photo-retry-wait").textContent(), /\d+ seconds/);
    await page.waitForTimeout(1200);
    assert.equal(requests.get("long-wait"), 1);
    assert.equal(await page.locator("#photo-main-stage .photo-label").count(), 0);
    assert.deepEqual(errors, []);
    console.log(
      "PASS bounded photo 429 recovery, cancellation, long-wait countdown and original-only failure views."
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
