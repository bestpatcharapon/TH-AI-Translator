const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } }),
      requests = [],
      errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/translate", async (route) => {
      const body = route.request().postDataJSON();
      requests.push(body);
      await route.fulfill({
        json: {
          translation: `result:${body.text}`,
          source_language: body.source,
          additional_translations: [],
        },
      });
    });
    await page.route("**/api/assist", (route) =>
      route.fulfill({ json: { pronunciation: "", alternatives: ["one", "two"] } })
    );
    await page.goto(process.env.TRANSLATOR_TEST_URL || "http://127.0.0.1:5000");
    await page.locator("#settings-toggle").click();
    for (const scenario of ["restaurant", "shopping", "health"]) {
      await page.locator("#translation-context").selectOption(scenario, { force: true });
      await page.locator("#translation-context-trigger").click();
      assert(
        (
          await page
            .locator(`#preference-options [data-value="${scenario}"] .preference-option-help`)
            .textContent()
        ).length > 20
      );
      await page.keyboard.press("Escape");
    }
    await page.locator("#translation-context").selectOption("restaurant", { force: true });
    await page.locator("#menu-close").click();
    await page.locator("#input").fill("ขอโต๊ะสองที่");
    await page.waitForFunction(
      () => document.querySelector("#output").value === "result:ขอโต๊ะสองที่"
    );
    assert.equal(requests.at(-1).context, "restaurant");
    assert.equal(requests.at(-1).conversation, undefined);
    await page.evaluate(() => switchFeature("live"));
    await page.locator("#live-audio").click();
    for (let i = 0; i < 8; i++) {
      await page.locator("#input").fill(`CHAT_${i}`);
      await page.locator("#live-send").click();
      await page.waitForFunction(
        (count) => document.querySelectorAll(".chat-turn").length === count,
        i + 1
      );
    }
    assert.deepEqual(
      requests.at(-1).conversation.map((turn) => turn.text),
      ["CHAT_1", "CHAT_2", "CHAT_3", "CHAT_4", "CHAT_5", "CHAT_6"]
    );
    assert.equal(requests.at(-1).context, "general");
    assert(!JSON.stringify(requests.at(-1).conversation).includes("ขอโต๊ะ"));
    await page.evaluate(() => switchFeature("text"));
    await page.locator("#input").fill("TEXT_ONLY");
    await page.waitForFunction(
      () => document.querySelector("#output").value === "result:TEXT_ONLY"
    );
    assert.equal(requests.at(-1).conversation, undefined);
    await page.evaluate(() => switchFeature("live"));
    await page.locator("#clear-chat").click();
    await page.locator("#input").fill("NEW_CHAT");
    await page.locator("#live-send").click();
    await page.waitForFunction(() => document.querySelectorAll(".chat-turn").length === 1);
    assert.deepEqual(requests.at(-1).conversation, []);
    // A different language pair cannot inherit the previous pair's messages.
    await page.evaluate(() => {
      targetEl.value = "ja";
      updateLanguages();
    });
    await page.locator("#input").fill("NEW_PAIR");
    await page.locator("#live-send").click();
    await page.waitForFunction(() => document.querySelectorAll(".chat-turn").length === 2);
    assert.deepEqual(requests.at(-1).conversation, []);
    await page.evaluate(() => switchFeature("text"));
    await page.evaluate(() => changeInterfaceLanguage("th"));
    await page.locator("#settings-toggle").click();
    await page.locator("#translation-context-trigger").click();
    assert.match(
      await page
        .locator('#preference-options [data-value="restaurant"] .preference-option-help')
        .textContent(),
      /สั่งอาหาร/
    );
    await page.keyboard.press("Escape");
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    assert.deepEqual(errors, []);
    console.log(
      "PASS: everyday scenarios, localized help, latest six chat turns, clearing, language-pair filtering, feature isolation and responsive layout."
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
