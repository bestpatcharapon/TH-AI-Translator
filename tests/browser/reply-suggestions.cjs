/* Provider responses are mocked; reply actions never send a message automatically. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 393, height: 852 },
      permissions: ["clipboard-read", "clipboard-write"],
    });
    const errors = [],
      calls = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const details = [
      {
        style: "friendly",
        text: "Okay, thanks for letting me know.",
        translation: "โอเค ขอบคุณที่บอกนะ",
      },
      {
        style: "professional",
        text: "Noted, thank you for informing me.",
        translation: "รับทราบ ขอบคุณที่แจ้งให้ทราบ",
      },
      { style: "short", text: "Okay, noted.", translation: "โอเค รับทราบ" },
    ];
    await page.route("**/api/translate", (route) => {
      calls.push("translate");
      return route.fulfill({ json: { translation: "I am heading out.", source_language: "th" } });
    });
    let fail = false;
    await page.route("**/api/assist", (route) => {
      const body = route.request().postDataJSON();
      calls.push(body.action);
      if (body.action !== "replies")
        return route.fulfill({ json: { pronunciation: "", alternatives: [] } });
      if (fail) return route.fulfill({ status: 503, json: { error: "Please try again" } });
      return route.fulfill({
        json: {
          source_language: "th",
          replies: details.map((item) => item.text),
          reply_details: details,
        },
      });
    });
    await page.goto(process.env.TRANSLATOR_TEST_URL || "http://127.0.0.1:5000");
    await page.evaluate(() => {
      window.replyAudio = [];
      speak = (text, language) => window.replyAudio.push({ text, language });
    });
    await page.locator("#input").fill("ไปแล้วนะ");
    await page.locator("#suggest-replies").click();
    await page.waitForFunction(
      () => document.querySelectorAll(".reply-suggestion-card").length === 3
    );
    assert.equal(
      await page.locator("#reply-suggestions > h4").textContent(),
      "Suggested replies (3)"
    );
    for (const [index, detail] of details.entries()) {
      const card = page.locator(".reply-suggestion-card").nth(index);
      assert.equal(await card.locator(".reply-suggestion-text").textContent(), detail.translation);
      assert.equal(await card.locator(".reply-suggestion-text").getAttribute("lang"), "th");
      assert.equal(await card.locator(".reply-suggestion-meaning").textContent(), detail.text);
      await card.locator("button").nth(0).click();
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), detail.translation);
      await card.locator("button").nth(1).click();
      assert.deepEqual(await page.evaluate(() => window.replyAudio.at(-1)), {
        text: detail.translation,
        language: "th",
      });
    }
    const requestCount = calls.length;
    await page.locator(".reply-suggestion-edit").first().click();
    assert.equal(await page.locator("#reply-input").inputValue(), details[0].text);
    assert.equal(
      calls.length,
      requestCount,
      "Edit/copy/listen must not invoke translation or send"
    );
    for (const width of [320, 393, 430, 1280]) {
      await page.setViewportSize({ width, height: 852 });
      assert(
        await page
          .locator("#reply-suggestions")
          .evaluate((el) => el.scrollWidth <= el.clientWidth + 1)
      );
    }
    await page.setViewportSize({ width: 393, height: 852 });
    await page.evaluate(() => switchFeature("document"));
    assert.equal(await page.locator(".reply-suggestion-card").count(), 0);
    await page.evaluate(() => switchFeature("text"));
    assert.equal(await page.locator(".reply-suggestion-card").count(), 3);
    assert.equal(await page.locator("#reply-input").inputValue(), details[0].text);
    fail = true;
    await page.locator("#suggest-replies").click();
    await page.waitForFunction(() =>
      document.querySelector("#reply-status").classList.contains("error")
    );
    assert.equal(
      await page.locator(".reply-suggestion-card").count(),
      3,
      "Failed refresh keeps previous suggestions"
    );
    assert.equal(await page.locator("#reply-input").inputValue(), details[0].text);
    assert.deepEqual(errors, []);
    console.log(
      "PASS bilingual reply cards, clipboard/audio direction, edit without sending, responsive layout, feature restoration and failure recovery."
    );
  } finally {
    await browser.close();
  }
})();
