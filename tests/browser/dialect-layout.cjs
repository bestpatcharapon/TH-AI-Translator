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
          audit: { status: "clear", issues: [], terms_checked: 0, terms_matched: 0 },
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
      route.fulfill({
        json: {
          pronunciation: "haa ja pai kin khao",
          alternatives: ["ฮ่า ฉันจะไปกินข้าว", "ฮ่า จะไปกินข้าวแล้ว"],
        },
      })
    );
    await page.goto(process.env.TRANSLATOR_TEST_URL || "http://127.0.0.1:5000");
    assert.equal(await page.locator("#translate").count(), 0);
    assert.equal(await page.locator("#thai-help").count(), 0);
    assert(await page.locator("#thai-tools").isHidden());
    assert(await page.locator("#thai-mode-chip").isVisible());
    assert.match(await page.locator("#thai-mode-chip").textContent(), /Standard/);
    await page.locator("#settings-toggle").click();
    assert.equal(await page.locator("#settings #thai-mode").count(), 0);
    assert.equal(await page.locator("#thai-mode-setting").count(), 0);
    await page.locator("#menu-close").click();
    await page.locator("#thai-mode-chip").click();
    await page.locator('#thai-mode-options [data-value="northern"]').click();
    assert.equal(await page.locator("#thai-mode").inputValue(), "northern");
    assert(await page.locator("#settings").isHidden());
    assert(await page.locator("#thai-mode-chip").isVisible());
    assert(
      await page.locator("#thai-tools").isHidden(),
      "No extra row before an interpretation result"
    );
    assert.match(await page.locator("#thai-mode-chip").textContent(), /Northern/);
    if (process.env.TRANSLATOR_SHOTS)
      await page.screenshot({ path: `${process.env.TRANSLATOR_SHOTS}/active.png` });
    await page.locator("#input").fill("ฮาจะไปกินข้าว");
    await page.waitForFunction(() => document.querySelector("#output").value !== "");
    await page.locator("#source-alternatives .suggestion-chip").first().waitFor();
    assert(await page.locator(".source-scroll #thai-result-preview").isVisible());
    assert.equal(await page.locator(".translator > #thai-tools").count(), 0);
    assert(
      await page
        .locator("#thai-tools")
        .evaluate(
          (el) =>
            el.previousElementSibling.id === "input" &&
            el.nextElementSibling.id === "source-insights"
        ),
      "Meaning follows the source text and precedes alternatives"
    );
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
          if (size.height >= 780 && ["en", "th"].includes(language)) {
            for (const selector of [".source-scroll", ".output-scroll", "#input", "#output"]) {
              assert(
                await page
                  .locator(selector)
                  .evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
                `Short text with pronunciation and suggestions must fit: ${language} ${selector}`
              );
            }
          }
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
    await page.locator("#thai-mode-chip").click();
    assert(await page.locator("#settings").isHidden());
    await page.locator('#thai-mode-options [data-value="standard"]').click();
    assert(await page.locator("#thai-mode-chip").isVisible());
    assert.match(await page.locator("#thai-mode-chip").textContent(), /Standard|แปลปกติ/);
    assert(!(await page.locator("#thai-result-preview").isVisible()));
    assert.equal(await page.locator("#thai-help").count(), 0);
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
