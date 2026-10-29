/* Long saved text stays readable in compact previews and expands without nested scrolling. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      permissions: ["clipboard-read", "clipboard-write"],
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(process.env.TRANSLATOR_TEST_URL || "http://127.0.0.1:5000");
    const longUrl = `https://example.test/${"readable-history-".repeat(16)}`;
    const original = [
      "EXAMPLE SERVICE CENTRE",
      "                    SUPPORT INFORMATION",
      ...Array.from(
        { length: 14 },
        (_, index) =>
          `${" ".repeat((index % 3) * 8)}Service line ${index + 1}: information for the next appointment.`
      ),
      longUrl,
      "Hidden source suffix: SOURCE-END-6821",
    ].join("\n");
    const translation = [
      "ศูนย์บริการตัวอย่าง",
      "                    ข้อมูลการติดต่อและนัดหมาย",
      ...Array.from(
        { length: 14 },
        (_, index) => `รายละเอียดบริการลำดับที่ ${index + 1} โปรดตรวจวันและเวลา`
      ),
      longUrl,
      "Hidden translation suffix: TRANSLATION-END-7349",
    ].join("\n");
    const records = [
      { text: original, translation, source: "en", target: "th" },
      {
        text: "هذه معلومات موعد طويل يجب عرضها بوضوح مع الاحتفاظ بالنص الكامل. ".repeat(15),
        translation:
          "Long appointment information that remains readable in the history list. ".repeat(15),
        source: "ar",
        target: "en",
      },
      { text: "Short saved message", translation: "ข้อความสั้น", source: "en", target: "th" },
    ].map((record, index) => ({
      ...record,
      tone: "natural",
      feature: "text",
      favorite: false,
      savedAt: Date.now() - index * 1000,
    }));
    await page.evaluate((items) => persistSaved(items), records);
    await page.locator("#settings-toggle").click();
    await page.locator("#menu-tab-history").click();
    await page.evaluate(() => document.fonts.ready);

    for (const language of ["en", "th", "ar"]) {
      await page.evaluate((code) => changeInterfaceLanguage(code), language);
      for (const width of [320, 390, 768]) {
        await page.setViewportSize({ width, height: 844 });
        const geometry = await page.locator("#history-list").evaluate((list) => {
          const cards = [...list.querySelectorAll(".history-entry")];
          return {
            documentWidth: document.documentElement.scrollWidth,
            cards: cards.map((card) => ({
              height: card.getBoundingClientRect().height,
              width: card.getBoundingClientRect().width,
              scrollWidth: card.scrollWidth,
              paragraphs: [...card.querySelectorAll("p")].map((paragraph) => {
                const style = getComputedStyle(paragraph);
                return {
                  height: paragraph.getBoundingClientRect().height,
                  lineHeight: parseFloat(style.lineHeight),
                  overflowY: style.overflowY,
                  whiteSpace: style.whiteSpace,
                };
              }),
            })),
          };
        });
        assert.equal(geometry.cards.length, 3);
        assert(geometry.documentWidth <= width + 1, `${language} ${width}: no page overflow`);
        for (const card of geometry.cards) {
          assert(card.height < 280, `${language} ${width}: preview remains compact`);
          assert(card.scrollWidth <= card.width + 1, `${language} ${width}: URL wraps within row`);
          for (const paragraph of card.paragraphs) {
            assert(
              paragraph.height <= paragraph.lineHeight * 3 + 1,
              "Preview shows at most three lines"
            );
            assert.equal(paragraph.whiteSpace, "normal", "OCR indentation collapses in previews");
            assert(
              !["auto", "scroll"].includes(paragraph.overflowY),
              "No nested paragraph scrollbars"
            );
          }
        }
      }
    }

    await page.evaluate(() => changeInterfaceLanguage("en"));
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.locator(".history-entry").last().locator(".history-toggle").isHidden());
    const first = page.locator(".history-entry").first();
    const toggle = first.locator(".history-toggle");
    assert.equal(await toggle.getAttribute("aria-expanded"), "false");
    assert(
      await toggle.evaluate(
        (button) => !!document.getElementById(button.getAttribute("aria-controls"))
      )
    );
    await toggle.focus();
    await page.keyboard.press("Enter");
    assert.equal(await toggle.getAttribute("aria-expanded"), "true");
    assert(await first.evaluate((card) => card.classList.contains("is-expanded")));
    assert.equal(await first.locator(".history-original").textContent(), original);
    assert.equal(await first.locator(".history-translation").textContent(), translation);
    const expanded = await first.locator("p").evaluateAll((paragraphs) =>
      paragraphs.map((paragraph) => ({
        client: paragraph.clientHeight,
        scroll: paragraph.scrollHeight,
        overflowY: getComputedStyle(paragraph).overflowY,
      }))
    );
    assert(expanded.every((paragraph) => paragraph.scroll <= paragraph.client + 1));
    assert(expanded.every((paragraph) => !["auto", "scroll"].includes(paragraph.overflowY)));
    await toggle.click();
    assert.equal(await toggle.getAttribute("aria-expanded"), "false");
    await first.scrollIntoViewIfNeeded();
    await page.locator(".menu-content").evaluate((content) => {
      content.scrollTop = 0;
    });
    await page.screenshot({ path: "/tmp/translator-history-long-fixed.png" });

    await first.locator("header button").nth(1).click();
    assert.equal(
      await page.evaluate(() => navigator.clipboard.readText()),
      translation,
      "Copy keeps all text"
    );
    await page.locator("#history-search").fill("TRANSLATION-END-7349");
    assert.equal(await page.locator(".history-entry").count(), 1, "Search includes clipped suffix");
    await page.locator(".history-entry header button").first().click();
    await page.locator("#history-search").fill("");
    await page.locator("#history-favorites").check();
    assert.equal(await page.locator(".history-entry").count(), 1);
    await page.locator(".history-entry header button").last().click();
    assert.equal(await page.locator(".history-entry").count(), 0);
    await page.locator("#history-favorites").uncheck();
    assert.equal(await page.locator(".history-entry").count(), 2);
    await page.reload();
    await page.locator("#settings-toggle").click();
    await page.locator("#menu-tab-history").click();
    assert.equal(
      await page.locator(".history-entry").count(),
      2,
      "History changes persist across reload"
    );

    const sameText = "Identical source and translation should appear only once. ".repeat(18);
    await page.evaluate(
      (text) =>
        persistSaved([
          {
            text,
            translation: text,
            source: "en",
            target: "en",
            tone: "natural",
            feature: "text",
            favorite: false,
            savedAt: Date.now(),
          },
        ]),
      sameText
    );
    const same = page.locator(".history-entry");
    assert(
      await same.locator(".history-original").isHidden(),
      "Identical text is not repeated visually"
    );
    assert(await same.locator(".history-translation").isVisible());
    await same.locator(".history-toggle").click();
    assert(await same.locator(".history-original").isHidden());
    assert.equal(await same.locator(".history-translation").textContent(), sameText);
    assert.deepEqual(errors, []);
    console.log(
      "PASS compact history previews, full text expansion/copy/search, RTL, favorites and deletion persistence."
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
