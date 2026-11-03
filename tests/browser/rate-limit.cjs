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
      const key = body.target === "vi" ? `vi:${body.text}` : body.text;
      const attempt = count(key);
      if (body.target === "vi") {
        if (body.text === "additional long wait") return limited(route, 60);
        if (
          body.text === "additional cancel" ||
          body.text === "additional persistent" ||
          attempt === 1
        )
          return limited(route);
        return route.fulfill({
          json: { translation: "Recovered Vietnamese", source_language: "th" },
        });
      }
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

    // Deferred languages use the same bounded retry as the primary translation.
    const additional = (text) =>
      page.evaluate((text) => {
        recordTranslationGroup({
          text,
          source: "th",
          target: "en",
          tone: "natural",
          translation: "Primary stays visible",
          additional_translations: [{ target: "vi", pending: true }],
        });
      }, text);
    await additional("additional recover");
    await page.waitForFunction(() =>
      document.querySelector("#additional-results").textContent.includes("Recovered Vietnamese")
    );
    assert.equal(requests.get("vi:additional recover"), 2);
    await additional("additional persistent");
    await page.waitForFunction(() =>
      document.querySelector("#additional-results").textContent.includes("Rate limited")
    );
    assert.equal(requests.get("vi:additional persistent"), 2);
    await additional("additional long wait");
    await page.waitForFunction(() =>
      document.querySelector("#additional-results").textContent.includes("Rate limited")
    );
    assert.equal(requests.get("vi:additional long wait"), 1);
    await page.locator("#additional-results .outline-button").click();
    await page.waitForFunction(() => !activeFeature().additionalRequests.size);
    assert.equal(requests.get("vi:additional long wait"), 2, "Manual retry remains available");
    const additionalLimited = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/translate") &&
        response.request().postDataJSON()?.text === "additional cancel" &&
        response.status() === 429
    );
    await additional("additional cancel");
    await additionalLimited;
    await page.evaluate(() => switchFeature("document"));
    await page.waitForTimeout(1200);
    assert.equal(requests.get("vi:additional cancel"), 1);
    await page.evaluate(() => switchFeature("text"));

    // Live chat has its own additional-language loader and cancellation owner.
    await page.evaluate(() => switchFeature("live"));
    await page.evaluate(() => {
      const turn = {
        text: "chat additional",
        translation: "Primary",
        source: "th",
        target: "en",
        tone: "natural",
        additional_translations: [{ target: "vi", pending: true }],
      };
      conversation.push(turn);
      renderTurn(turn);
    });
    await page.waitForFunction(() =>
      document.querySelector("#chat-messages").textContent.includes("Recovered Vietnamese")
    );
    assert.equal(requests.get("vi:chat additional"), 2);
    await page.evaluate(() => switchFeature("text"));

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
      "PASS short 429 recovery for translation/assistant/review/additional languages/live chat, bounded attempts, long waits, manual retries and cancellation."
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
