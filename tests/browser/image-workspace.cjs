/* Dense photo results offer readable translations without hiding essential photo controls. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      permissions: ["clipboard-read", "clipboard-write"],
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(process.env.TRANSLATOR_TEST_URL || "http://127.0.0.1:5000");
    const image = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 800;
      const context = canvas.getContext("2d");
      context.fillStyle = "#ebe3d6";
      context.fillRect(0, 0, 1200, 800);
      context.fillStyle = "#234b40";
      context.fillRect(0, 0, 1200, 90);
      context.fillStyle = "white";
      context.font = "bold 38px sans-serif";
      context.fillText("RIVER GARDEN MENU", 34, 56);
      for (let index = 0; index < 36; index++) {
        const x = 25 + (index % 6) * 195,
          y = 112 + Math.floor(index / 6) * 110;
        context.fillStyle = index % 2 ? "#d9b78a" : "#c4d7bd";
        context.fillRect(x, y, 180, 92);
        context.fillStyle = "#26312d";
        context.font = "19px sans-serif";
        context.fillText(`Dish ${index + 1}`, x + 10, y + 30);
        context.fillText(`${50 + index * 5} baht`, x + 10, y + 63);
      }
      return canvas.toDataURL("image/png");
    });
    const regions = Array.from({ length: 36 }, (_, index) => ({
      id: index,
      x: 25 + (index % 6) * 195,
      y: 112 + Math.floor(index / 6) * 110,
      width: 180,
      height: 92,
      text: `อาหารจานที่ ${index + 1}`,
      translation: `Garden dish ${index + 1} · ${50 + index * 5} baht`,
      background: index % 2 ? "#d9b78a" : "#c4d7bd",
      foreground: "#26312d",
    }));
    let variant = "clear",
      requests = 0;
    await page.route("**/api/photo-translate", (route) => {
      requests++;
      if (variant === "failure")
        return route.fulfill({ status: 503, json: { error: "Photo service unavailable" } });
      const partial = variant === "partial";
      return route.fulfill({
        json: {
          image,
          width: 1200,
          height: 800,
          source_language: "th",
          target_language: "en",
          translated_regions: partial ? 35 : 36,
          review_required: partial ? 1 : 0,
          regions: regions.map((region, index) => ({
            ...region,
            reading_review: partial && index === 5,
          })),
          audit: {
            status: partial ? "review" : "clear",
            issues: partial ? [{ kind: "numbers", missing: ["225"], added: ["25"] }] : [],
            terms_checked: 0,
            terms_matched: 0,
          },
          additional_translations: [],
        },
      });
    });
    const file = {
      name: "garden-menu.png",
      mimeType: "image/png",
      buffer: Buffer.from(image.split(",")[1], "base64"),
    };
    await page.locator('[data-mode="image"]').click();
    await page.locator("#photo-file-input").setInputFiles(file);
    await page.waitForFunction(() => photoData?.regions?.length === 36);
    await page.waitForFunction(() => document.querySelector("#photo-readings").open);
    assert.equal(await page.locator("#photo-readings-list .photo-reading").count(), 36);
    assert(
      await page.locator(".photo-mode-header").isHidden(),
      "Loaded photo has no duplicate language header"
    );
    assert(
      await page.locator("#target-picker").isVisible(),
      "Main language picker remains available"
    );
    assert.equal(
      await page.locator("#photo-status").textContent(),
      "",
      "Successful result has no repeated completion message"
    );
    assert(await page.locator("#photo-audit-details").isHidden(), "Clear audit adds no disclosure");
    assert.equal(await page.locator("#photo-main-stage .photo-label").count(), 36);
    for (const language of ["en", "th", "ar"]) {
      await page.evaluate((code) => changeInterfaceLanguage(code), language);
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 844 });
        await page.locator("#photo-readings-list .photo-reading").first().scrollIntoViewIfNeeded();
        const geometry = await page.evaluate(() => {
          const row = document.querySelector("#photo-readings-list .photo-reading"),
            output = row.querySelector("strong");
          return {
            pageWidth: document.documentElement.scrollWidth,
            rowWidth: row.getBoundingClientRect().width,
            rowScrollWidth: row.scrollWidth,
            rowHeight: row.getBoundingClientRect().height,
            fontSize: parseFloat(getComputedStyle(output).fontSize),
          };
        });
        assert(geometry.pageWidth <= width + 1, `${language} ${width}: no horizontal overflow`);
        assert(geometry.rowScrollWidth <= geometry.rowWidth + 1);
        assert(
          geometry.rowHeight >= 52 && geometry.fontSize >= 14,
          "Readable touch-sized readings"
        );
        assert.equal(await page.locator("#photo-readings").getAttribute("open"), "");
      }
    }
    await page.evaluate(() => changeInterfaceLanguage("en"));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const lastReading = page.locator("#photo-readings-list .photo-reading").last();
    const lastBounds = await lastReading.boundingBox();
    const navigationBounds = await page.locator(".bottom-bar").boundingBox();
    assert(
      lastBounds.y + lastBounds.height <= navigationBounds.y + 1,
      "The final reading remains reachable above fixed navigation"
    );
    await lastReading.click();
    assert.equal(await page.locator("#photo-label-text").textContent(), regions[35].translation);
    await page.locator("#photo-label-close").click();
    const firstReading = page.locator("#photo-readings-list .photo-reading").first();
    await firstReading.click();
    assert(await page.locator("#photo-label-dialog").isVisible());
    assert.equal(await page.locator("#photo-label-text").textContent(), regions[0].translation);
    await page.locator("#photo-label-copy").click();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), regions[0].translation);
    await page.locator("#photo-label-close").click();

    await page.locator("#photo-readings-title").click();
    assert.equal(await page.locator("#photo-readings").getAttribute("open"), null);
    await page.locator("#photo-original").click();
    assert.equal(await page.locator("#photo-original").getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator("#photo-main-stage .photo-label").count(), 0);
    assert.equal(
      await page.locator("#photo-readings").getAttribute("open"),
      null,
      "Manual fold survives original comparison"
    );
    await page.locator("#photo-original").click();
    assert.equal(await page.locator("#photo-main-stage .photo-label").count(), 36);
    assert.equal(await page.locator("#photo-readings").getAttribute("open"), null);
    await page.locator("#photo-fullscreen").click();
    assert(await page.locator("#photo-viewer").isVisible());
    assert.equal(await page.locator("#photo-viewer-stage .photo-label").count(), 36);
    const beforeZoom = await page
      .locator("#photo-viewer-stage")
      .evaluate((stage) => stage.offsetWidth);
    await page.locator("#photo-zoom-in").click();
    assert.equal(await page.locator("#photo-zoom-level").textContent(), "150%");
    assert(
      (await page.locator("#photo-viewer-stage").evaluate((stage) => stage.offsetWidth)) >
        beforeZoom
    );
    await page.locator("#photo-viewer-original").click();
    assert.equal(await page.locator("#photo-viewer-stage .photo-label").count(), 0);
    await page.locator("#photo-viewer-original").click();
    await page.locator("#photo-viewer-close").click();
    assert.equal(requests, 1, "Reading, comparison and zoom do not request translation again");

    variant = "partial";
    const chooser = page.waitForEvent("filechooser");
    await page.locator("#photo-change").click();
    await (await chooser).setFiles({ ...file, name: "garden-menu-partial.png" });
    await page.waitForFunction(() => photoData?.review_required === 1);
    assert.equal(
      await page.locator("#photo-readings").getAttribute("open"),
      "",
      "A new photo starts with readings open"
    );
    const uncertain = page.locator("#photo-readings-list .photo-reading").nth(5);
    assert(await uncertain.isDisabled());
    assert.match(await uncertain.textContent(), /Text unclear/);
    assert.equal(await page.locator("#photo-main-stage .photo-label").count(), 35);
    assert(
      await page.locator("#photo-audit-details").isVisible(),
      "Actual audit issues remain visible"
    );
    await page.locator("#photo-audit-summary").click();
    assert.match(await page.locator("#photo-audit-content").textContent(), /225/);

    variant = "failure";
    await page
      .locator("#photo-file-input")
      .setInputFiles({ ...file, name: "garden-menu-failed.png" });
    await page.locator("#photo-error").waitFor();
    assert(await page.locator("#photo-readings").isHidden());
    assert.equal(await page.locator("#photo-main-stage .photo-label").count(), 0);
    await page.locator("#photo-fullscreen").click();
    assert.match(
      await page.locator("#photo-viewer-status").textContent(),
      /Translation not completed/
    );
    assert(await page.locator("#photo-viewer-original").isDisabled());
    await page.locator("#photo-viewer-close").click();
    await page.locator("#photo-remove").click();
    assert(await page.locator("#photo-empty").isVisible());
    assert(await page.locator("#photo-result").isHidden());
    assert.deepEqual(errors, []);
    console.log(
      "PASS dense photo readings, accessible photo controls, detail/copy/zoom, partial results, failure recovery and RTL layouts."
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
