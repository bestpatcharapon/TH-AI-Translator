/* Document reading uses one generous mobile pane while keeping complete text and edits. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      permissions: ["clipboard-read", "clipboard-write"],
    });
    const errors = [],
      requests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const original = [
      "PROJECT HANDOVER NOTES",
      "Overview and responsibilities",
      ...Array.from(
        { length: 65 },
        (_, index) =>
          `Section ${index + 1}. Check the delivery schedule, test results and support notes before the next appointment.`
      ),
      "END OF SOURCE DOCUMENT",
    ].join("\n\n");
    const translated = [
      "เอกสารส่งมอบโครงการ",
      "ภาพรวมและหน้าที่รับผิดชอบ",
      ...Array.from(
        { length: 65 },
        (_, index) =>
          `หัวข้อ ${index + 1} ตรวจตารางส่งมอบ ผลการทดสอบ และบันทึกการดูแลก่อนนัดหมายครั้งถัดไป`
      ),
      "END OF TRANSLATED DOCUMENT",
    ].join("\n\n");
    const explanation = [
      ...Array.from(
        { length: 40 },
        (_, index) =>
          `Review note ${index + 1}: the translation preserves the schedule, responsibilities and next steps.`
      ),
      "END OF DOCUMENT REVIEW",
    ].join("\n\n");
    let holdTranslation = false,
      pendingTranslation = null,
      pendingReady = null,
      failTranslation = false;
    const fulfillTranslation = (route) =>
      route.fulfill({
        json: {
          translation: translated,
          source_language: "en",
          additional_translations: [],
          audit: { status: "clear", issues: [] },
        },
      });
    await page.route("**/api/extract", (route) => {
      const broken = route.request().postData().includes("broken.pdf");
      return route.fulfill(
        broken
          ? { status: 503, json: { error: "Document could not be read" } }
          : { json: { text: original, filename: "handover.pdf" } }
      );
    });
    await page.route("**/api/translate", (route) => {
      requests.push(route.request().postDataJSON());
      if (holdTranslation) {
        pendingTranslation = route;
        pendingReady?.();
        return;
      }
      if (failTranslation)
        return route.fulfill({
          status: 503,
          json: { error: "Translation temporarily unavailable" },
        });
      return fulfillTranslation(route);
    });
    await page.route("**/api/assist", (route) =>
      route.fulfill({
        json:
          route.request().postDataJSON().action === "explain"
            ? { explanation }
            : { alternatives: ["Example one", "Example two"] },
      })
    );
    await page.goto(process.env.TRANSLATOR_TEST_URL || "http://127.0.0.1:5000");
    const upload = (name) =>
      page.locator("#file-input").setInputFiles({
        name,
        mimeType: "application/pdf",
        buffer: Buffer.from("A benign fixture; document extraction is mocked."),
      });
    const sourceTab = page.locator("#document-tab-source");
    const translationTab = page.locator("#document-tab-translation");
    await page.locator('[data-mode="document"]').click();
    assert(await page.locator("#document-reader-tabs").isVisible());
    assert(await page.locator("#input").isVisible());
    assert(await page.locator("#output").isHidden());
    assert(await page.locator("#choose-file").isVisible());
    await page.locator("#target-picker").click();
    await page.locator("#language-search").fill("Thai");
    await page.locator('#language-options [data-language="th"]').click();
    assert.equal(await page.locator("#target").inputValue(), "th");

    await upload("handover.pdf");
    await page.waitForFunction(() => document.querySelector("#output").value.length > 1000);
    await page.waitForFunction(
      () =>
        document.querySelector("#document-tab-translation").getAttribute("aria-selected") === "true"
    );
    assert(await page.locator("#input").isHidden());
    assert(await page.locator("#output").isVisible());
    assert.equal(await page.locator("#input").inputValue(), original);
    assert.equal(await page.locator("#output").inputValue(), translated);
    assert.equal(await page.locator("#file-name").textContent(), "handover.pdf");
    assert(await page.locator("#remove-file").isVisible());
    const reading = await page.evaluate(() => {
      const output = document.querySelector("#output").getBoundingClientRect();
      const scroll = document.querySelector(".output-scroll").getBoundingClientRect();
      return {
        visible: Math.min(output.bottom, scroll.bottom) - Math.max(output.top, scroll.top),
        fileTools: document.querySelector("#file-tools").getBoundingClientRect().height,
        pageWidth: document.documentElement.scrollWidth,
        pageHeight: document.documentElement.scrollHeight,
      };
    });
    assert(reading.visible >= 260, `Document reading area should be generous: ${reading.visible}`);
    assert(reading.fileTools <= 110, "Selected file tools should be compact");
    assert(reading.pageWidth <= 391 && reading.pageHeight <= 845);
    await page.evaluate(() => document.fonts.ready);
    await page.locator(".translator").evaluate(async (element) => {
      const animations = element
        .getAnimations({ subtree: true })
        .filter((animation) => animation.effect.getTiming().iterations !== Infinity);
      await Promise.all(animations.map((animation) => animation.finished.catch(() => {})));
    });
    await page.screenshot({ path: "/tmp/translator-document-reader.png" });
    for (const language of ["en", "th", "ar"]) {
      await page.evaluate((code) => changeInterfaceLanguage(code), language);
      for (const size of [
        { width: 320, height: 568 },
        { width: 390, height: 844 },
        { width: 768, height: 1024 },
      ]) {
        await page.setViewportSize(size);
        assert(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          `${language} ${size.width}: document controls stay within viewport`
        );
        if (size.width <= 700) {
          assert(await page.locator("#input").isHidden());
          assert(await page.locator("#output").isVisible());
          assert(
            await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1),
            `${language} ${size.width}: reading pane and navigation fit vertically`
          );
        } else {
          assert(await page.locator("#input").isVisible());
          assert(await page.locator("#output").isVisible());
        }
      }
    }
    await page.evaluate(() => changeInterfaceLanguage("en"));
    await page.setViewportSize({ width: 320, height: 568 });
    await page.locator("#explain").click();
    await page.waitForFunction(() =>
      document.querySelector("#explanation-text").textContent.endsWith("END OF DOCUMENT REVIEW")
    );
    assert(
      (await page.locator("#output").evaluate((element) => element.clientHeight)) >= 140,
      "Opening a review keeps a usable translation excerpt on a short screen"
    );
    const reviewEnd = await page.locator(".output-scroll").evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      const text = document.querySelector("#explanation-text").firstChild;
      const range = document.createRange();
      range.setStart(text, text.textContent.length - "END OF DOCUMENT REVIEW".length);
      range.setEnd(text, text.textContent.length);
      const end = range.getBoundingClientRect();
      const viewport = element.getBoundingClientRect();
      return {
        scrolls: element.scrollHeight > element.clientHeight,
        endTop: end.top,
        endBottom: end.bottom,
        viewportTop: viewport.top,
        viewportBottom: viewport.bottom,
      };
    });
    assert(reviewEnd.scrolls, "Long review notes have a scrollable reading area");
    assert(
      reviewEnd.endTop >= reviewEnd.viewportTop - 1 &&
        reviewEnd.endBottom <= reviewEnd.viewportBottom + 1,
      "The final line of a long review is reachable instead of clipped"
    );
    await page.screenshot({ path: "/tmp/translator-document-review-short.png" });
    await page.locator("#explain").click();
    assert(await page.locator("#explanation-panel").isHidden());
    await page.setViewportSize({ width: 390, height: 844 });
    assert(
      (await page.locator("#output").evaluate((element) => element.clientHeight)) >= 260,
      "Closing a review restores the generous normal reading area"
    );

    // Switching panes is keyboard accessible and preserves each reading position.
    await sourceTab.click();
    assert.equal(await sourceTab.getAttribute("aria-selected"), "true");
    assert(await page.locator("#input").isVisible());
    assert(await page.locator("#output").isHidden());
    assert.equal(
      await page.locator(".source-panel").getAttribute("aria-labelledby"),
      "document-tab-source"
    );
    await sourceTab.focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await translationTab.getAttribute("aria-selected"), "true");
    assert(await translationTab.evaluate((element) => element === document.activeElement));
    const savedScroll = await page.locator("#output").evaluate((element) => {
      element.scrollTop = 360;
      return element.scrollTop;
    });
    assert(savedScroll > 100, "Long document can scroll to later paragraphs");
    await sourceTab.click();
    await translationTab.click();
    assert(
      Math.abs(
        (await page.locator("#output").evaluate((element) => element.scrollTop)) - savedScroll
      ) <= 2,
      "Switching tabs keeps the translation reading position"
    );
    await page.evaluate(() => switchFeature("text"));
    assert(await page.locator("#document-reader-tabs").isHidden());
    await page.evaluate(() => switchFeature("document"));
    assert.equal(await translationTab.getAttribute("aria-selected"), "true");
    assert(
      Math.abs(
        (await page.locator("#output").evaluate((element) => element.scrollTop)) - savedScroll
      ) <= 2,
      "Returning to Document restores its reading position"
    );
    await page.locator("#copy").click();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), translated);

    // A person inspecting or editing the source wins over an arriving translation.
    await sourceTab.click();
    holdTranslation = true;
    const waitingForTranslation = new Promise((resolve) => (pendingReady = resolve));
    await page.locator("#input").fill(original + "\nA corrected source note.");
    await waitingForTranslation;
    await sourceTab.click();
    assert(pendingTranslation);
    await fulfillTranslation(pendingTranslation);
    pendingTranslation = null;
    await page.waitForFunction(() => document.querySelector("#output").value.length > 1000);
    assert.equal(await sourceTab.getAttribute("aria-selected"), "true");
    assert.equal(
      await page.locator("#input").inputValue(),
      original + "\nA corrected source note."
    );
    holdTranslation = false;

    // Desktop keeps the existing comparison view; narrow screens retain both text values.
    await page.setViewportSize({ width: 1100, height: 900 });
    assert(await page.locator("#input").isVisible());
    assert(await page.locator("#output").isVisible());
    assert.equal(
      await page.locator(".source-panel").getAttribute("aria-labelledby"),
      "source-heading"
    );
    assert.equal(
      await page.locator(".output-panel").getAttribute("aria-labelledby"),
      "translation-heading"
    );
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.locator("#input").isVisible());
    assert(await page.locator("#output").isHidden());

    // Replacement and failures keep source text and recovery controls reachable.
    failTranslation = true;
    await upload("replacement.pdf");
    await page.waitForFunction(() => document.querySelector("#status").classList.contains("error"));
    assert(await page.locator("#input").isVisible());
    assert.equal(await page.locator("#input").inputValue(), original);
    assert.equal(await page.locator("#output").inputValue(), "");
    await upload("broken.pdf");
    await page.waitForFunction(() => document.querySelector("#retry-file").hidden === false);
    assert(await page.locator("#retry-file").isVisible());
    assert(await page.locator("#input").isVisible());
    await page.locator("#remove-file").click();
    assert.equal(await page.locator("#input").inputValue(), "");
    assert(await page.locator("#choose-file").isVisible());
    assert(await page.locator("#file-preview").isHidden());
    assert.deepEqual(errors, []);
    console.log(
      "PASS large mobile Document reader, source/translation tabs, full copy, keyboard/scroll restoration, source edits and file recovery."
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
