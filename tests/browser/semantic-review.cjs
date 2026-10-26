const { chromium } = require("playwright");
const assert = require("node:assert/strict");

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    let needsContext = true,
      unavailable = false;
    await page.route("**/api/translate", (route) =>
      route.fulfill({
        json: {
          translation: "You don't have to pay 150 baht.",
          source_language: "th",
          quality_review: needsContext
            ? { status: "needs_context", question: "Who is paying?" }
            : { status: unavailable ? "unavailable" : "revised", applied: !unavailable },
        },
      })
    );
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(process.env.TRANSLATOR_TEST_URL || "http://127.0.0.1:5000");
    await page.evaluate(() => {
      switchFeature("live");
      document.querySelector("#auto-speak").checked = false;
    });
    await page.locator("#input").fill("ไม่ต้องจ่าย 150 บาท");
    await page.locator("#live-send").click();
    await page.waitForFunction(() =>
      document.querySelector("#live-status").textContent.includes("Who is paying?")
    );
    assert.equal(await page.locator(".chat-turn").count(), 0);
    assert.equal(await page.locator("#input").inputValue(), "ไม่ต้องจ่าย 150 บาท");
    assert.equal(await page.evaluate(() => conversation.length), 0);
    needsContext = false;
    await page.locator("#input").fill("คุณไม่ต้องจ่าย 150 บาท");
    await page.locator("#live-send").click();
    await page.waitForFunction(() => document.querySelectorAll(".chat-turn").length === 1);
    assert.equal(
      await page.locator(".translated-message").textContent(),
      "You don't have to pay 150 baht."
    );
    unavailable = true;
    await page.locator("#input").fill("ไม่ต้องจ่าย 150 บาทแล้ว");
    await page.locator("#live-send").click();
    await page.waitForFunction(() => document.querySelectorAll(".chat-turn").length === 2);
    assert.equal(await page.locator(".chat-turn").count(), 2);
    assert.equal(
      await page.locator(".translated-message").last().textContent(),
      "You don't have to pay 150 baht."
    );
    assert.equal(
      await page.evaluate(() => conversation.at(-1).quality_review.status),
      "unavailable"
    );
    assert.equal(await page.locator("#live-status").textContent(), "");
    await page.locator("#live-back").click();
    assert(
      !(await page
        .locator("#status")
        .textContent()
        .then((text) => text.includes("Who is paying?")))
    );
    needsContext = true;
    const savedBefore = await page.evaluate(() => savedTranslations.length);
    await page.evaluate(() => {
      const workspace = activeFeature();
      workspace.additional = [{ target: "ja", pending: true }];
      workspace.additionalContext = {
        text: "ไม่ต้องจ่าย 150 บาท",
        source: "th",
        target: "en",
        tone: "natural",
        context: "general",
        glossary: [],
        conversation: [],
      };
      renderAdditionalResults();
    });
    await page.waitForFunction(() =>
      document.querySelector(".additional-result .error")?.textContent.includes("Who is paying?")
    );
    assert.equal(await page.evaluate(() => activeFeature().additional[0].translation), undefined);
    assert.equal(await page.evaluate(() => savedTranslations.length), savedBefore);
    assert.deepEqual(errors, []);
    console.log(
      "PASS clarification does not send or save ambiguous chat; revised meaning is shown; unavailable review preserves the translation and review metadata without a completion notice."
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
