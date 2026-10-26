/* Exercise the running backend without AI calls, including newly added styles. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(process.env.TRANSLATOR_TEST_URL || "http://127.0.0.1:5000");
    const styles = await page
      .locator("#tone option")
      .evaluateAll((options) => options.map((option) => option.value));
    assert.deepEqual(styles, ["standard", "natural", "formal", "casual", "friendly", "business"]);
    // Same-language requests use the real validator and skip the AI provider.
    // This catches an old Flask process serving new static menus but rejecting their values.
    for (const tone of styles) {
      const response = await page.request.post(new URL("/api/translate", page.url()).href, {
        data: { text: "Runtime style check", source: "en", target: "en", tone },
      });
      const body = await response.json();
      assert.equal(
        response.status(),
        200,
        `${tone}: ${body.error || "request failed"}. Restart Flask after backend changes.`
      );
      assert.equal(body.translation, "Runtime style check");
      assert.equal(body.quality_review.status, "not_requested");
    }
    assert.deepEqual(errors, []);
    console.log("PASS running backend accepts all six menu styles without AI calls.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
