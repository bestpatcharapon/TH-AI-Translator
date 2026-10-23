const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const audioFixture = require("./audio-fixture.cjs");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", audioFixture()],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      permissions: ["microphone"],
    });
    const requests = [],
      errors = [];
    let pending;
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      const original = window.fetch;
      window.fetch = (url, options = {}) => original(url, { ...options, signal: undefined });
    });
    const unsure = {
      status: "needs_context",
      standard_thai: "",
      translation: "",
      note: "Unknown private phrase",
      questions: ["What does the speaker mean?"],
      possibilities: [],
      evidence: [],
      matched_entries: [],
      mode: "slang",
    };
    const result = (body) => {
      const entry = (body.thai_lexicon || []).find((entry) => body.text.includes(entry.term));
      if (body.thai_mode && !body.thai_clarification && !entry && !body.text.includes("ลำแต้"))
        return { translation: "", source_language: "th", interpretation: unsure };
      const standard = entry?.meaning || body.thai_clarification || "อร่อยมาก";
      return {
        translation: "Let's go, everyone.",
        source_language: "th",
        additional_translations: [],
        audit: { status: "clear", issues: [], terms_checked: 0, terms_matched: 0 },
        interpretation: body.thai_mode
          ? {
              status: "ready",
              standard_thai: standard,
              translation: "Let's go, everyone.",
              note: "Based on the context",
              questions: [],
              possibilities: [],
              evidence: [],
              matched_entries: entry ? [{ ...entry, origin: "personal" }] : [],
              mode: body.thai_mode,
            }
          : null,
      };
    };
    await page.route("**/api/translate", async (route) => {
      const body = route.request().postDataJSON();
      requests.push(body);
      if (body.text.startsWith("LATE")) {
        pending = { route, body };
        return;
      }
      await route.fulfill({ json: result(body) });
    });
    await page.route("**/api/assist", (route) =>
      route.fulfill({ json: { pronunciation: "reading", alternatives: ["first", "second"] } })
    );
    await page.route("**/api/transcribe", (route) => route.fulfill({ json: { text: "ลำแต้ๆ" } }));
    await page.goto(process.env.TRANSLATOR_TEST_URL || "http://127.0.0.1:5000");
    assert(await page.locator("#thai-tools").isVisible());
    await page.locator("#thai-mode").selectOption("slang");
    await page.locator("#input").fill("คำที่เพิ่งสร้าง");
    await page.locator("#thai-clarification-form").waitFor();
    assert.equal(await page.locator("#output").inputValue(), "");
    assert.equal(await page.evaluate(() => savedTranslations.length), 0);
    await page.locator("#thai-clarification").fill("ไปกันเลยเพื่อนๆ");
    await page.locator("#thai-clarify").click();
    await page.waitForFunction(
      () => document.querySelector("#output").value === "Let's go, everyone."
    );
    assert.match(await page.locator(".thai-central").textContent(), /ไปกันเลย/);
    assert.equal(requests.at(-1).thai_clarification, "ไปกันเลยเพื่อนๆ");
    await page.locator("#input").fill("อีกคำที่ยังไม่รู้");
    await page.locator("#thai-clarification-form").waitFor();
    assert.equal(requests.at(-1).thai_clarification, "");

    // Save a personal definition through the real, local validation endpoint.
    await page.locator("#settings-toggle").click();
    await page.locator("#thai-lexicon-editor summary").click();
    await page.locator("#thai-term").fill("อีกคำที่ยังไม่รู้");
    await page.locator("#thai-meaning").fill("ไปกันเลยเพื่อนๆ");
    await page.locator("#thai-example").fill("ใช้ชวนเพื่อนออกเดินทาง");
    await page.locator("#thai-save").click();
    await page.locator(".thai-lexicon-entry").waitFor();
    await page.locator("#menu-close").click();
    await page.waitForFunction(
      () => document.querySelector("#output").value === "Let's go, everyone."
    );
    assert.equal(requests.at(-1).thai_lexicon[0].meaning, "ไปกันเลยเพื่อนๆ");

    // Live Chat has its own mode and dictionary; uncertain text is not sent or spoken.
    await page.evaluate(() => switchFeature("live"));
    assert.equal(await page.locator("#thai-mode").inputValue(), "standard");
    assert.equal(await page.evaluate(() => activeFeature().thai.lexicon.length), 0);
    await page.locator("#live-audio").click();
    await page.locator("#thai-mode").selectOption("slang");
    await page.locator("#input").fill("แชตที่ไม่รู้ความหมาย");
    await page.locator("#live-send").click();
    await page.locator("#thai-clarification-form").waitFor();
    assert.equal(await page.locator(".chat-turn").count(), 0);
    assert.equal(await page.locator("#input").inputValue(), "แชตที่ไม่รู้ความหมาย");
    await page.locator("#thai-clarification").fill("ไปกันเลยเพื่อนๆ");
    await page.locator("#thai-clarify").click();
    await page.locator(".chat-turn").waitFor();
    assert.equal(await page.locator("#input").inputValue(), "");

    await page.evaluate(() => switchFeature("text"));
    assert.equal(await page.evaluate(() => activeFeature().thai.lexicon.length), 1);
    await page.locator("#input").fill("LATE UNKNOWN");
    await page.waitForFunction(() => !!activeFeature().request);
    for (let i = 0; !pending && i < 500; i++)
      await new Promise((resolve) => setTimeout(resolve, 20));
    assert(pending, "late request must have started");
    await page.evaluate(() => switchFeature("document"));
    assert.equal(await page.locator("#thai-tools").isVisible(), false);
    await pending.route.fulfill({ json: result(pending.body) });
    await page.waitForTimeout(80);
    assert.equal(await page.evaluate(() => activeFeature().thai.result), null);
    assert.equal(await page.locator("#output").inputValue(), "");

    await page.reload();
    assert.equal(await page.evaluate(() => activeFeature().thai.lexicon.length), 1);
    await page.locator("#thai-mode").selectOption("northern");
    // In dialect mode, a microphone transcript must be reviewed before translation.
    const count = requests.length;
    await page.locator("#microphone").click();
    await page.waitForFunction(
      () => document.querySelector("#microphone").getAttribute("aria-pressed") === "true"
    );
    await page.waitForTimeout(150);
    await page.locator("#microphone").click();
    await page.waitForFunction(() => document.querySelector("#input").value === "ลำแต้ๆ");
    await page.waitForTimeout(900);
    assert.equal(requests.length, count);
    assert.match(await page.locator("#voice-status").textContent(), /Check or edit/);
    await page.locator("#translate").click();
    await page.waitForFunction(
      () => document.querySelector("#output").value === "Let's go, everyone."
    );
    await page.locator("#ui-language").click();
    assert.match(await page.locator("#thai-mode-note").textContent(), /ตรวจข้อความจากไมค์/);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "/tmp/translator-thai-mode.png", fullPage: true });
    assert.deepEqual(errors, []);
    console.log(
      "PASS: ambiguity gate, explicit clarification, real dictionary validation/persistence, feature-owned modes, uncertain Live Chat, late response isolation, microphone review and responsive Thai UI."
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
