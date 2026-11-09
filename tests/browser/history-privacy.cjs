/* Offline regressions: static assets and mocked requests only; no server or AI API. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const { readFileSync } = require("node:fs");

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const staticRoot = path.resolve(__dirname, "../../static");
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== "http://translator.test" || url.pathname.startsWith("/api/")) {
        if (url.pathname === "/api/language-catalog.js")
          return route.fulfill({
            contentType: "application/javascript",
            body: `const LANGUAGE_CATALOG = ${readFileSync(path.join(staticRoot, "language-catalog.json"), "utf8")};`,
          });
        return route.abort();
      }
      const file = path.resolve(
        staticRoot,
        url.pathname === "/" ? "index.html" : `.${url.pathname.replace(/^\/static/, "")}`
      );
      if (!file.startsWith(`${staticRoot}${path.sep}`)) return route.abort();
      return route.fulfill({ path: file });
    });
    await page.addInitScript(() => {
      window.translationCalls = [];
      window.fetch = (url, options = {}) => {
        if (url !== "/api/translate")
          return Promise.resolve(new Response(JSON.stringify({ alternatives: [] })));
        return new Promise((resolve) => {
          window.translationCalls.push({
            body: JSON.parse(options.body),
            signal: options.signal,
            finish(data) {
              resolve(new Response(JSON.stringify(data)));
            },
          });
        });
      };
    });
    await page.goto("http://translator.test");
    const stored = () =>
      page.evaluate(() => JSON.parse(localStorage.getItem("translator-history-v2")));
    const assertPrivate = async () => {
      const storage = await page.evaluate(() => ({ ...localStorage }));
      assert.equal(storage["translator-saved-v1"], undefined);
      const records = JSON.parse(storage["translator-history-v2"]);
      for (const record of records) {
        for (const field of [
          "conversation",
          "additional_targets",
          "additional_translations",
          "cache_scope",
          "defer_additional",
        ])
          assert.equal(Object.hasOwn(record, field), false, `History must exclude ${field}`);
      }
      return records;
    };

    // Both current and legacy records migrate immediately, before any new translation.
    for (const key of ["translator-history-v2", "translator-saved-v1"]) {
      const records = ["text", "document", "image", "live"].map((feature, index) => ({
        text: `${feature} original`,
        translation: `${feature} result`,
        source: "th",
        target: "en",
        sourceLanguage: "th",
        tone: "friendly",
        context: "travel",
        extra_context: "polite wording",
        glossary: [{ source: "test", target: "example" }],
        thai_mode: "standard",
        favorite: index !== 0,
        savedAt: 123456789,
        feature,
        conversation: [{ text: "DELETED PRIVATE MESSAGE", translation: "PRIVATE RESULT" }],
        additional_targets: ["ja"],
        additional_translations: [{ target: "ja", translation: "nested result" }],
        cache_scope: feature,
        defer_additional: true,
      }));
      if (key === "translator-saved-v1") delete records[1].favorite;
      await page.evaluate(
        ([key, records]) => {
          localStorage.clear();
          localStorage.setItem(key, JSON.stringify(records));
          localStorage.setItem("translator-theme", "light");
        },
        [key, records]
      );
      await page.reload();
      const migrated = await assertPrivate();
      assert.equal(migrated.length, 4);
      for (let index = 0; index < records.length; index++) {
        const {
          conversation,
          additional_targets,
          additional_translations,
          cache_scope,
          defer_additional,
          ...expected
        } = records[index];
        assert.deepEqual(migrated[index], { ...expected, favorite: expected.favorite !== false });
      }
      assert.equal(await page.evaluate(() => localStorage.getItem("translator-theme")), "light");
      assert(!JSON.stringify(migrated).includes("DELETED PRIVATE MESSAGE"));
      await page.reload();
      assert.deepEqual(await stored(), migrated, "Migration must be stable across reloads");
    }

    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.evaluate(() => {
      switchFeature("live");
      $("auto-speak").checked = false;
      activeFeature().preferences.multiple = true;
      activeFeature().preferences.targets = ["ja", "fr"];
      activeFeature().preferences.context = "conversation";
    });
    const send = async (text) => {
      await page.locator("#input").fill(text);
      await page.locator("#live-send").click();
    };
    const finish = (index, data) =>
      page.evaluate(([index, data]) => window.translationCalls[index].finish(data), [index, data]);
    const waitCalls = (count) =>
      page.waitForFunction((count) => window.translationCalls.length >= count, count);
    const deferred = ["ja", "fr"].map((target) => ({ target, pending: true }));

    await send("PRIVATE FIRST");
    await waitCalls(1);
    await finish(0, { translation: "FIRST RESULT", additional_translations: deferred });
    await waitCalls(3);
    assert.equal(await page.locator(".chat-turn").count(), 1);
    assert.equal(await page.locator(".chat-additional").count(), 2);
    assert.equal(await page.evaluate(() => activeFeature().additionalRequests.size), 0);
    // Re-rendering the generic panel must not claim chat's pending work.
    await page.evaluate(() => {
      renderAdditionalResults();
      renderAdditionalResults();
    });
    const calls = await page.evaluate(() => window.translationCalls.map((call) => call.body));
    assert.equal(calls.length, 3, "One primary plus exactly one request per extra target");
    for (const target of ["ja", "fr"])
      assert.equal(calls.filter((call) => call.target === target).length, 1);
    assert.equal(calls[0].defer_additional, true);
    await finish(1, { translation: `${calls[1].target}:FIRST RESULT` });
    await finish(2, { translation: `${calls[2].target}:FIRST RESULT` });
    await page.waitForFunction(() => activeFeature().chatRequests.size === 0);
    assert.match(await page.locator(".chat-turn").textContent(), /ja:FIRST RESULT/);
    assert.match(await page.locator(".chat-turn").textContent(), /fr:FIRST RESULT/);
    assert.equal((await assertPrivate()).length, 3, "Primary and extra targets retain history");

    // A later turn uses runtime context, but none of that context reaches storage.
    await send("PUBLIC SECOND");
    await waitCalls(4);
    const second = await page.evaluate(() => window.translationCalls[3].body);
    assert.equal(second.conversation[0].text, "PRIVATE FIRST");
    await finish(3, { translation: "SECOND RESULT", additional_translations: deferred });
    await waitCalls(6);
    const secondCalls = await page.evaluate(() =>
      window.translationCalls.slice(4).map((call) => call.body)
    );
    assert.equal(secondCalls.length, 2);
    assert.deepEqual(secondCalls.map((call) => call.target).sort(), ["fr", "ja"]);
    for (let index = 4; index < 6; index++)
      await finish(index, { translation: `EXTRA SECOND ${index}` });
    await page.waitForFunction(() => activeFeature().chatRequests.size === 0);
    assert.equal((await assertPrivate()).length, 6);

    await page.locator("#live-settings-toggle").click();
    await page.locator("#menu-tab-history").click();
    const firstHistory = page.locator(".history-entry").filter({ hasText: "PRIVATE FIRST" });
    for (let index = 0; index < 3; index++)
      await firstHistory
        .first()
        .getByRole("button", { name: "Delete translation", exact: true })
        .click();
    const remaining = await assertPrivate();
    assert.equal(remaining.length, 3);
    assert(!JSON.stringify(remaining).includes("PRIVATE FIRST"));
    await page
      .locator(".history-entry")
      .first()
      .getByRole("button", { name: "Favorite translation", exact: true })
      .click();
    const favorite = (await stored()).find((item) => item.favorite);
    assert(favorite);
    await page.reload();
    assert.deepEqual(
      (await stored()).find((item) => item.favorite),
      favorite
    );
    await page.evaluate(() => switchFeature("live"));
    await page.locator("#live-settings-toggle").click();
    await page.locator("#menu-tab-history").click();
    assert.equal(await page.locator(".history-entry").count(), 3);
    await page.locator("#history-clear").click();
    assert.deepEqual(await assertPrivate(), []);
    assert.deepEqual(errors, []);
    console.log(
      "PASS offline history migration/privacy, deletion, favorites and single-owner Live Chat deferred targets."
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
