const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } }),
      errors = [],
      calls = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/api/translate", (route) => {
      const body = route.request().postDataJSON();
      calls.push(body);
      return route.fulfill({
        json: {
          translation: `${body.tone}:${body.context}:${body.text}`,
          source_language: body.source,
        },
      });
    });
    await page.route("**/api/assist", (route) =>
      route.fulfill({ json: { pronunciation: "reading", alternatives: [] } })
    );
    await page.goto(process.env.TRANSLATOR_TEST_URL || "http://127.0.0.1:5000");
    await page.locator("#input").fill("สวัสดีครับ");
    await page.waitForFunction(() =>
      document.querySelector("#output").value.includes("สวัสดีครับ")
    );
    await page.locator("#settings-toggle").click();
    await page.locator("#tone-trigger").click();
    assert.equal(await page.locator('#preference-options [role="option"]').count(), 4);
    assert.equal(
      await page.locator('#preference-options [aria-selected="true"]').getAttribute("data-value"),
      "natural"
    );
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("#tone").inputValue(), "friendly");
    assert.equal(await page.locator("#tone-trigger").getAttribute("aria-expanded"), "false");
    assert(await page.locator("#tone-trigger").evaluate((el) => el === document.activeElement));
    await page.locator("#translation-context-trigger").click();
    assert.equal(await page.locator('#preference-options [role="option"]').count(), 8);
    assert.equal(await page.locator(".preference-option-help").count(), 8);
    await page.locator('#preference-options [data-value="restaurant"]').click();
    await page.waitForFunction(() =>
      document.querySelector("#output").value.startsWith("friendly:restaurant:")
    );
    assert.equal(calls.at(-1).tone, "friendly");
    assert.equal(calls.at(-1).context, "restaurant");
    await page.locator("#tone-trigger").click();
    await page.keyboard.press("End");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#tone").inputValue(), "friendly");
    assert(await page.locator("#settings").isVisible());
    assert(!(await page.locator("#preference-dialog").isVisible()));
    await page.evaluate(() => switchFeature("document"));
    await page.locator("#settings-toggle").click();
    assert.equal(
      await page.locator("#tone-trigger .preference-trigger-label").textContent(),
      "Natural"
    );
    assert.equal(
      await page.locator("#translation-context-trigger .preference-trigger-label").textContent(),
      "General"
    );
    await page.evaluate(() => switchFeature("text"));
    await page.locator("#settings-toggle").click();
    assert.equal(
      await page.locator("#tone-trigger .preference-trigger-label").textContent(),
      "Friendly"
    );
    await page.locator("#tone-trigger").click();
    await page.evaluate(() => switchFeature("image"));
    assert(!(await page.locator("#preference-dialog").isVisible()));
    await page.evaluate(() => switchFeature("text"));
    for (const language of ["en", "th", "ar"]) {
      await page.evaluate((code) => changeInterfaceLanguage(code), language);
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 700 });
        await page.locator("#settings-toggle").click();
        for (const id of ["tone", "translation-context"]) {
          await page.locator(`#${id}-trigger`).focus();
          await page.keyboard.press("ArrowDown");
          assert(await page.locator("#preference-dialog").isVisible());
          assert(
            await page
              .locator("#preference-dialog")
              .evaluate(
                (el) =>
                  el.scrollWidth <= el.clientWidth &&
                  el.getBoundingClientRect().height <= innerHeight - 30
              )
          );
          assert.equal(
            await page.locator("#preference-title").textContent(),
            await page.evaluate((id) => t(id === "tone" ? "tone" : "context"), id)
          );
          await page.keyboard.press("Home");
          await page.keyboard.press(language === "ar" ? "ArrowLeft" : "ArrowRight");
          assert.equal(
            await page.evaluate(() => document.activeElement.dataset.value),
            id === "tone" ? "friendly" : "travel"
          );
          await page.keyboard.press("Escape");
        }
        await page.keyboard.press("Escape");
      }
    }
    assert.deepEqual(errors, []);
    console.log(
      "PASS custom tone/context choices, selected state, real translation payloads, cancellation/focus, feature-owned values, late close, keyboard/RTL and responsive dialogs."
    );
  } finally {
    await browser.close();
  }
})();
