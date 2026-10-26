const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(process.env.TRANSLATOR_TEST_URL || "http://127.0.0.1:5000");
    const image = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 240;
      canvas.height = 120;
      const context = canvas.getContext("2d");
      context.fillStyle = "#141414";
      context.fillRect(0, 0, 240, 120);
      context.fillStyle = "white";
      context.font = "bold 26px sans-serif";
      context.fillText("50", 170, 34);
      context.fillText("Thai menu", 8, 82);
      return canvas.toDataURL("image/png");
    });
    await page.route("**/api/photo-translate", (route) =>
      route.fulfill({
        json: {
          image,
          width: 240,
          height: 120,
          source_language: "th",
          target_language: "en",
          translated_regions: 1,
          review_required: 0,
          protected_boxes: [{ x: 150, y: 0, width: 90, height: 50 }],
          regions: [
            {
              x: 0,
              y: 5,
              width: 210,
              height: 70,
              text: "ข้าวผัด",
              translation: "Fried rice",
              background: "#aa0000",
              foreground: "#ffffff",
            },
            {
              x: 0,
              y: 88,
              width: 140,
              height: 30,
              text: "50 บาท",
              translation: "50 Baht",
              background: "#141414",
              foreground: "#ffffff",
            },
            // Deliberately wrong OCR: the original PNG says 50, the server text says 5.
            {
              x: 165,
              y: 10,
              width: 50,
              height: 30,
              text: "5",
              translation: "5",
              preserve_original: true,
            },
          ],
        },
      })
    );
    await page.evaluate(() => switchFeature("image"));
    await page.locator("#photo-file-input").setInputFiles({
      name: "price-50.png",
      mimeType: "image/png",
      buffer: Buffer.from(image.split(",")[1], "base64"),
    });
    await page.waitForFunction(() => photoData?.protected_boxes?.length === 1);
    await page.waitForFunction(
      () =>
        document
          .querySelector("#photo-main-stage .photo-protected")
          ?.getContext("2d")
          .getImageData(170, 20, 1, 1).data[3] === 255
    );
    assert.equal(await page.locator("#photo-main-stage .photo-label").count(), 2);
    assert.equal(await page.locator("#photo-number-note").isVisible(), true);
    assert(await page.getByRole("button", { name: "50 Baht", exact: true }).isVisible());
    await page.locator("#photo-fullscreen").click();
    assert.equal(await page.locator("#photo-viewer-stage .photo-label").count(), 2);
    assert(!(await page.locator("#photo-viewer-status").isVisible()));
    await page.locator("#photo-viewer-close").click();
    await page.evaluate(() => {
      window.exportedPhotoWords = [];
      const draw = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
        window.exportedPhotoWords.push(text);
        return draw.call(this, text, ...args);
      };
    });

    assert.equal(
      await page
        .locator("#photo-readings-list small")
        .evaluateAll((items) => items.some((item) => item.textContent === "5")),
      false
    );
    const displayMatches = await page.evaluate(async (src) => {
      const original = new Image();
      original.src = src;
      await original.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 240;
      canvas.height = 120;
      const context = canvas.getContext("2d");
      context.drawImage(original, 0, 0);
      const expected = context.getImageData(150, 0, 90, 50).data;
      const actual = document
        .querySelector("#photo-main-stage .photo-protected")
        .getContext("2d")
        .getImageData(150, 0, 90, 50).data;
      return expected.every((value, index) => value === actual[index]);
    }, image);
    assert.equal(
      displayMatches,
      true,
      "Displayed amount must preserve every source pixel, including the zero"
    );
    const event = page.waitForEvent("download");
    await page.locator("#photo-download").click();
    const download = await event;
    assert((await page.evaluate(() => window.exportedPhotoWords.join(""))).includes("50 Baht"));
    const exported = `data:image/png;base64,${(await fs.readFile(await download.path())).toString("base64")}`;
    const result = await page.evaluate(
      async ({ source, output }) => {
        async function pixels(src) {
          const img = new Image();
          img.src = src;
          await img.decode();
          const c = document.createElement("canvas");
          c.width = 240;
          c.height = 120;
          const ctx = c.getContext("2d");
          ctx.drawImage(img, 0, 0);
          return ctx.getImageData(0, 0, 240, 120).data;
        }
        const a = await pixels(source),
          b = await pixels(output);
        let preserved = true,
          changed = false;
        for (let y = 0; y < 120; y++)
          for (let x = 0; x < 240; x++)
            for (let ch = 0; ch < 4; ch++) {
              const i = (y * 240 + x) * 4 + ch;
              if (x >= 150 && y < 50) {
                if (a[i] !== b[i]) preserved = false;
              } else if (a[i] !== b[i]) changed = true;
            }
        return { preserved, changed };
      },
      { source: image, output: exported }
    );
    assert.equal(result.preserved, true, "Downloaded PNG must preserve original numeric pixels");
    assert.equal(result.changed, true, "The download must also contain the translated overlay");
    assert.deepEqual(errors, []);
    console.log(
      "PASS: original 50 survives wrong OCR 5, overlapping labels, and PNG export pixel for pixel."
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
