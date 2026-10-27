const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let uncertain = false;
    await page.route("**/api/translate", (route) =>
      route.fulfill({
        json: {
          translation: uncertain ? "" : "I'm going to eat.",
          source_language: "th",
          interpretation: {
            status: uncertain ? "needs_context" : "ready",
            standard_thai: uncertain ? "" : "ฉันจะไปกินข้าว",
            note: "Check the intended meaning with the speaker.",
            questions: uncertain ? ["What does the speaker mean?"] : [],
            possibilities: [],
            evidence: [],
            matched_entries: [],
          },
        },
      })
    );
    await page.route("**/api/assist", (route) =>
      route.fulfill({ json: { pronunciation: "", alternatives: [] } })
    );
    await page.goto(process.env.TRANSLATOR_TEST_URL || "http://127.0.0.1:5000");
    await page.locator("#thai-mode").selectOption("northern", { force: true });
    await page.locator("#input").fill("ฮาจะไปกินข้าว");
    await page.waitForFunction(() => document.querySelector("#output").value !== "");
    for (const language of ["en", "th", "ar"]) {
      await page.evaluate((code) => changeInterfaceLanguage(code), language);
      for (const size of [
        { width: 320, height: 568 },
        { width: 390, height: 844 },
        { width: 430, height: 932 },
        { width: 768, height: 1024 },
      ]) {
        await page.setViewportSize(size);
        assert(!(await page.locator("#thai-details").isVisible()));
        const bounds = await page.evaluate(() => {
          const rect = (selector) => document.querySelector(selector).getBoundingClientRect();
          return {
            tools: rect("#thai-tools").height,
            source: rect(".source-panel").height,
            output: rect(".output-panel").height,
            pageWidth: document.documentElement.scrollWidth,
            pageHeight: document.documentElement.scrollHeight,
            inputVisible:
              Math.min(rect("#input").bottom, rect(".source-panel .panel-scroll").bottom) -
              Math.max(rect("#input").top, rect(".source-panel .panel-scroll").top),
          };
        });
        assert(bounds.pageWidth <= size.width + 1);
        if (size.width <= 700) {
          assert(bounds.pageHeight <= size.height + 1);
          assert(
            bounds.tools < 110,
            `Dialect help/results too tall: ${language} ${size.width} ${JSON.stringify(bounds)}`
          );
          assert(bounds.source >= 80 && bounds.output >= 100);
          assert(
            bounds.inputVisible >= 32,
            `Source must stay readable: ${language} ${size.width} ${bounds.inputVisible}`
          );
        }
        await page.locator("#thai-result-preview").click();
        assert(await page.locator(".thai-central").isVisible());
        assert(await page.locator("#thai-mode-note").isVisible());
        assert(
          await page
            .locator("#thai-details")
            .evaluate(
              (el) =>
                el.scrollWidth <= el.clientWidth + 1 &&
                el.getBoundingClientRect().bottom <= innerHeight
            )
        );
        await page.keyboard.press("Escape");
        assert(
          await page.locator("#thai-result-preview").evaluate((el) => el === document.activeElement)
        );
        if (await page.locator("#thai-help").isVisible()) {
          await page.locator("#thai-help").click();
          await page.locator("#thai-details-close").click();
        }
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    uncertain = true;
    await page.locator("#input").fill("คำที่ต้องอธิบายเพิ่ม");
    await page.locator("#thai-clarification").waitFor({ state: "visible" });
    assert(await page.locator("#thai-details").isVisible());
    await page.locator("#thai-clarification").fill("ฉันจะไปกินข้าว");
    uncertain = false;
    await page.locator("#thai-clarify").click();
    await page.waitForFunction(
      () => !document.querySelector("#thai-details").open && document.querySelector("#output").value
    );
    await page.locator("#thai-result-preview").click();
    await page.evaluate(() => switchFeature("document"));
    assert(!(await page.locator("#thai-details").isVisible()));
    await page.evaluate(() => switchFeature("text"));
    await page.locator("#thai-mode").selectOption("standard", { force: true });
    assert(!(await page.locator("#thai-result-preview").isVisible()));
    assert(!(await page.locator("#thai-help").isVisible()));
    assert.deepEqual(errors, []);
    console.log(
      "PASS compact dialect layout, readable details, clarification, focus, mode isolation, mobile and RTL."
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
