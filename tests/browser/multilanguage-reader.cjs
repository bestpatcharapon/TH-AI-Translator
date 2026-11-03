/* Mobile Text uses a Document-style reader when extra languages are enabled. No AI calls. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const { mkdirSync } = require("node:fs");
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 393, height: 852 },
      permissions: ["clipboard-read", "clipboard-write"],
      reducedMotion: "reduce",
    });
    const chooseReaderLanguage = async (value) => {
      await page.locator("#reader-language-trigger").click();
      await page.locator(`#reader-language-menu [data-value="${value}"]`).click();
    };
    const errors = [],
      requests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let releaseJapanese;
    await page.route("**/api/translate", async (route) => {
      const body = route.request().postDataJSON();
      requests.push(body);
      if (body.text === "fail primary")
        return route.fulfill({
          status: 429,
          json: { error: "Primary rate limited", retry_after: 60 },
        });
      if (body.target === "ja")
        await new Promise((resolve) => {
          releaseJapanese = resolve;
        });
      if (body.target === "vi" && requests.filter((item) => item.target === "vi").length === 1)
        return route.fulfill({
          status: 429,
          json: { error: "Please retry this language", retry_after: 60 },
        });
      return route.fulfill({
        json: {
          translation:
            body.target === "en"
              ? "Where should I go? I'm Thai."
              : body.target === "zh"
                ? "我该去哪里？我是泰国人。\n".repeat(80)
                : body.target === "vi"
                  ? "Tôi nên đi đâu? Tôi là người Thái."
                  : "どこへ行けばいいですか？",
          source_language: "th",
          additional_translations: (body.additional_targets || []).map((target) => ({
            target,
            pending: true,
          })),
        },
      });
    });
    await page.route("**/api/assist", (route) =>
      route.fulfill({ json: { alternatives: ["เราจะไปไหนดี?", "ไปไหนดีครับ?"] } })
    );
    await page.goto(process.env.TRANSLATOR_TEST_URL || "http://127.0.0.1:5000");
    await page.locator("#settings-toggle").click();
    await page.locator("#multiple-languages").check();
    for (const code of ["zh", "vi", "ja"])
      await page.locator(`#additional-targets input[value="${code}"]`).check();
    await page.locator("#menu-close").click();
    await page.locator("#input").fill("ไปไหนดีคับ คนไทย");
    await page.waitForFunction(
      () => document.querySelector("#reader-tab-primary")?.getAttribute("aria-selected") === "true"
    );
    assert(await page.locator("#output").isVisible());
    assert(await page.locator("#input").isHidden());
    assert.equal(await page.locator("#multilingual-reader-tabs [role=tab]").count(), 2);
    assert.equal(
      await page.locator("#reader-language option").count(),
      4,
      "All target languages remain available in one selector"
    );
    // The popup must support keyboard selection, cancellation, outside click and touch-sized rows.
    const trigger = page.locator("#reader-language-trigger");
    await trigger.click();
    assert.equal(await trigger.getAttribute("aria-expanded"), "true");
    assert.equal(await page.locator('#reader-language-menu [aria-selected="true"]').count(), 1);
    await trigger.click();
    await page.waitForFunction(
      () => !document.querySelector("#reader-language-menu").matches(":popover-open")
    );
    await trigger.focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("End");
    await page.keyboard.press("Escape");
    assert(await trigger.evaluate((el) => el === document.activeElement));
    assert.equal(
      await page.locator("#reader-language").inputValue(),
      "primary",
      "Escape does not change the language"
    );
    await trigger.click();
    await page.locator(".app-header").click({ position: { x: 10, y: 10 } });
    await page.waitForFunction(
      () =>
        document.querySelector("#reader-language-trigger").getAttribute("aria-expanded") === "false"
    );
    await chooseReaderLanguage("zh");
    assert.equal(await page.locator("#reader-language").inputValue(), "zh");
    await chooseReaderLanguage("primary");
    assert(await page.locator("#output").isVisible());
    await chooseReaderLanguage("ja");
    assert.match(await page.locator("#translation-result-ja").textContent(), /Translating/);
    await page.waitForFunction(
      () => activeFeature().additional.find((item) => item.target === "zh")?.translation
    );
    await page.waitForFunction(
      () => activeFeature().additional.find((item) => item.target === "vi")?.error
    );
    assert.equal(
      await page.locator("#reader-language").inputValue(),
      "ja",
      "Other results must not steal the selected tab"
    );
    assert(releaseJapanese);
    await trigger.click();
    await page.keyboard.press("Home");
    releaseJapanese();
    await page.waitForFunction(
      () => !!activeFeature().additional.find((item) => item.target === "ja")?.translation
    );
    assert.equal(
      await page.evaluate(() => document.activeElement.dataset.value),
      "primary",
      "Background results preserve popup focus"
    );
    assert.equal(await trigger.getAttribute("aria-expanded"), "true");
    await page.keyboard.press("Enter");
    assert.equal(
      await page.locator("#reader-language").inputValue(),
      "primary",
      "Enter selects the focused language"
    );
    assert(await trigger.evaluate((el) => el === document.activeElement));
    await chooseReaderLanguage("vi");
    const vietnamese = page.locator("#translation-result-vi");
    await vietnamese.getByRole("button", { name: "Retry", exact: true }).click();
    await page.waitForFunction(
      () => !!activeFeature().additional.find((item) => item.target === "vi")?.translation
    );
    assert(await vietnamese.isVisible());
    await vietnamese.getByRole("button", { name: "Copy", exact: true }).click();
    assert.equal(
      await page.evaluate(() => navigator.clipboard.readText()),
      "Tôi nên đi đâu? Tôi là người Thái."
    );
    await chooseReaderLanguage("zh");
    const chinese = page.locator("#translation-result-zh");
    await chinese.evaluate((el) => {
      el.scrollTop = 250;
    });
    await page.waitForFunction(() => activeFeature().readerScroll?.["zh"] > 100);
    await chooseReaderLanguage("primary");
    await chooseReaderLanguage("zh");
    assert(
      await chinese.evaluate((el) => el.scrollTop > 100),
      "Each language keeps its reading position"
    );
    const requestCount = requests.length;
    for (const size of [
      { width: 320, height: 568 },
      { width: 393, height: 852 },
      { width: 430, height: 932 },
    ]) {
      await page.setViewportSize(size);
      const layout = await page.evaluate(() => {
        const rect = (selector) =>
          document.querySelector(selector).getBoundingClientRect().toJSON();
        return {
          width: document.documentElement.scrollWidth,
          height: document.documentElement.scrollHeight,
          pane: rect("#translation-result-zh"),
          nav: rect(".bottom-bar"),
          mic: rect("#microphone"),
        };
      });
      assert(
        layout.width <= size.width + 1 && layout.height <= size.height + 1,
        "No page overflow"
      );
      assert(
        layout.pane.height > 100,
        `Reading pane remains usable at ${size.width}×${size.height}: ${layout.pane.height}px`
      );
      assert(
        layout.pane.bottom <= layout.mic.top + 1 && layout.pane.bottom <= layout.nav.top,
        "Navigation never covers content"
      );
      assert.equal(await page.locator(".additional-result:visible").count(), 1);
      await trigger.click();
      const popup = await page.locator("#reader-language-menu").boundingBox();
      assert(
        popup.x >= 0 &&
          popup.y >= 0 &&
          popup.x + popup.width <= size.width &&
          popup.y + popup.height <= size.height,
        "Popup stays within the viewport"
      );
      assert(
        await page
          .locator("#reader-language-menu")
          .evaluate((el) =>
            [...el.children].every((item) => item.getBoundingClientRect().height >= 44)
          )
      );
      await page.keyboard.press("Escape");
      assert(
        await page.locator("#multilingual-reader-tabs").evaluate(
          (el) =>
            el.scrollWidth <= el.clientWidth + 1 &&
            [...el.children].every((tab) => {
              const box = tab.getBoundingClientRect();
              return (
                box.left >= 0 && box.right <= innerWidth && tab.scrollWidth <= tab.clientWidth + 1
              );
            })
        ),
        "The two reader tabs fit without horizontal scrolling"
      );
    }
    await page.setViewportSize({ width: 393, height: 852 });
    await page.waitForFunction(() =>
      document.querySelector(".translator").classList.contains("multilingual-reader")
    );
    await page.locator("#reader-tab-primary").focus();
    await page.keyboard.press("Home");
    assert(await page.locator("#input").isVisible());
    assert(await page.locator("#reader-language-field").isHidden());
    await page.keyboard.press("End");
    assert(
      await page.locator("#translation-result-zh").isVisible(),
      "Returning to Translation remembers the selected language"
    );
    await chooseReaderLanguage("ja");
    await page.evaluate(() => switchFeature("document"));
    assert(await page.locator("#multilingual-reader-tabs").isHidden());
    assert(await page.locator("#document-reader-tabs").isVisible());
    await page.evaluate(() => switchFeature("text"));
    assert(await page.locator("#translation-result-ja").isVisible());
    await page.evaluate(() => changeInterfaceLanguage("th"));
    assert.equal(await page.locator("#reader-tab-source").textContent(), "ข้อความต้นฉบับ");
    // Supply a complete locale fixture so this verifies RTL independently of draft bundles.
    await page.route("**/static/interface-locales/ar.json", async (route) =>
      route.fulfill({ json: await page.evaluate(() => COPY.en) })
    );
    await page.evaluate(() => changeInterfaceLanguage("ar"));
    await page.locator("#reader-tab-primary").focus();
    await page.keyboard.press("ArrowLeft");
    assert(await page.locator("#input").isVisible());
    assert(await page.locator("#reader-language-field").isHidden());
    await page.keyboard.press("End");
    assert(await page.locator("#translation-result-ja").isVisible());
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.waitForFunction(
      () => !document.querySelector(".translator").classList.contains("multilingual-reader")
    );
    assert(await page.locator("#multilingual-reader-tabs").isHidden());
    assert(await page.locator("#input").isVisible());
    assert(await page.locator("#output").isVisible());
    assert.equal(await page.locator(".additional-result:visible").count(), 3);
    assert.equal(requests.length, requestCount, "Reading/switching/resizing never calls AI");
    await page.setViewportSize({ width: 393, height: 852 });
    await page.waitForFunction(() =>
      document.querySelector(".translator").classList.contains("multilingual-reader")
    );
    await page.evaluate(() => changeInterfaceLanguage("en"));
    await page.locator("#reader-tab-source").click();
    await page.waitForFunction(
      () => document.querySelector("#source-alternatives").children.length > 0
    );
    assert(
      await page.locator(".source-panel").evaluate((el) => el.getBoundingClientRect().height < 300),
      "Short source uses a compact card"
    );
    assert(
      await page.evaluate(() => {
        const input = inputEl.getBoundingClientRect();
        const suggestions = $("source-insights").getBoundingClientRect();
        return suggestions.top - input.bottom < 24;
      }),
      "Suggestions stay beside the source instead of at the foot of the screen"
    );
    if (process.env.TRANSLATOR_SHOTS) {
      mkdirSync(process.env.TRANSLATOR_SHOTS, { recursive: true });
      for (const pane of ["source", "primary", "vi"]) {
        if (pane === "source") await page.locator("#reader-tab-source").click();
        else {
          await page.locator("#reader-tab-primary").click();
          await chooseReaderLanguage(pane);
        }
        await page.screenshot({ path: path.join(process.env.TRANSLATOR_SHOTS, `${pane}.png`) });
      }
    }
    await page.locator("#reader-tab-primary").click();
    await trigger.click();
    if (process.env.TRANSLATOR_SHOTS)
      await page.screenshot({ path: path.join(process.env.TRANSLATOR_SHOTS, "dropdown.png") });
    await page.evaluate(() => switchFeature("document"));
    assert(
      await page.locator("#reader-language-menu").isHidden(),
      "Leaving a feature dismisses its popup"
    );
    await page.evaluate(() => switchFeature("text"));
    await page.locator("#reader-tab-source").click();
    await page.locator("#input").fill("New source");
    assert(await page.locator("#input").isVisible());
    assert.equal(await page.locator("#reader-tab-primary").isDisabled(), true);
    assert.equal(
      await page.locator(".additional-result").count(),
      0,
      "Old results are cleared on edit"
    );
    await page.locator("#input").fill("fail primary");
    await page.waitForFunction(
      () =>
        document.querySelector("#multilingual-reader-status").textContent === "Primary rate limited"
    );
    assert(
      await page.locator("#multilingual-reader-status").isVisible(),
      "Primary failures must be visible on Source"
    );
    assert.equal(await page.locator("#input").inputValue(), "fail primary");
    await page.locator("#settings-toggle").click();
    await page.locator("#multiple-languages").uncheck();
    await page.locator("#menu-close").click();
    assert(await page.locator("#multilingual-reader-tabs").isHidden());
    assert(await page.locator("#input").isVisible());
    assert(await page.locator("#output").isVisible());
    assert.deepEqual(errors, []);
    console.log(
      "PASS mobile multilingual reader: real menu, independent loading, retry/copy, reading position, keyboard/RTL, viewport fit, feature restoration, desktop and source invalidation."
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
