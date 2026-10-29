/* Short rate-limit recovery remains bounded and belongs to the original feature. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [],
      requests = new Map();
    page.on("pageerror", (error) => errors.push(error.message));
    const count = (key) => {
      requests.set(key, (requests.get(key) || 0) + 1);
      return requests.get(key);
    };
    const limited = (route, seconds = 1) =>
      route.fulfill({
        status: 429,
        headers: { "Retry-After": String(seconds) },
        json: { error: "Rate limited", code: "rate_limit_exceeded", retry_after: seconds },
      });
    await page.route("**/api/translate", (route) => {
      const body = route.request().postDataJSON();
      const attempt = count(body.text);
      if (body.text === "cancel" || body.text === "persistent") return limited(route);
      if (body.text === "long wait") return limited(route, 60);
      if (attempt === 1) return limited(route);
      return route.fulfill({
        json: {
          translation: "Recovered translation",
          source_language: "en",
          additional_translations: [],
          audit: { status: "clear", issues: [] },
        },
      });
    });
    await page.route("**/api/assist", (route) => {
      const body = route.request().postDataJSON();
      if (body.action === "explain" && count("explain") === 1) return limited(route);
      return route.fulfill({
        json:
          body.action === "explain"
            ? { explanation: "Recovered explanation" }
            : { alternatives: ["Example one", "Example two"] },
      });
    });
    await page.route("**/api/analyze", (route) => {
      if (count("analyze") === 1) return limited(route);
      return route.fulfill({
        json: {
          assessment: "good",
          summary: "Recovered review",
          alternatives: [],
          issues: [],
          questions: [],
          revision: "",
          back_translation: "Original text",
          audit: { status: "clear", issues: [] },
        },
      });
    });
    await page.goto(process.env.TRANSLATOR_TEST_URL || "http://127.0.0.1:5000");
    await page.locator("#input").fill("recover");
    await page.waitForFunction(() => document.querySelector("#output").value !== "");
    assert.equal(requests.get("recover"), 2);
    await page.locator("#explain").click();
    await page.waitForFunction(() =>
      document.querySelector("#explanation-text").textContent.includes("Recovered explanation")
    );
    assert.equal(requests.get("explain"), 2);
    await page.locator("#open-studio").click();
    await page.waitForFunction(() => studioState().analysis?.summary === "Recovered review");
    assert.equal(requests.get("analyze"), 2);

    await page.locator("#input").fill("persistent");
    await page.waitForFunction(
      () => document.querySelector("#status").textContent === "Rate limited"
    );
    assert.equal(requests.get("persistent"), 2, "Persistent 429 must stop after one retry");
    await page.locator("#input").fill("long wait");
    await page.waitForFunction(
      () => document.querySelector("#status").textContent === "Rate limited"
    );
    assert.equal(requests.get("long wait"), 1, "Long quota waits must remain explicit retries");

    const canceledRequest = page.waitForRequest((request) => {
      if (!request.url().endsWith("/api/translate")) return false;
      return request.postDataJSON()?.text === "cancel";
    });
    await page.locator("#input").fill("cancel");
    await canceledRequest;
    await page.evaluate(() => switchFeature("document"));
    await page.waitForTimeout(1200);
    assert.equal(requests.get("cancel"), 1, "Changing feature cancels the pending retry");
    assert.equal(await page.locator("#output").inputValue(), "");
    assert.deepEqual(errors, []);
    console.log(
      "PASS short 429 recovery for translation/assistant/review, bounded attempts, long waits and cancellation."
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
