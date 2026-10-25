const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const bundle = require("../../static/interface-locales/zh-TW.json");
const sourceLabels = require("../../static/interface-locales/en.json");
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ locale: "th-TH", viewport: { width: 390, height: 844 } });
    const errors = [],
      apiRequests = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/api/**", (route) => {
      if (route.request().method() === "GET") return route.continue();
      apiRequests.push(route.request().url());
      return route.fulfill({ status: 429, json: { error: "No AI quota" } });
    });
    const base = process.env.TRANSLATOR_TEST_URL || "http://127.0.0.1:5000";
    await page.goto(base);
    assert.equal(await page.evaluate(() => locale), "en");
    assert.deepEqual(
      await page.evaluate(() => COPY.en),
      sourceLabels,
      "Prepared source must match live menu labels"
    );
    assert.equal(await page.locator(".app-header #ui-language").count(), 0);
    assert.equal(
      await page.evaluate(() => availableInterfaceLanguages.size),
      await page.evaluate(() => Object.keys(LANGUAGE_CATALOG).length),
      "Every catalog language must have a ready menu translation"
    );
    const pair = await page.evaluate(() => activeLanguages());
    const translationLanguageCount = await page.locator("#target option").count();
    assert(translationLanguageCount > 100);
    await page.locator("#settings-toggle").click();
    await page.locator("#menu-tab-appearance").click();
    assert(await page.locator("#settings #ui-language").isVisible());
    assert.deepEqual(
      await page
        .locator("#interface-language option")
        .evaluateAll((options) => options.map((o) => o.value)),
      await page.evaluate(() => ["en", "th", ...BUNDLED_INTERFACE_LANGUAGES])
    );
    async function choose(code) {
      await page.locator("#ui-language").click();
      assert(await page.locator("#language-dialog").isVisible());
      assert(
        (await page.locator("#language-availability").textContent()).includes(
          String(await page.locator("#interface-language option").count())
        )
      );
      await page
        .locator("#language-search")
        .fill(code === "th" ? "ไทย" : code === "en" ? "English" : "Traditional Chinese");
      await page.locator(`#language-options [data-language="${code}"]`).click();
      await page.waitForFunction((code) => locale === code, code);
    }
    for (const code of await page.evaluate(() => [...availableInterfaceLanguages])) {
      await page.evaluate((code) => changeInterfaceLanguage(code), code);
      assert.equal(await page.evaluate(() => locale), code, `Prepared locale ${code} must load`);
      if (!["en", "th"].includes(code))
        assert(await page.evaluate((code) => validInterfaceCopy(COPY[code]), code));
      assert.equal(
        await page.locator("html").getAttribute("dir"),
        await page.evaluate((code) => (LANGUAGE_CATALOG[code]?.rtl ? "rtl" : "ltr"), code)
      );
      assert.deepEqual(await page.evaluate(() => activeLanguages()), pair);
    }
    await choose("th");
    assert.equal(await page.locator("html").getAttribute("lang"), "th");
    await choose("zh-TW");
    await page.locator("#ui-language").click();
    await page.locator("#language-search").fill(await page.evaluate(() => languageName("en")));
    assert(await page.locator('#language-options [data-language="en"]').isVisible());
    await page.locator("#language-dialog-close").click();
    assert.equal(await page.locator("#menu-heading").textContent(), "選單");
    assert.equal(await page.locator("#menu-panel-appearance h3").textContent(), "外觀");
    assert(await page.evaluate(() => validInterfaceCopy(COPY["zh-TW"])));
    assert.deepEqual(await page.evaluate(() => activeLanguages()), pair);
    assert.equal(await page.locator("#target option").count(), translationLanguageCount);
    assert.equal(await page.locator("#interface-language-status").textContent(), "");
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    await page.reload();
    await page.waitForFunction(() => locale === "zh-TW");
    await page.evaluate(() => changeInterfaceLanguage("not-a-language"));
    assert.equal(await page.evaluate(() => locale), "zh-TW");
    assert.deepEqual(apiRequests, []);

    const failurePage = await browser.newPage();
    failurePage.on("pageerror", (e) => errors.push(e.message));
    await failurePage.route("**/api/**", (route) => {
      if (route.request().method() === "GET") return route.continue();
      apiRequests.push(route.request().url());
      return route.abort();
    });
    await failurePage.route("**/static/interface-locales/zh-TW.json", (route) =>
      route.fulfill({ status: 404, body: "Missing" })
    );
    await failurePage.goto(base);
    await failurePage.evaluate(() => changeInterfaceLanguage("zh-TW"));
    assert.equal(await failurePage.evaluate(() => locale), "en");
    assert.equal(await failurePage.locator("#interface-language").inputValue(), "en");
    assert.equal(
      await failurePage.locator("#interface-language-status").getAttribute("aria-busy"),
      null
    );
    assert(
      await failurePage
        .locator("#interface-language-status")
        .evaluate((el) => el.classList.contains("error"))
    );
    // Old generated dictionaries and provider cooldowns must not affect static menus.
    await failurePage.evaluate(() => {
      localStorage.setItem(
        "translator-interface-v1",
        JSON.stringify({ language: "not-a-language", strings: { menu: "old generated menu" } })
      );
      localStorage.setItem("translator-interface-retry-at", String(Date.now() + 3600000));
    });
    await failurePage.reload();
    assert.equal(await failurePage.evaluate(() => locale), "en");
    assert.equal(
      await failurePage.evaluate(() => localStorage.getItem("translator-interface-retry-at")),
      null
    );
    await failurePage.unroute("**/static/interface-locales/zh-TW.json");
    let slowBundle;
    await failurePage.route("**/static/interface-locales/zh-TW.json", (route) => {
      slowBundle = route;
    });
    const slowRequest = failurePage.waitForRequest("**/static/interface-locales/zh-TW.json");
    await failurePage.evaluate(() => {
      void changeInterfaceLanguage("zh-TW");
    });
    await slowRequest;
    await failurePage.evaluate(() => changeInterfaceLanguage("th"));
    assert(slowBundle);
    await slowBundle.fulfill({ json: bundle }).catch(() => {});
    assert.equal(await failurePage.evaluate(() => locale), "th");
    await failurePage.clock.install();
    const timeoutRequest = failurePage.waitForRequest("**/static/interface-locales/zh-TW.json");
    await failurePage.evaluate(() => {
      void changeInterfaceLanguage("zh-TW");
    });
    await timeoutRequest;
    await failurePage.clock.fastForward(10001);
    await failurePage.waitForFunction(() => interfaceRequest === null);
    assert.equal(await failurePage.evaluate(() => locale), "th");
    assert.equal(
      await failurePage.locator("#interface-language-status").textContent(),
      await failurePage.evaluate(() => t("interfaceLanguageTimeout"))
    );
    await slowBundle.abort().catch(() => {});
    assert.deepEqual(apiRequests, []);
    assert.deepEqual(errors, []);
    await failurePage.close();
    console.log(
      "PASS all prepared menu languages, no AI calls even with zero quota, separate 113-language translation catalog, persistence, stale preference migration, failed/late/timeout loading and responsive layout."
    );
  } finally {
    await browser.close();
  }
})();
