/* Requires Playwright and the running Flask app. All AI requests are mocked. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const audioFixture = require("./audio-fixture.cjs");
const baseURL = process.env.TRANSLATOR_TEST_URL || "http://127.0.0.1:5000";
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
    const errors = [],
      calls = [],
      pending = new Map();
    page.on("pageerror", (error) => errors.push(error.message));
    // Simulate providers that finish after cancellation, to exercise ownership guards.
    await page.addInitScript(() => {
      const fetchOriginal = window.fetch;
      window.fetch = (url, options = {}) => fetchOriginal(url, { ...options, signal: undefined });
    });
    const translated = (body) => `${body.target}:${body.tone}:${body.text}`;
    const fulfill = (route, body) =>
      route.fulfill({
        json: {
          translation: translated(body),
          source_language: body.source === "auto" ? "en" : body.source,
        },
      });
    await page.route("**/api/translate", async (route) => {
      const body = route.request().postDataJSON();
      calls.push(["translate", body]);
      if (body.text.startsWith("LATE")) {
        pending.set(body.text, { route, body });
        return;
      }
      await fulfill(route, body);
    });
    await page.route("**/api/assist", async (route) => {
      const body = route.request().postDataJSON();
      calls.push(["assist", body]);
      if (body.action === "explain" && body.text.startsWith("ASSIST LATE")) {
        pending.set("assist", { route, body });
        return;
      }
      await route.fulfill({
        json:
          body.action === "source_info"
            ? { pronunciation: `reading:${body.text}`, alternatives: [`example:${body.text}`] }
            : body.action === "explain"
              ? { explanation: `why:${body.text}` }
              : body.action === "replies"
                ? { replies: ["reply one", "reply two", "reply three"] }
                : { assessment: "good", notes: "Looks good", revision: "" },
      });
    });
    await page.route("**/api/extract", async (route) => {
      calls.push(["extract"]);
      if (route.request().postData().includes("late.txt")) {
        pending.set("extract", { route });
        return;
      }
      await route.fulfill({ json: { text: "DOCUMENT INPUT", filename: "document.txt" } });
    });
    await page.route("**/api/transcribe", (route) => {
      pending.set("voice", { route });
    });
    await page.route("**/api/speech", (route) => {
      pending.set("speech", { route });
    });
    let photoResult;
    await page.route("**/api/photo-translate", async (route) => {
      calls.push(["photo"]);
      if (route.request().postData().includes("late.png")) {
        pending.set("photo", { route });
        return;
      }
      await route.fulfill({ json: photoResult });
    });
    await page.goto(baseURL);
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
          x: 10,
          y: 10,
          width: 100,
          height: 20,
          text: "PHOTO INPUT",
          translation: "PHOTO RESULT",
          foreground: "#111111",
          background: "#ffffff",
        },
      ],
    };
    const select = (id, value) => page.locator(id).selectOption(value, { force: true });
    const go = (name) => page.evaluate((name) => switchFeature(name), name);
    const waitOutput = (value) =>
      page.waitForFunction((value) => document.querySelector("#output").value === value, value);
    const waitPending = async (key) => {
      for (let i = 0; i < 100 && !pending.has(key); i++) await page.waitForTimeout(20);
      assert(pending.has(key), `Missing pending request ${key}`);
    };
    const upload = (id, name, buffer) =>
      page.locator(id).setInputFiles({
        name,
        mimeType: name.endsWith(".png") ? "image/png" : "text/plain",
        buffer,
      });
    const imageBuffer = Buffer.from(image.split(",")[1], "base64");

    await select("#target", "ja");
    await select("#tone", "formal");
    await page.locator("#input").fill("TEXT INPUT");
    await waitOutput("ja:formal:TEXT INPUT");
    await page.locator("#source-insights").waitFor();
    await page.locator("#explain").click();
    await page.waitForFunction(
      () => document.querySelector("#explanation-text").textContent === "why:TEXT INPUT"
    );
    await page.locator("#save-translation").click();

    await page.locator('[data-mode="document"]').click();
    assert.equal(await page.locator("#input").inputValue(), "");
    assert.equal(await page.locator("#output").inputValue(), "");
    assert.equal(await page.locator("#source").inputValue(), "auto");
    assert.equal(await page.locator("#target").inputValue(), "en");
    assert.equal(await page.locator("#tone").inputValue(), "natural");
    await upload("#file-input", "document.txt", Buffer.from("DOCUMENT INPUT"));
    await waitOutput("en:natural:DOCUMENT INPUT");
    await select("#target", "fr");
    await select("#tone", "casual");
    await waitOutput("fr:casual:DOCUMENT INPUT");
    await page.waitForTimeout(500);
    assert(
      !calls.some(
        ([kind, body]) =>
          kind === "assist" &&
          ["source_info", "replies"].includes(body.action) &&
          body.text === "DOCUMENT INPUT"
      ),
      "Document mode must not request selectable suggestions"
    );
    assert(await page.locator("#source-insights").isHidden());
    assert(await page.locator("#suggest-replies").isHidden());
    await page.locator("#save-translation").click();
    await page.evaluate(() => document.querySelector("#show-saved").click());
    await page.locator("#saved-dialog").waitFor();
    assert.equal(await page.locator(".saved-card").count(), 1);
    assert.match(await page.locator(".saved-original").textContent(), /DOCUMENT INPUT/);
    await page.locator("#close-saved").click();

    await go("image");
    assert.equal(await page.locator("#source").inputValue(), "auto");
    assert.equal(await page.locator("#target").inputValue(), "en");
    assert.equal(await page.locator("#tone").inputValue(), "natural");
    assert.equal(await page.locator("#microphone").isDisabled(), true);
    await upload("#photo-file-input", "photo.png", imageBuffer);
    await page.locator(".photo-label").first().waitFor();
    await select("#target", "ko");
    await select("#tone", "formal");
    await page.waitForTimeout(750);
    await page.waitForFunction(() => photoData !== null);

    await go("live");
    assert.equal(await page.locator("#input").inputValue(), "");
    assert.equal(await page.locator("#source").inputValue(), "th");
    assert.equal(await page.locator("#target").inputValue(), "en");
    await page.locator("#live-audio").click();
    await select("#target", "de");
    await page.locator("#input").fill("LIVE MESSAGE");
    await page.locator("#live-send").click();
    await page.locator(".chat-turn").waitFor();
    await page.locator("#speaker-reverse").click();
    await page.locator("#input").fill("LIVE DRAFT");

    assert.equal(await page.locator("#reply-section, #reply-input, #translate-reply").count(), 0);
    const countBeforeSwitches = calls.length;
    for (let pass = 0; pass < 2; pass++) {
      await go("text");
      assert.equal(await page.locator("#input").inputValue(), "TEXT INPUT");
      assert.equal(await page.locator("#output").inputValue(), "ja:formal:TEXT INPUT");
      assert.equal(await page.locator("#target").inputValue(), "ja");
      assert.equal(await page.locator("#tone").inputValue(), "formal");
      assert.equal(await page.locator("#explanation-text").textContent(), "why:TEXT INPUT");
      assert.equal(await page.locator("#pronunciation").count(), 0);
      assert.match(await page.locator("#source-alternatives").textContent(), /TEXT INPUT/);
      await go("document");
      assert.equal(await page.locator("#input").inputValue(), "DOCUMENT INPUT");
      assert.equal(await page.locator("#output").inputValue(), "fr:casual:DOCUMENT INPUT");
      assert.equal(await page.locator("#target").inputValue(), "fr");
      assert.equal(await page.locator("#tone").inputValue(), "casual");
      assert.equal(await page.locator("#file-name").textContent(), "document.txt");
      assert(await page.locator("#source-insights").isHidden());
      assert(await page.locator("#suggest-replies").isHidden());
      await go("image");
      assert.equal(await page.locator("#target").inputValue(), "ko");
      assert.equal(await page.locator("#tone").inputValue(), "formal");
      assert.equal(await page.locator(".photo-label").count(), 1);
      await go("live");
      assert.equal(await page.locator("#input").inputValue(), "LIVE DRAFT");
      assert.equal(await page.locator("#target").inputValue(), "de");
      assert.equal(await page.locator("#speaker-reverse").getAttribute("aria-pressed"), "true");
      assert.equal(await page.locator(".chat-turn").count(), 1);
    }
    await page.waitForTimeout(950);
    assert.equal(calls.length, countBeforeSwitches, "Switching features must not trigger AI work");
    await go("text");
    await page.evaluate(() => document.querySelector("#show-saved").click());
    assert.equal(await page.locator(".saved-card").count(), 1);
    assert.match(await page.locator(".saved-original").textContent(), /TEXT INPUT/);
    await page.locator("#close-saved").click();
    console.log(
      "PASS independent text/results/languages/tone/files/assistant panels/saved items/chat history; repeated switching starts no requests."
    );

    await page.locator("#input").fill("LATE TEXT");
    await page.locator("#input").press("Control+Enter");
    await waitPending("LATE TEXT");
    await go("document");
    await page.locator("#input").fill("LATE DOCUMENT");
    await page.locator("#input").press("Control+Enter");
    await waitPending("LATE DOCUMENT");
    await fulfill(pending.get("LATE TEXT").route, pending.get("LATE TEXT").body);
    await page.waitForTimeout(80);
    assert.equal(await page.locator("#input").inputValue(), "LATE DOCUMENT");
    assert.equal(await page.locator("#output").inputValue(), "");
    assert.equal(await page.evaluate(() => !!activeFeature().request), true);
    await fulfill(pending.get("LATE DOCUMENT").route, pending.get("LATE DOCUMENT").body);
    await waitOutput("fr:casual:LATE DOCUMENT");
    await go("text");
    assert.equal(await page.locator("#input").inputValue(), "LATE TEXT");
    assert.equal(await page.locator("#output").inputValue(), "");

    await go("document");
    await upload("#file-input", "late.txt", Buffer.from("DO NOT LEAK"));
    await waitPending("extract");
    await select("#target", "de");
    assert.equal(await page.locator("#retry-file").isVisible(), true);
    await select("#target", "fr");
    await go("text");
    await page.locator("#input").fill("TEXT SAFE");
    await waitOutput("ja:formal:TEXT SAFE");
    await pending.get("extract").route.fulfill({ json: { text: "LATE EXTRACT MUST NOT LEAK" } });
    await page.waitForTimeout(80);
    assert.equal(await page.locator("#input").inputValue(), "TEXT SAFE");
    await go("document");
    assert.equal(await page.locator("#file-name").textContent(), "late.txt");
    assert.equal(await page.locator("#retry-file").isVisible(), true);
    assert.equal(await page.locator("#input").inputValue(), "");
    await page.locator("#remove-file").click();
    await go("text");
    assert.equal(await page.locator("#input").inputValue(), "TEXT SAFE");

    await go("image");
    await upload("#photo-file-input", "late.png", imageBuffer);
    await waitPending("photo");
    await go("text");
    await pending.get("photo").route.fulfill({ json: photoResult });
    await page.waitForTimeout(80);
    assert.equal(await page.locator("#input").inputValue(), "TEXT SAFE");
    const photoCallsBeforeReturn = calls.filter(([type]) => type === "photo").length;
    await go("image");
    assert.equal(await page.locator("#photo-error").isVisible(), true);
    assert.equal(await page.locator(".photo-label").count(), 0);
    assert.equal(calls.filter(([type]) => type === "photo").length, photoCallsBeforeReturn);
    await page.locator("#photo-remove").click();
    await go("live");
    assert.equal(await page.locator(".chat-turn").count(), 1);
    await page.locator("#clear-chat").click();
    await go("text");
    assert.equal(await page.locator("#input").inputValue(), "TEXT SAFE");
    console.log(
      "PASS late uncancellable translation/extraction/photo responses cannot leak or cancel another feature; removal and clearing affect only their owners."
    );

    await page.locator("#input").fill("ASSIST LATE INPUT");
    await waitOutput("ja:formal:ASSIST LATE INPUT");
    await page.locator("#explain").click();
    await waitPending("assist");
    await go("document");
    await pending.get("assist").route.fulfill({ json: { explanation: "MUST NOT LEAK" } });
    await page.waitForTimeout(80);
    assert.notEqual(await page.locator("#explanation-text").textContent(), "MUST NOT LEAK");
    await go("text");
    await page.locator("#microphone").click();
    await page.waitForFunction(
      () => document.querySelector("#microphone").dataset.voiceState === "recording"
    );
    await page.waitForTimeout(300);
    await page.locator("#microphone").click();
    await waitPending("voice");
    await go("document");
    await page.locator("#input").fill("DOCUMENT VOICE SAFE");
    await waitOutput("fr:casual:DOCUMENT VOICE SAFE");
    await pending.get("voice").route.fulfill({ json: { text: "VOICE MUST NOT LEAK" } });
    await page.waitForTimeout(80);
    assert.equal(await page.locator("#input").inputValue(), "DOCUMENT VOICE SAFE");
    assert.equal(await page.evaluate(() => mediaStream === null && voiceContext === null), true);
    await go("text");
    assert.equal(await page.locator("#input").inputValue(), "ASSIST LATE INPUT");
    await page.evaluate(() => {
      window.speechSynthesis.getVoices = () => [];
      window.__audioCreated = 0;
      const OriginalAudio = window.Audio;
      window.Audio = function (...args) {
        window.__audioCreated++;
        return new OriginalAudio(...args);
      };
      speak("SLOW AUDIO", "th");
    });
    await waitPending("speech");
    await go("document");
    await pending
      .get("speech")
      .route.fulfill({ contentType: "audio/mpeg", body: Buffer.from("not played") });
    await page.waitForTimeout(80);
    assert.equal(await page.evaluate(() => window.__audioCreated), 0);
    assert.equal(await page.locator("#input").inputValue(), "DOCUMENT VOICE SAFE");
    await go("text");
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: () =>
            new Promise((resolve) => {
              window.__resolveCopy = resolve;
            }),
        },
      });
      copyText("TEXT COPY");
    });
    await go("document");
    const documentStatus = await page.locator("#status").textContent();
    await page.evaluate(() => window.__resolveCopy());
    await page.waitForTimeout(40);
    assert.equal(await page.locator("#status").textContent(), documentStatus);
    await go("text");
    await page.dispatchEvent("#input", "compositionstart");
    await go("document");
    const documentOutput = await page.locator("#output").inputValue();
    await page.dispatchEvent("#input", "compositionend");
    assert.equal(await page.locator("#output").inputValue(), documentOutput);
    console.log(
      "PASS late transcription, audio playback, clipboard feedback and old IME events cannot affect another feature; microphone resources close on exit."
    );
    assert.deepEqual(errors, []);
    console.log("PASS late explanation responses remain isolated; no JavaScript errors.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
