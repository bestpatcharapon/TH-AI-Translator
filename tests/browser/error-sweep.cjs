const { chromium } = require("playwright");
const assert = require("node:assert/strict");

// Server-free smoke sweep: every workspace, settings tab, theme, language picker
// and interface language must run without a JS error or unhandled rejection.
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error" && !message.text().includes("favicon")) {
        errors.push(`console: ${message.text()}`);
      }
    });
    await page.addInitScript(() => {
      window.addEventListener("unhandledrejection", (event) =>
        console.error("unhandledrejection: " + (event.reason?.message || event.reason))
      );
    });

    const json = (route, body) => route.fulfill({ json: body });
    await page.route("**/api/translate", (route) => {
      const body = route.request().postDataJSON();
      return json(route, {
        translation: `Translated: ${body.text}`,
        source_language: body.source === "auto" ? "th" : body.source,
        quality_review: { status: "clear" },
        audit: { status: "clear", issues: [] },
        additional_translations: (body.additional_targets || []).map((target) => ({
          target,
          translation: `Extra ${target}`,
          audit: { status: "clear", issues: [] },
        })),
      });
    });
    await page.route("**/api/transcribe", (route) =>
      json(route, { text: "hello", review_required: false, review_reasons: [] })
    );
    await page.route("**/api/extract", (route) =>
      json(route, { text: "Extracted text", filename: "note.txt" })
    );
    await page.route("**/api/assist", (route) =>
      json(route, {
        pronunciation: "reading",
        alternatives: ["one"],
        explanation: "Because.",
        review: "Looks right.",
        replies: [],
      })
    );
    await page.route("**/api/speech", (route) =>
      route.fulfill({ body: Buffer.alloc(64), contentType: "audio/mpeg" })
    );

    await page.goto(process.env.TRANSLATOR_TEST_URL || "http://127.0.0.1:5000", {
      waitUntil: "load",
    });

    const settle = () => page.waitForTimeout(120);

    for (const mode of ["text", "image", "document", "live", "text"]) {
      await page.evaluate((value) => switchFeature(value), mode);
      await settle();
    }

    await page.locator("#input").fill("สวัสดี");
    await page.waitForFunction(() =>
      document.querySelector("#output").value.includes("Translated")
    );
    await page.locator("#explain").click();
    await page.locator("#check-translation").click();
    await settle();

    await page.locator("#settings-toggle").click();
    for (const tab of ["#menu-tab-translation", "#menu-tab-history", "#menu-tab-appearance"]) {
      await page.locator(tab).click();
      await settle();
    }
    await page.locator("#menu-tab-appearance").click();
    await page.locator("#menu-theme").click();
    await page.locator("#menu-theme").click();
    await page.locator("#menu-tab-translation").click();
    await page.locator("#translation-context-trigger").click();
    await page.locator("#preference-close").click();
    await page.locator("#menu-close").click();

    for (const ids of [
      ["#source-picker", "ja"],
      ["#target-picker", "ko"],
    ]) {
      await page.locator(ids[0]).click();
      await page.locator("#language-search").fill(ids[1]);
      await page.locator(`#language-options [data-language="${ids[1]}"]`).first().click();
      await settle();
      assert(await page.locator("#language-dialog").isHidden(), "picker closes after choosing");
    }

    for (const code of ["th", "ar", "ja", "en"]) {
      await page.evaluate((value) => changeInterfaceLanguage(value), code);
      await settle();
    }

    await page.locator("#input").fill("Hello again");
    await page.waitForFunction(() =>
      document.querySelector("#output").value.includes("Translated")
    );
    await settle();

    assert.deepEqual(errors, [], errors.join("\n"));
    console.log(
      "PASS zero-JS-error sweep: all modes, settings tabs, theme, language pickers and interface languages."
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
