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
      requests = [],
      photoRequests = [];
    let photoResult;
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/api/translate", async (route) => {
      const body = route.request().postDataJSON();
      requests.push(body);
      await route.fulfill({
        json: {
          translation: `${body.target}:${body.text}`,
          source_language: body.source === "auto" ? "en" : body.source,
          additional_translations: (body.additional_targets || []).map((target) =>
            target === "ja"
              ? { target, error: "Temporary rate limit" }
              : { target, translation: `${target}:${body.text}` }
          ),
        },
      });
    });
    await page.route("**/api/assist", (route) =>
      route.fulfill({
        json: { pronunciation: "reading", alternatives: ["first example", "second example"] },
      })
    );
    await page.route("**/api/photo-translate", async (route) => {
      photoRequests.push(route.request().postData());
      await route.fulfill({ json: photoResult });
    });
    await page.goto(process.env.TRANSLATOR_TEST_URL || "http://127.0.0.1:5000");
    await page.locator("#settings-toggle").click();
    await page.locator("#settings").waitFor();
    await page.locator("#tone").selectOption("friendly");
    await page.locator("#translation-context").selectOption("travel");
    await page.locator("#extra-context").fill("Speaking to a hotel receptionist");
    await page.locator("#multiple-languages").check();
    for (const code of ["ja", "ko", "fr"])
      await page.locator(`#additional-targets input[value="${code}"]`).check();
    assert.equal(await page.locator('#additional-targets input[value="de"]').isDisabled(), true);
    assert.match(await page.locator("#additional-count").textContent(), /3 \/ 3/);
    await page.screenshot({ path: "/tmp/translator-menu-options.png" });
    await page.locator("#menu-close").click();
    await page.locator("#input").fill("สวัสดีครับ");
    await page.waitForFunction(() => document.querySelector("#output").value === "en:สวัสดีครับ");
    await page.locator(".additional-result").first().waitFor();
    assert.equal(requests[0].tone, "friendly");
    assert.equal(requests[0].context, "travel");
    assert.equal(requests[0].extra_context, "Speaking to a hotel receptionist");
    assert.deepEqual(requests[0].additional_targets, ["ja", "ko", "fr"]);
    assert.equal(await page.locator(".additional-result").count(), 3);
    await page.locator(".additional-result").first().getByRole("button", { name: "Retry" }).click();
    await page.waitForFunction(
      () => document.querySelectorAll(".additional-result .error").length === 0
    );
    assert.equal(requests.at(-1).target, "ja");
    assert.equal(requests.at(-1).additional_targets, undefined);
    await page.locator("#save-translation").click();
    await page.locator("#settings-toggle").click();
    assert.equal(await page.locator(".history-entry").count(), 4);
    await page.locator("#history-search").fill("fr:");
    assert.equal(await page.locator(".history-entry").count(), 1);
    await page.locator(".history-entry header button").first().click();
    await page.locator(".history-entry header button").nth(1).click();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), "fr:สวัสดีครับ");
    await page.locator("#history-search").fill("");
    await page.locator("#history-favorites").check();
    assert.equal(await page.locator(".history-entry").count(), 2);
    await page.screenshot({ path: "/tmp/translator-menu-history.png" });
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#settings-toggle").getAttribute("aria-expanded"), "false");
    await page.evaluate(() => switchFeature("document"));
    await page.locator("#settings-toggle").click();
    assert.equal(await page.locator("#tone").inputValue(), "natural");
    assert.equal(await page.locator("#translation-context").inputValue(), "general");
    assert.equal(await page.locator("#extra-context").inputValue(), "");
    assert.equal(await page.locator("#multiple-languages").isChecked(), false);
    assert.equal(await page.locator(".history-entry").count(), 0);
    await page.locator("#menu-close").click();
    await page.locator("#input").fill("DOCUMENT HISTORY");
    await page.waitForFunction(
      () => document.querySelector("#output").value === "en:DOCUMENT HISTORY"
    );
    await page.evaluate(() => switchFeature("text"));
    await page.locator("#settings-toggle").click();
    assert.equal(await page.locator("#tone").inputValue(), "friendly");
    assert.equal(await page.locator("#translation-context").inputValue(), "travel");
    assert.equal(await page.locator("#history-favorites").isChecked(), true);
    assert.equal(await page.locator(".history-entry").count(), 2);
    await page.locator("#history-clear").click();
    assert.equal(await page.locator(".history-entry").count(), 0);
    await page.locator("#menu-close").click();
    await page.evaluate(() => switchFeature("document"));
    await page.locator("#settings-toggle").click();
    assert.equal(await page.locator(".history-entry").count(), 1);
    await page.locator("#menu-close").click();
    await page.evaluate(() => switchFeature("live"));
    await page.locator("#live-audio").click();
    await page.locator("#input").fill("LIVE HISTORY");
    await page.locator("#live-send").click();
    await page.locator(".chat-turn").waitFor();
    await page.locator("#live-settings-toggle").click();
    assert.equal(await page.locator(".history-entry").count(), 1);
    assert.match(await page.locator(".history-original").textContent(), /LIVE HISTORY/);
    await page.locator("#multiple-languages").check();
    await page.locator('#additional-targets input[value="ja"]').check();
    await page.locator("#menu-close").click();
    await page.locator("#input").fill("LIVE MULTILINGUAL");
    await page.locator("#live-send").click();
    await page.waitForFunction(() => document.querySelectorAll(".chat-turn").length === 2);
    await page
      .locator(".chat-turn")
      .last()
      .getByRole("button", { name: "Retry", exact: true })
      .click();
    await page.waitForFunction(
      () => document.querySelectorAll(".chat-turn .outline-button").length === 0
    );
    assert.match(await page.locator(".chat-turn").last().textContent(), /ja:LIVE MULTILINGUAL/);
    await page.locator("#live-settings-toggle").click();
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      const box = await page.locator("#settings").boundingBox();
      assert(box.x >= 0 && box.x + box.width <= width + 1);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true
      );
    }
    await page.locator("#menu-close").click();
    await page.evaluate(() => switchFeature("image"));
    const image = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 200;
      canvas.height = 120;
      return canvas.toDataURL();
    });
    photoResult = {
      image,
      width: 200,
      height: 120,
      source_language: "th",
      target_language: "en",
      regions: [
        {
          id: 0,
          x: 5,
          y: 5,
          width: 100,
          height: 20,
          text: "IMAGE HISTORY",
          translation: "IMAGE RESULT",
          background: "#ffffff",
          foreground: "#111111",
        },
      ],
      additional_translations: [{ target: "ar", translation: "مرحبا" }],
    };
    await page.locator("#settings-toggle").click();
    await page.locator("#tone").selectOption("friendly");
    await page.locator("#translation-context").selectOption("travel");
    await page.locator("#multiple-languages").check();
    await page.locator('#additional-targets input[value="ar"]').check();
    await page.locator("#menu-close").click();
    await page.locator("#photo-file-input").setInputFiles({
      name: "photo.png",
      mimeType: "image/png",
      buffer: Buffer.from(image.split(",")[1], "base64"),
    });
    await page.locator(".photo-label").first().waitFor();
    await page.locator(".additional-result").waitFor();
    assert.match(photoRequests[0], /friendly/);
    assert.match(photoRequests[0], /travel/);
    assert.match(photoRequests[0], /ar/);
    await page.locator("#settings-toggle").click();
    assert.equal(await page.locator(".history-entry").count(), 2);
    await page.locator("#menu-close").click();
    await page.locator("#photo-remove").click();
    assert.equal(await page.locator("#additional-results").isVisible(), false);
    await page.reload();
    await page.locator("#settings-toggle").click();
    assert.equal(await page.locator(".history-entry").count(), 0);
    await page.locator("#menu-close").click();
    await page.evaluate(() => switchFeature("document"));
    await page.locator("#settings-toggle").click();
    assert.equal(await page.locator(".history-entry").count(), 1);
    await page.locator("#menu-close").click();
    await page.locator("#ui-language").click();
    await page.locator("#settings-toggle").click();
    assert.equal(await page.locator("#menu-heading").textContent(), "เมนู");
    assert.deepEqual(errors, []);
    console.log(
      "PASS: modal menu, real preference payloads, max 3 extra languages, partial failure/retry, automatic history, favorites/search/copy, feature-specific clear/preferences/history, persistence, Live Chat menu, responsive layout and Thai labels; no JS errors."
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
