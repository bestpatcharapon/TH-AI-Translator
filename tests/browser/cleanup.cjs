const { chromium } = require("playwright");
const assert = require("node:assert/strict");

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/translate", (route) =>
      route.fulfill({ json: { translation: "Translated", source_language: "th" } })
    );
    await page.route("**/api/assist", (route) => {
      const { action } = route.request().postDataJSON();
      return route.fulfill({
        json:
          action === "check"
            ? { assessment: "needs_revision", notes: "Suggested wording", revision: "Pay 50 baht." }
            : { pronunciation: "reading", alternatives: ["first", "second"] },
      });
    });
    await page.goto(process.env.TRANSLATOR_TEST_URL || "http://127.0.0.1:5000");
    await page.evaluate(() => {
      sourceEl.value = "auto";
      targetEl.value = "en";
      inputEl.value = "ราคา500บาท";
      updateLanguages();
      updateInput();
      commitTranslation({
        text: inputEl.value,
        translation: "Pay 500 baht.",
        source: "auto",
        sourceLanguage: "th",
        target: "en",
        tone: "natural",
        feature: "text",
        audit: { status: "clear", issues: [], terms_checked: 0, terms_matched: 0 },
      });
    });
    // The existing Check translation action must not preserve the previous audit.
    await page.locator("#check-translation").click();
    await page.locator("#apply-revision").click();
    await page.waitForFunction(() => document.querySelector("#output").value === "Pay 50 baht.");
    assert.equal(await page.evaluate(() => currentTranslation.audit.status), "review");
    assert.equal(await page.evaluate(() => currentTranslation.audit.issues[0].missing[0]), "500");
    await page.locator("#swap").click();
    assert.equal(await page.evaluate(() => targetEl.value), "th");
    await page.evaluate(() => cancelAutoTranslation());

    // A late clipboard completion cannot overwrite a newly opened photo label.
    await page.evaluate(() => {
      switchFeature("image");
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: () =>
            new Promise((resolve) => {
              window.resolveCopy = resolve;
            }),
        },
      });
      photoActiveLabel = { translation: "OLD LABEL" };
      document.querySelector("#photo-label-dialog").showModal();
      document.querySelector("#photo-label-copy").click();
    });
    await page.evaluate(() => {
      document.querySelector("#photo-label-dialog").close();
      photoActiveLabel = { translation: "NEW LABEL" };
      document.querySelector("#photo-label-dialog").showModal();
      document.querySelector("#photo-label-status").textContent = "NEW STATUS";
      window.resolveCopy();
    });
    await page.waitForTimeout(50);
    assert.equal(await page.locator("#photo-label-status").textContent(), "NEW STATUS");

    // Switching feature during image decoding must cancel the pending export.
    await page.evaluate(() => {
      document.querySelector("#photo-label-dialog").close();
      const canvas = document.createElement("canvas");
      canvas.width = 20;
      canvas.height = 20;
      photoData = {
        image: canvas.toDataURL(),
        width: 20,
        height: 20,
        regions: [],
        target_language: "en",
      };
      window.originalDecode = Image.prototype.decode;
      Image.prototype.decode = () =>
        new Promise((resolve) => {
          window.resolveDecode = resolve;
        });
      document.querySelector("#photo-download").click();
    });
    await page.waitForFunction(() => !!window.resolveDecode);
    await page.evaluate(() => {
      window.downloadsStarted = 0;
      HTMLCanvasElement.prototype.toBlob = () => {
        window.downloadsStarted++;
      };
      switchFeature("text");
      window.resolveDecode();
      Image.prototype.decode = window.originalDecode;
    });
    await page.waitForTimeout(50);
    assert.equal(await page.evaluate(() => window.downloadsStarted), 0);

    // A delayed copy from one expanded chat message cannot label the next message.
    await page.evaluate(() => {
      switchFeature("live");
      expandedChatTurn = { translation: "OLD CHAT" };
      document.querySelector("#live-message-dialog").showModal();
      document.querySelector("#live-message-copy").click();
    });
    await page.evaluate(async () => {
      const dialog = document.querySelector("#live-message-dialog");
      const closed = new Promise((resolve) =>
        dialog.addEventListener("close", resolve, { once: true })
      );
      dialog.close();
      await closed;
      expandedChatTurn = { translation: "NEW CHAT" };
      dialog.showModal();
      document.querySelector("#live-message-direction").textContent = "NEW DIRECTION";
      window.resolveCopy();
    });
    await page.waitForTimeout(50);
    assert.equal(await page.locator("#live-message-direction").textContent(), "NEW DIRECTION");
    assert.deepEqual(errors, []);
    console.log(
      "PASS: detected-language swap, audited suggested revisions, stale clipboard ownership and canceled photo exports."
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
