const { chromium } = require("playwright");
const assert = require("node:assert/strict");

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage(),
      errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/translate", (route) =>
      route.fulfill({
        json: { translation: "A translated message.", source_language: "th" },
      })
    );
    await page.route("**/api/assist", (route) =>
      route.fulfill({ json: { pronunciation: "", alternatives: [] } })
    );
    await page.goto(process.env.TRANSLATOR_TEST_URL || "http://127.0.0.1:5000");

    async function noOverflow(selector) {
      assert(
        await page.locator(selector).evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        selector + " must not overflow horizontally"
      );
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    }

    for (const language of ["en", "th", "ar"]) {
      await page.evaluate((code) => changeInterfaceLanguage(code), language);
      for (const size of [
        { width: 320, height: 568 },
        { width: 393, height: 852 },
        { width: 430, height: 932 },
        { width: 768, height: 1024 },
        { width: 844, height: 390 },
      ]) {
        await page.setViewportSize(size);
        await page.evaluate(() => switchFeature("text"));
        await page.locator("#input").fill("");
        await noOverflow(".translator");
        const source = page.locator("#input"),
          shortHeight = await source.evaluate((el) => el.clientHeight);
        await source.fill("ทดสอบข้อความในโทรศัพท์หลายบรรทัด\n".repeat(12));
        if (size.width <= 700)
          assert(await source.evaluate((el) => el.scrollHeight > el.clientHeight));
        else assert(await source.evaluate((el) => el.clientHeight > 150));
        await source.fill("สั้น");
        assert((await source.evaluate((el) => el.clientHeight)) <= shortHeight + 1);

        await page.locator("#settings-toggle").click();
        await noOverflow("#settings");
        await page.locator("#translation-context-trigger").click();
        await noOverflow("#preference-dialog");
        const cards = await page
          .locator(".context-options .preference-option")
          .evaluateAll((items) =>
            items.map((item) => {
              const bounds = item.getBoundingClientRect(),
                icon = item.querySelector(".preference-option-icon").getBoundingClientRect(),
                name = item.querySelector(".preference-option-name").getBoundingClientRect(),
                help = item.querySelector(".preference-option-help"),
                description = help.getBoundingClientRect();
              return {
                separated: description.top >= Math.max(icon.bottom, name.bottom) + 5,
                contained: description.bottom <= bounds.bottom - 8,
                // Some script fonts draw diacritics just outside their line box.
                readable: help.scrollHeight <= help.clientHeight + 3,
                label: item.dataset.value,
                helpHeight: help.clientHeight,
                helpScroll: help.scrollHeight,
              };
            })
          );
        assert.equal(cards.length, 8);
        for (const card of cards) {
          assert(card.separated, "Context description must not overlap its heading");
          assert(card.contained, "Context content must fit inside the card");
          if (size.width <= 700)
            assert(
              card.readable,
              `Mobile descriptions must be complete: ${language} ${size.width} ${JSON.stringify(card)}`
            );
        }
        await page.locator('#preference-options [data-value="health"]').scrollIntoViewIfNeeded();
        assert(
          await page.locator("#preference-close").evaluate((el) => {
            const rect = el.getBoundingClientRect();
            return rect.top >= 0 && rect.bottom <= innerHeight;
          })
        );
        await page.locator('#preference-options [data-value="health"]').click();
        assert.equal(await page.locator("#translation-context").inputValue(), "health");
        await page.locator("#multiple-languages").check();
        await noOverflow("#additional-language-options");
        await page.locator("#additional-search").fill("Japanese");
        await page.locator('#additional-targets input[value="ja"]').check();
        await page.locator("#menu-close").click();

        for (const mode of ["image", "document"]) {
          await page.evaluate((value) => switchFeature(value), mode);
          await noOverflow(".translator");
          assert(!(await page.locator("#microphone").isVisible()));
          if (mode === "image") {
            await noOverflow(".photo-upload-actions");
            const buttons = await page
              .locator(".photo-upload-actions button")
              .evaluateAll((items) => items.map((el) => el.getBoundingClientRect().height));
            assert(buttons.every((height) => height >= 44));
          } else {
            assert(await page.locator("#choose-file").isVisible());
            await noOverflow("#choose-file");
          }
        }

        await page.evaluate(() => switchFeature("live"));
        await noOverflow(".live-composer");
        await noOverflow(".translator");
        await page.locator("#input").fill("Hello");
        await page.locator("#input").scrollIntoViewIfNeeded();
        const input = await page.locator("#input").boundingBox();
        assert(input.y >= -1 && input.y + input.height <= size.height + 1);
        await page.locator("#live-settings-toggle").click();
        await noOverflow("#settings");
        await page.locator("#menu-close").click();
        await page.evaluate(() => switchFeature("text"));
      }
    }

    // Resizing for the on-screen keyboard must leave the composer reachable.
    await page.setViewportSize({ width: 393, height: 852 });
    await page.evaluate(() => switchFeature("live"));
    await page.setViewportSize({ width: 393, height: 360 });
    await page.locator("#input").scrollIntoViewIfNeeded();
    const keyboardInput = await page.locator("#input").boundingBox();
    assert(keyboardInput.y >= 0 && keyboardInput.y + keyboardInput.height <= 360);
    await noOverflow(".live-composer");
    assert.deepEqual(errors, []);
    console.log(
      "PASS mobile/tablet/landscape in English/Thai/RTL: readable Context cards, scrolling, compact source sizing, settings, photo/document controls, Live Chat and reduced keyboard viewport."
    );
  } finally {
    await browser.close();
  }
})();
