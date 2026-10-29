const { chromium } = require("playwright");
const assert = require("node:assert/strict");

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=",
      "base64"
    );
    let previewCount = 0,
      translations = 0,
      mixed = false,
      partial = false,
      release;
    await page.route("**/api/photo-preview", async (route) => {
      previewCount++;
      if (previewCount === 1) await new Promise((resolve) => (release = resolve));
      await route.fulfill({ contentType: "image/png", body: png }).catch(() => {});
    });
    await page.route("**/api/photo-translate", (route) => {
      translations++;
      return route.fulfill({
        json: {
          image: `data:image/png;base64,${png.toString("base64")}`,
          width: mixed ? 120 : 1,
          height: mixed ? 60 : 1,
          source_language: mixed ? "th" : "ar",
          target_language: "en",
          translated_regions: mixed && !partial ? 1 : 0,
          review_required: partial ? 1 : 0,
          regions: mixed
            ? [
                { x: 0, y: 0, width: 100, height: 20, text: "Menu", translation: "Menu" },
                {
                  x: 0,
                  y: 25,
                  width: 100,
                  height: 20,
                  text: "ข้าวผัด",
                  translation: "Fried rice",
                  reading_review: partial,
                },
              ]
            : [],
        },
      });
    });
    await page.goto(process.env.TRANSLATOR_TEST_URL || "http://127.0.0.1:5000");
    await page.evaluate(() => switchFeature("image"));
    const file = { name: "phone.heic", mimeType: "image/heic", buffer: Buffer.from("mock HEIC") };
    const firstPreview = page.waitForRequest("**/api/photo-preview");
    await page.locator("#photo-file-input").setInputFiles(file);
    await firstPreview;
    // Leaving while conversion is pending must not start translation or repaint another feature.
    await page.evaluate(() => switchFeature("text"));
    release();
    await page.waitForTimeout(150);
    assert.equal(translations, 0);
    assert.equal(await page.evaluate(() => mode), "text");
    await page.evaluate(() => switchFeature("image"));
    await page.locator("#photo-file-input").setInputFiles(file);
    await page.waitForFunction(() => photoData?.source_language === "ar");
    assert.equal(previewCount, 2);
    assert.equal(translations, 1);
    assert.equal(
      await page
        .locator("#photo-main-stage img")
        .evaluate((image) => image.complete && image.naturalWidth > 0),
      true
    );
    assert.equal(await page.locator("#photo-loading").isVisible(), false);
    assert.match(await page.locator("#photo-status").textContent(), /No text changed/);
    mixed = true;
    await page.locator("#photo-file-input").setInputFiles(file);
    await page.waitForFunction(() => photoData?.source_language === "th");
    assert.equal(await page.locator("#photo-main-stage .photo-label").count(), 1);
    assert.equal(await page.locator("#photo-main-stage .photo-label").textContent(), "Fried rice");
    assert.doesNotMatch(await page.locator("#photo-status").textContent(), /No text changed/);
    assert.match(await page.locator("#target-name").textContent(), /English/);
    await page.locator("#target-picker").click();
    assert.equal(await page.locator("#language-dialog").isVisible(), true);
    await page.locator("#language-dialog-close").click();
    assert(await page.locator("#photo-readings").evaluate((details) => details.open));
    assert.match(await page.locator("#photo-readings-list").textContent(), /Fried rice/);
    await page.locator("#photo-readings-list button").nth(1).click();
    assert.equal(await page.locator("#photo-label-dialog").isVisible(), true);
    await page.evaluate(() => document.querySelector("#photo-label-dialog").close());
    partial = true;
    await page.locator("#photo-file-input").setInputFiles(file);
    await page.waitForFunction(() => photoData?.review_required === 1);
    assert.match(await page.locator("#photo-status").textContent(), /need checking/);
    assert.equal(await page.locator("#photo-main-stage .photo-label").count(), 0);
    assert.equal((await page.locator("#photo-readings").getAttribute("open")) != null, true);
    assert.equal(await page.locator("#photo-readings-list button").nth(1).isDisabled(), true);
    assert.match(await page.locator("#photo-readings-list").textContent(), /Text unclear/);
    assert.deepEqual(errors, []);
    console.log(
      "Image formats: HEIC preview, mode isolation, mixed menus, and unchanged-result feedback passed."
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
