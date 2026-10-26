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
    let requests = 0;
    await page.route("**/api/photo-translate", (route) => {
      requests++;
      if (requests === 1)
        return route.fulfill({
          status: 429,
          headers: { "Retry-After": "1" },
          json: { error: "Rate limited", code: "rate_limit_exceeded", retry_after: 1 },
        });
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
    await page.evaluate(() => switchFeature("image"));
    await page.locator("#photo-file-input").setInputFiles({
      name: "menu.png",
      mimeType: "image/png",
      buffer: Buffer.from(image.split(",")[1], "base64"),
    });
    await page.locator("#photo-error").waitFor({ state: "visible" });
    assert(await page.locator("#photo-download").isHidden());
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
    assert.equal(requests, 2);
    assert.deepEqual(errors, []);
    console.log(
      "PASS photo 429 shows original/failure in fullscreen, retry recovers without stale warning."
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
