const { chromium } = require("playwright");
const assert = require("node:assert/strict");

// Security headers must not break the page, data: photo previews or blob: audio.
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
    const violations = [];
    page.on("console", (message) => {
      if (/Content Security Policy|Refused to/i.test(message.text()))
        violations.push(message.text());
    });
    page.on("pageerror", (error) => violations.push(error.message));

    let headers = {};
    page.on("response", async (response) => {
      if (response.url() === (process.env.TRANSLATOR_TEST_URL || "http://127.0.0.1:5000") + "/") {
        headers = response.headers();
      }
    });

    const png =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    await page.route("**/api/photo-translate", (route) =>
      route.fulfill({
        json: {
          image: `data:image/png;base64,${png}`,
          width: 1,
          height: 1,
          regions: [
            {
              id: 0,
              x: 0,
              y: 0,
              width: 1,
              height: 1,
              text: "สวัสดี",
              translation: "Hello",
              background: "#ffffff",
              foreground: "#000000",
              reading_review: false,
              reading_verified: true,
              preserve_original: false,
            },
          ],
          source_language: "th",
          target_language: "en",
          translated_regions: 1,
          review_required: 0,
          protected_boxes: [],
          ocr_engine: "test",
        },
      })
    );
    await page.route("**/api/translate", (route) =>
      route.fulfill({ json: { translation: "Hello", source_language: "th" } })
    );
    await page.route("**/api/speech", (route) =>
      route.fulfill({ body: Buffer.alloc(256), contentType: "audio/mpeg" })
    );

    await page.goto(process.env.TRANSLATOR_TEST_URL || "http://127.0.0.1:5000", {
      waitUntil: "load",
    });
    const policy = headers["content-security-policy"] || "";
    assert(policy.includes("default-src 'self'"), "strict default-src");
    assert(policy.includes("img-src 'self' data: blob:"), "photo previews need data:");
    assert(policy.includes("frame-ancestors 'none'"));
    assert.equal(headers["x-content-type-options"], "nosniff");
    assert.equal(headers["referrer-policy"], "no-referrer");
    assert.match(headers["permissions-policy"] || "", /microphone=\(self\)/);

    // Exercise the two data:/blob: paths a too-strict policy would break.
    await page.evaluate(() => switchFeature("image"));
    await page.setInputFiles("#photo-file-input", {
      name: "one.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
    await page.waitForFunction(() => !document.querySelector("#photo-result").hidden);
    await page.evaluate(() => switchFeature("text"));
    await page.locator("#input").fill("สวัสดี");
    await page.waitForFunction(() => document.querySelector("#output").value === "Hello");

    assert.deepEqual(violations, [], violations.join("\n"));
    console.log("PASS security headers with data:/blob: media and no CSP violations.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
