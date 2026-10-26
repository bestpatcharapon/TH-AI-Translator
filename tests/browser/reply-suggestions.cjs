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
      drafts = ["Thanks for telling me.", "Thank you for the update.", "Okay."],
      outgoing = ["ขอบคุณที่บอกนะ", "ขอบคุณที่แจ้งให้ทราบ", "โอเค"];
    let suggestions = 0,
      translations = 0,
      fail = true,
      editFailure = true,
      lateEditResolve;
    const lateEditRequest = new Promise((resolve) => {
      lateEditResolve = resolve;
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/translate", (route) => {
      translations++;
      const body = route.request().postDataJSON();
      if (body.text === "Late edit") {
        lateEditResolve(route);
        return;
      }
      if (body.text !== "จะไปแล้วครับ") {
        assert.equal(body.source, "en");
        assert.equal(body.target, "th");
        if (editFailure)
          return route.fulfill({ status: 503, json: { error: "Translation unavailable" } });
        return route.fulfill({
          json: { translation: "ขอบคุณ ฉันจะไปถึงตอนหกโมง", source_language: "en" },
        });
      }
      return route.fulfill({ json: { translation: "I'm going now.", source_language: "th" } });
    });
    await page.route("**/api/assist", (route) => {
      const body = route.request().postDataJSON();
      if (body.action !== "replies")
        return route.fulfill({ json: { pronunciation: "ja pai", alternatives: [] } });
      suggestions++;
      if (fail) return route.fulfill({ status: 503, json: { error: "Try again" } });
      assert.equal(body.text, "จะไปแล้วครับ");
      return route.fulfill({
        json: {
          replies: drafts,
          source_language: "th",
          reply_details: drafts.map((text, i) => ({
            text,
            translation: outgoing[i],
            style: ["friendly", "professional", "short"][i],
          })),
        },
      });
    });
    await page.goto(process.env.TRANSLATOR_TEST_URL || "http://127.0.0.1:5000");
    await page.evaluate(() => {
      window.replyAudio = [];
      speak = (text, language) => window.replyAudio.push({ text, language });
    });
    await page.locator("#input").fill("จะไปแล้วครับ");
    await page.waitForFunction(() => document.querySelector("#output").value === "I'm going now.");
    assert.equal(await page.locator("#reply-input, #translate-reply, #reply-section").count(), 0);
    await page.locator("#suggest-replies").click();
    await page.waitForFunction(() =>
      document.querySelector("#suggestion-status").classList.contains("error")
    );
    fail = false;
    await page.locator("#suggest-replies").click();
    await page.locator(".reply-suggestion-card").first().waitFor();
    assert.equal(await page.locator(".reply-suggestion-card").count(), 3);
    assert.deepEqual(
      await page.locator(".reply-suggestion-card > p:first-of-type").allTextContents(),
      outgoing
    );
    assert.deepEqual(await page.locator(".reply-suggestion-meaning").allTextContents(), drafts);
    await page
      .locator(".reply-suggestion-card")
      .first()
      .getByRole("button", { name: "Copy", exact: true })
      .click();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), outgoing[0]);
    await page
      .locator(".reply-suggestion-card")
      .first()
      .getByRole("button", { name: "Listen", exact: true })
      .click();
    assert.deepEqual(await page.evaluate(() => window.replyAudio[0]), {
      text: outgoing[0],
      language: "th",
    });
    assert.equal(translations, 1, "Suggestions must not send a reply automatically");
    assert.equal(await page.locator(".reply-suggestion-edit").count(), 3);
    await page.locator(".reply-suggestion-edit").first().click();
    assert.equal(await page.locator("#reply-edit-input").inputValue(), drafts[0]);
    await page.locator("#reply-edit-input").fill("Thanks, I'll arrive at six.");
    await page.locator("#reply-edit-submit").click();
    await page.waitForFunction(() =>
      document.querySelector("#reply-edit-status").classList.contains("error")
    );
    assert(await page.locator("#reply-edit-dialog").isVisible());
    assert.equal(
      await page.locator("#reply-edit-input").inputValue(),
      "Thanks, I'll arrive at six."
    );
    editFailure = false;
    await page.locator("#reply-edit-submit").click();
    await page.locator("#reply-edit-dialog").waitFor({ state: "hidden" });
    drafts[0] = "Thanks, I'll arrive at six.";
    outgoing[0] = "ขอบคุณ ฉันจะไปถึงตอนหกโมง";
    assert.equal(await page.locator(".reply-suggestion-text").first().textContent(), outgoing[0]);
    assert.equal(await page.locator(".reply-suggestion-meaning").first().textContent(), drafts[0]);
    await page.locator(".reply-suggestion-edit").nth(1).click();
    await page.locator("#reply-edit-input").fill("Discard this draft.");
    await page.locator("#reply-edit-close").click();
    assert.equal(translations, 3, "Canceling edits must not call the API");
    assert.equal(await page.locator(".reply-suggestion-meaning").nth(1).textContent(), drafts[1]);
    await page.locator("#suggest-replies").click();
    assert(await page.locator("#reply-suggestions").isHidden());
    await page.locator("#suggest-replies").click();
    assert.equal(suggestions, 2, "Opening saved suggestions must not call AI again");
    await page.evaluate(() => switchFeature("document"));
    assert(await page.locator("#reply-suggestions").isHidden());
    await page.evaluate(() => switchFeature("text"));
    assert.equal(await page.locator(".reply-suggestion-card").count(), 3);
    assert(await page.locator("#reply-suggestions").isVisible());
    await page.evaluate(() => changeInterfaceLanguage("th"));
    assert.equal(await page.locator(".reply-suggestion-style").first().textContent(), "เป็นมิตร");
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert(
        await page.locator("#reply-suggestions").evaluate((e) => e.scrollWidth <= e.clientWidth)
      );
    }
    await page.evaluate(() => {
      const originalFetch = window.fetch;
      window.fetch = (url, options = {}) => {
        if (url === "/api/translate" && JSON.parse(options.body || "{}").text === "Late edit") {
          return originalFetch(url, { ...options, signal: undefined }).finally(() => {
            window.lateReplyFinished = true;
          });
        }
        return originalFetch(url, options);
      };
    });
    await page.locator(".reply-suggestion-edit").first().click();
    await page.locator("#reply-edit-input").fill("Late edit");
    await page.locator("#reply-edit-submit").click();
    const lateRoute = await lateEditRequest;
    await page.evaluate(() => switchFeature("document"));
    assert(await page.locator("#reply-edit-dialog").isHidden());
    await lateRoute.fulfill({ json: { translation: "MUST NOT APPLY", source_language: "en" } });
    await page.waitForFunction(() => window.lateReplyFinished);
    await page.evaluate(() => switchFeature("text"));
    assert.equal(await page.locator(".reply-suggestion-text").first().textContent(), outgoing[0]);
    assert.equal(await page.locator("#output").inputValue(), "I'm going now.");
    assert.equal(await page.locator(".chat-turn").count(), 0);
    assert.deepEqual(errors, []);
    console.log(
      "PASS bilingual suggestion cards, edit/translate, failure recovery, cancel, late-response isolation, copy/listen, collapse and no automatic sending."
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
