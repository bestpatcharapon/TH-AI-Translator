const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [],
      calls = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/api/**", (route) => {
      if (route.request().method() === "GET") return route.continue();
      calls.push(route.request().url());
      return route.abort();
    });
    await page.goto(process.env.TRANSLATOR_TEST_URL || "http://127.0.0.1:5000");
    for (const language of ["en", "th", "ar"]) {
      await page.evaluate((code) => changeInterfaceLanguage(code), language);
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 844 });
        await page.locator("#settings-toggle").click();
        assert(await page.locator("#menu-panel-translation").isVisible());
        assert(!(await page.locator("#menu-panel-history").isVisible()));
        assert(!(await page.locator("#menu-panel-appearance").isVisible()));
        assert(await page.locator("#tone-trigger").isVisible());
        assert(await page.locator("#translation-context-trigger").isVisible());
        await page.locator("#multiple-languages").check();
        assert(await page.locator("#additional-search").isVisible());
        await page.locator("#multiple-languages").uncheck();
        await page.locator("#menu-tab-history").click();
        assert(await page.locator("#history-search").isVisible());
        assert(!(await page.locator("#tone-trigger").isVisible()));
        await page.locator("#menu-tab-history").focus();
        await page.keyboard.press(language === "ar" ? "ArrowLeft" : "ArrowRight");
        assert.equal(
          await page.locator("#menu-tab-appearance").getAttribute("aria-selected"),
          "true"
        );
        assert(await page.locator("#ui-language").isVisible());
        assert(await page.locator("#ui-language .menu-setting-icon svg").isVisible());
        assert(
          await page.locator("#settings").evaluate((el) => el.getBoundingClientRect().height < 520),
          "Appearance must fit its content instead of leaving a tall empty panel"
        );
        assert(
          await page
            .locator("#ui-language")
            .evaluate(
              (el) => el.clientWidth >= el.closest(".menu-appearance-card").clientWidth - 4
            ),
          "Language selection must be a full-width target"
        );
        const previous = await page.evaluate(() => document.documentElement.dataset.theme);
        await page.locator("#menu-theme").click();
        assert.notEqual(
          await page.evaluate(() => document.documentElement.dataset.theme),
          previous
        );
        assert.equal(
          await page.locator("#menu-theme").getAttribute("aria-pressed"),
          String(await page.evaluate(() => document.documentElement.dataset.theme === "light"))
        );
        assert.equal(
          await page.locator("#menu-theme .menu-theme-label").textContent(),
          await page.locator("#theme").getAttribute("aria-label")
        );
        assert(await page.locator("#settings").evaluate((el) => el.scrollWidth <= el.clientWidth));
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.locator("#menu-tab-appearance").focus();
        await page.keyboard.press("Home");
        assert.equal(
          await page.locator("#menu-tab-translation").getAttribute("aria-selected"),
          "true"
        );
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("#settings-toggle").getAttribute("aria-expanded"), "false");
      }
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(calls, []);
    console.log(
      "PASS settings tabs, visible controls, keyboard/RTL navigation, theme synchronization, mobile/desktop layout and no AI requests."
    );
  } finally {
    await browser.close();
  }
})();
