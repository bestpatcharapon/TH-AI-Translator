const { chromium } = require("playwright");
const assert = require("node:assert/strict");

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(process.env.TRANSLATOR_TEST_URL || "http://127.0.0.1:5000");
    for (const theme of ["light", "dark"]) {
      for (const width of [320, 393, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.evaluate((value) => {
          document.documentElement.dataset.theme = value;
          updateThemeLabel();
        }, theme);
        const decoration = await page.locator(".ambient-backdrop").evaluate((element) => ({
          hidden: element.getAttribute("aria-hidden"),
          pointerEvents: getComputedStyle(element).pointerEvents,
          width: element.getBoundingClientRect().width,
          animated: element.getAnimations({ subtree: true }).length,
        }));
        assert.equal(decoration.hidden, "true");
        assert.equal(decoration.pointerEvents, "none");
        assert.equal(decoration.width, width);
        assert.equal(decoration.animated, 0);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await page.locator("#input").fill("พื้นที่สงบสําหรับทุกภาษา");
        await page.locator("#settings-toggle").click();
        assert(await page.locator("#settings").isVisible());
        await page.locator("#menu-close").click();
        await page.locator("#input").fill("");
      }
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(() => changeInterfaceLanguage("ar"));
    assert.equal(await page.locator("html").getAttribute("dir"), "rtl");
    assert.deepEqual(errors, []);
    console.log(
      "PASS quiet workspace themes, decorative-only stars, mobile bounds, input/settings and reduced-motion RTL."
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
