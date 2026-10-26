/* All translation responses are mocked; checks the mobile Text reading layout. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/translate", (route) =>
      route.fulfill({
        json: { translation: "A translated message. ".repeat(70), source_language: "th" },
      })
    );
    await page.route("**/api/assist", (route) =>
      route.fulfill({ json: { pronunciation: "", alternatives: [] } })
    );
    await page.goto(process.env.TRANSLATOR_TEST_URL || "http://127.0.0.1:5000");
    for (const language of ["en", "th", "ar"]) {
      await page.evaluate((code) => changeInterfaceLanguage(code), language);
      for (const size of [
        { width: 320, height: 568 },
        { width: 393, height: 852 },
        { width: 430, height: 932 },
        { width: 393, height: 360 },
      ]) {
        await page.setViewportSize(size);
        await page.evaluate(() => switchFeature("text"));
        await page.locator("#input").fill("");
        const layout = await page.evaluate(() => {
          const rect = (selector) =>
            document.querySelector(selector).getBoundingClientRect().toJSON();
          return {
            pageHeight: document.documentElement.scrollHeight,
            pageWidth: document.documentElement.scrollWidth,
            header: rect(".app-header"),
            languages: rect(".language-controls"),
            panels: rect(".panels"),
            navigation: rect(".bottom-bar"),
            mic: rect("#microphone"),
            source: rect(".source-panel"),
            output: rect(".output-panel"),
          };
        });
        assert(layout.pageHeight <= size.height + 1, "Text must fit the viewport vertically");
        assert(layout.pageWidth <= size.width + 1, "Text must fit horizontally");
        assert(layout.header.bottom <= layout.languages.top, "Header must not overlap languages");
        assert(layout.panels.bottom <= layout.navigation.top, "Navigation must not cover panels");
        assert(layout.mic.top >= layout.panels.bottom && layout.mic.top < layout.navigation.top);
        assert(layout.source.height >= 45 && layout.output.height >= 45);
        await page.locator("#input").fill("ข้อความยาวในโทรศัพท์\n".repeat(40));
        await page.waitForFunction(() => document.querySelector("#output").value.length > 100);
        assert(await page.locator("#input").evaluate((el) => el.scrollHeight > el.clientHeight));
        assert(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1));
        assert.equal(
          await page.locator("#reply-section, #reply-input, #translate-reply").count(),
          0
        );
      }
    }
    await page.setViewportSize({ width: 393, height: 852 });
    for (const feature of ["image", "document", "live", "text"]) {
      await page.evaluate((mode) => switchFeature(mode), feature);
      assert.equal(
        await page.locator(".translator").evaluate((el) => el.classList.contains("text-mode")),
        feature === "text"
      );
    }
    assert.deepEqual(errors, []);
    console.log(
      "PASS Text fits phone viewports in English, Thai and RTL; long text remains reachable without page scrolling; other modes keep their layout."
    );
  } finally {
    await browser.close();
  }
})();
