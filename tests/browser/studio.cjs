const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const base = process.env.TRANSLATOR_TEST_URL || "http://127.0.0.1:5000";
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [],
      translations = [];
    let analyses = 0,
      comparisons = 0,
      hold = false,
      pending = null;
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      const original = fetch;
      window.fetch = (url, options = {}) => original(url, { ...options, signal: undefined });
    });
    const auditFor = async (body, translation) => {
      const response = await page.request.post(base + "/api/audit", {
        data: { ...body, translation },
      });
      assert.equal(response.status(), 200);
      return (await response.json()).audit;
    };
    await page.route("**/api/translate", async (route) => {
      const body = route.request().postDataJSON();
      translations.push(body);
      const translation = body.text.includes("500") ? "Pay 50 baht." : `Translated ${body.text}`;
      await route.fulfill({
        json: {
          translation,
          source_language: "th",
          additional_translations: [],
          audit: await auditFor(body, translation),
        },
      });
    });
    await page.route("**/api/assist", (r) =>
      r.fulfill({
        json: { pronunciation: "reading", alternatives: ["one example", "two examples"] },
      })
    );
    const review = {
      assessment: "review",
      summary: "The amount changed from 500 to 50.",
      issues: [
        {
          kind: "meaning",
          source_quote: "500",
          translation_quote: "50",
          explanation: "The translation loses a zero.",
        },
      ],
      alternatives: [
        {
          label: "Polite",
          translation: "Please pay 500 baht.",
          reason: "Keeps the amount and adds polite wording.",
        },
        {
          label: "Natural",
          translation: "The amount due is 500 baht.",
          reason: "Natural billing wording.",
        },
      ],
      questions: ["Is this a payment request?"],
      revision: "Please pay 500 baht.",
      back_translation: "จ่าย 50 บาท",
      source_language: "th",
    };
    await page.route("**/api/analyze", async (route) => {
      analyses++;
      const body = route.request().postDataJSON();
      if (hold) {
        pending = route;
        return;
      }
      await route.fulfill({ json: { ...review, audit: await auditFor(body, body.translation) } });
    });
    await page.route("**/api/compare", async (route) => {
      comparisons++;
      const body = route.request().postDataJSON();
      await route.fulfill({
        json: {
          winner: "other",
          summary: "The other wording preserves 500.",
          blind_order: true,
          criteria: ["meaning", "fluency", "tone", "terminology"].map((criterion) => ({
            criterion,
            preferred: "other",
            reason: "Preserves the intended payment amount.",
            source_quote: "500",
          })),
          audits: {
            current: await auditFor(body, body.translation),
            other: await auditFor(body, body.other_translation),
          },
        },
      });
    });
    await page.goto(base);
    await page.locator("#settings-toggle").click();
    assert.equal(await page.locator("#glossary-editor").isVisible(), false);
    await page.evaluate(async () => {
      await saveGlossary([{ source: "ใบเสนอราคา", target: "quotation", language: "en" }]);
      renderGlossary();
    });
    await page.waitForFunction(() => document.querySelectorAll(".glossary-entry").length === 1);
    assert.equal(await page.locator("#glossary-count").textContent(), "1 / 30");
    await page.locator("#menu-close").click();
    await page.locator("#input").fill("ชำระ500บาท");
    await page.waitForFunction(() => document.querySelector("#output").value === "Pay 50 baht.");
    assert.equal(translations.at(-1).glossary[0].target, "quotation");
    assert.match(await page.locator("#studio-audit-badge").textContent(), /consistency issue/);
    assert.equal(analyses, 0);
    await page.locator("#open-studio").click();
    await page.waitForFunction(() => document.querySelectorAll(".studio-alternative").length === 2);
    assert.match(await page.locator("#studio-analysis").textContent(), /loses a zero/);
    await page.locator("#studio-analysis .studio-back summary").first().click();
    assert.match(await page.locator("#studio-analysis").textContent(), /จ่าย 50 บาท/);
    await page.screenshot({ path: "/tmp/translator-studio-review.png", fullPage: true });
    await page.locator(".studio-alternative button").first().click();
    await page.waitForFunction(
      () => document.querySelector("#output").value === "Please pay 500 baht."
    );
    assert(!(await page.locator("#studio-audit-badge").isVisible()));
    assert.equal(await page.locator("#studio-undo").isVisible(), true);
    await page.locator("#studio-undo").click();
    await page.waitForFunction(() => document.querySelector("#output").value === "Pay 50 baht.");
    assert.equal(await page.locator("#studio-undo").isVisible(), false);
    await page.locator("#studio-analyze").click();
    await page.waitForFunction(() => document.querySelectorAll(".studio-alternative").length === 2);
    await page.locator("#studio-other").fill("Please pay 500 baht.");
    await page.locator("#studio-compare").click();
    await page.waitForFunction(() =>
      document.querySelector("#studio-comparison").textContent.includes("preserves 500")
    );
    assert.equal(comparisons, 1);
    const download = page.waitForEvent("download");
    await page.locator("#studio-export").click();
    const file = await download;
    await file.saveAs("/tmp/translator-studio-report.json");
    const report = JSON.parse(fs.readFileSync("/tmp/translator-studio-report.json", "utf8"));
    assert.equal(report.comparison.winner, "other");
    assert.match(report.review_type, /not an independently certified/);
    const analysisCount = analyses;
    await page.evaluate(() => switchFeature("document"));
    assert.equal(await page.locator("#translation-studio").isVisible(), false);
    await page.locator("#settings-toggle").click();
    await page.locator("#glossary-editor").evaluate((e) => (e.open = true));
    assert.equal(await page.locator(".glossary-entry").count(), 0);
    await page.locator("#menu-close").click();
    await page.evaluate(() => switchFeature("text"));
    assert.equal(await page.locator(".studio-alternative").count(), 2);
    assert.equal(await page.locator("#studio-other").inputValue(), "Please pay 500 baht.");
    assert.equal(analyses, analysisCount);
    hold = true;
    await page.locator("#studio-analyze").click();
    await page.waitForFunction(() => document.querySelector("#studio-cancel").hidden === false);
    for (let i = 0; i < 100 && !pending; i++) await page.waitForTimeout(20);
    assert(pending);
    await page.evaluate(() => switchFeature("document"));
    await pending.fulfill({ json: { ...review, summary: "LATE REVIEW MUST NOT LEAK" } });
    await page.waitForTimeout(80);
    assert.equal(await page.locator("#translation-studio").isVisible(), false);
    await page.evaluate(() => switchFeature("text"));
    assert.doesNotMatch(await page.locator("#studio-analysis").textContent(), /LATE REVIEW/);
    assert.equal(await page.locator("#studio-cancel").isVisible(), false);
    assert.doesNotMatch(await page.locator("#studio-status").textContent(), /Reviewing/);
    hold = false;
    await page.locator("#input").fill("ยาว".repeat(1100));
    await page.waitForFunction(() =>
      document.querySelector("#output").value.startsWith("Translated")
    );
    await page.locator("#open-studio").click();
    assert.equal(await page.locator("#studio-analyze").isDisabled(), true);
    assert.match(await page.locator("#studio-status").textContent(), /3,000/);
    await page.reload();
    await page.locator("#settings-toggle").click();
    await page.locator("#glossary-editor").evaluate((e) => (e.open = true));
    assert.equal(await page.locator(".glossary-entry").count(), 1);
    await page.evaluate(async () => {
      await saveGlossary([]);
      renderGlossary();
    });
    await page.waitForFunction(() => document.querySelectorAll(".glossary-entry").length === 0);
    await page.locator("#menu-close").click();
    await page.evaluate(() => changeInterfaceLanguage("th"));
    await page.locator("#settings-toggle").click();
    assert.match(await page.locator("#glossary-editor summary").textContent(), /คำเฉพาะ/);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true
      );
    }
    assert.deepEqual(errors, []);
    console.log(
      "PASS: persistent feature-scoped glossary, actual validation/audit endpoints, explicit review, evidence/alternatives/back-translation, audited apply/undo, blind comparison/export, feature state restoration, late-response isolation, long-text limit, deletion, Thai labels and responsive layout."
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
